import type { Express } from "express";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { api } from "@shared/routes";
import { users } from "@shared/models/auth";
import { db } from "../db";
import { storage } from "../storage";
import { authStorage } from "./storage";
import { buildLoginUrl, buildLogoutUrl, exchangeCallback, getAuthentikConfig, getUserInfo } from "./oidc";

const inviteTokenQuerySchema = z.object({
  invite: z.string().optional(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function deriveNames(userInfo: Record<string, unknown>) {
  const fullName = String(userInfo.name || "").trim() || null;
  const givenName = String(userInfo.given_name || "").trim() || null;
  const familyName = String(userInfo.family_name || "").trim() || null;

  if (givenName || familyName) {
    return { fullName: fullName || [givenName, familyName].filter(Boolean).join(" "), firstName: givenName, lastName: familyName };
  }

  if (fullName) {
    const [firstName, ...rest] = fullName.split(/\s+/);
    return { fullName, firstName: firstName || null, lastName: rest.join(" ") || null };
  }

  return { fullName: null, firstName: null, lastName: null };
}

async function ensureUniqueUsername(preferred: string) {
  const base = slugify(preferred) || "user";
  let candidate = base;
  let suffix = 1;
  while (await authStorage.getUserByUsername(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function shouldBootstrapAdmin(email: string) {
  const configured = (process.env.AUTH_BOOTSTRAP_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (configured.includes(email.toLowerCase())) {
    return true;
  }

  const [existingAdmins] = await db.select({ count: count() }).from(users).where(eq(users.appRole, "admin"));
  return Number(existingAdmins?.count || 0) === 0;
}

async function resolveLocalUser(userInfo: Record<string, unknown>, issuer: string) {
  const email = String(userInfo.email || "").toLowerCase();
  const subject = String(userInfo.sub || "");
  if (!email || !subject) {
    throw new Error("Authentik response is missing required email or subject claims.");
  }

  const names = deriveNames(userInfo);
  const preferredUsername = String(userInfo.preferred_username || email.split("@")[0] || "user");
  const existing =
    (await authStorage.getUserByAuthentikIdentity(issuer, subject)) ||
    (await authStorage.getUserByEmail(email));

  const username = existing?.username || (await ensureUniqueUsername(preferredUsername));
  const appRole = existing?.appRole || ((await shouldBootstrapAdmin(email)) ? "admin" : "member");

  return authStorage.upsertUser({
    id: existing?.id,
    email,
    username,
    firstName: names.firstName,
    lastName: names.lastName,
    fullName: names.fullName,
    profileImageUrl: typeof userInfo.picture === "string" ? userInfo.picture : null,
    appRole,
    authentikIssuer: issuer,
    authentikSubject: subject,
    lastLoginAt: new Date(),
    updatedAt: new Date(),
  });
}

async function applyInviteIfPresent(req: any, user: Awaited<ReturnType<typeof resolveLocalUser>>) {
  const inviteToken = req.session?.inviteToken;
  if (!inviteToken) {
    return;
  }

  const invite = await storage.getWorkspaceInviteByToken(inviteToken);
  if (!invite || invite.status !== "pending" || new Date(invite.expiresAt) < new Date()) {
    req.session.inviteToken = null;
    return;
  }

  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return;
  }

  await storage.addWorkspaceMembership(invite.workspaceId, user.id, invite.role);
  await storage.updateWorkspaceInvite(invite.id, {
    status: "accepted",
    acceptedAt: new Date(),
  });

  req.session.activeWorkspaceId = invite.workspaceId;
  req.session.inviteToken = null;
}

export function registerAuthRoutes(app: Express): void {
  app.get(api.auth.session.path, async (req: any, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const workspaces = await storage.getWorkspacesForUser(req.session.user.id);
    const activeWorkspaceId =
      req.session.activeWorkspaceId && workspaces.some((workspace) => workspace.id === req.session.activeWorkspaceId)
        ? req.session.activeWorkspaceId
        : workspaces[0]?.id || null;
    req.session.activeWorkspaceId = activeWorkspaceId;

    let invite = null;
    if (req.session.inviteToken) {
      const resolvedInvite = await storage.getWorkspaceInviteByToken(req.session.inviteToken);
      const workspace = resolvedInvite ? await storage.getWorkspace(resolvedInvite.workspaceId) : undefined;
      if (resolvedInvite && workspace) {
        invite = {
          token: resolvedInvite.token,
          workspaceId: resolvedInvite.workspaceId,
          workspaceName: workspace.displayName || workspace.name,
          email: resolvedInvite.email,
          role: resolvedInvite.role as "owner" | "manager" | "member",
          expiresAt: resolvedInvite.expiresAt.toISOString(),
        };
      }
    }

    return res.json({
      user: req.session.user,
      activeWorkspaceId,
      workspaces: workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        displayName: workspace.displayName,
        publicSlug: workspace.publicSlug,
        membershipRole: workspace.membershipRole as "owner" | "manager" | "member" | null,
      })),
      invite,
    });
  });

  app.post(api.auth.switchWorkspace.path, async (req: any, res) => {
    if (!req.session?.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const input = api.auth.switchWorkspace.input.parse(req.body);
    const membership = await storage.getWorkspaceMembership(input.workspaceId, req.session.user.id);
    if (!membership && req.session.user.appRole !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    req.session.activeWorkspaceId = input.workspaceId;
    return res.json({ workspaceId: input.workspaceId });
  });

  app.get("/api/auth/login", async (req: any, res) => {
    const query = inviteTokenQuerySchema.parse(req.query);
    if (query.invite) {
      req.session.inviteToken = query.invite;
    }

    const { url, state, codeVerifier } = await buildLoginUrl();
    req.session.oidc = { state, codeVerifier };
    return res.redirect(url);
  });

  app.get("/api/auth/callback", async (req: any, res) => {
    try {
      const { oidc } = req.session;
      if (!oidc?.codeVerifier || !oidc.state) {
        return res.status(400).json({ message: "Authentication session expired. Try signing in again." });
      }

      const currentUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const { tokens } = await exchangeCallback(currentUrl, oidc.codeVerifier, oidc.state);
      const userInfo = await getUserInfo(tokens.access_token);
      const authConfig = getAuthentikConfig();
      const user = await resolveLocalUser(userInfo as Record<string, unknown>, authConfig.issuerUrl);

      req.session.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        fullName: user.fullName ?? null,
        appRole: user.appRole,
      };
      req.session.oidc = { idToken: tokens.id_token };

      await applyInviteIfPresent(req, user);

      const workspaces = await storage.getWorkspacesForUser(user.id);
      if (!req.session.activeWorkspaceId && workspaces[0]) {
        req.session.activeWorkspaceId = workspaces[0].id;
      }

      return res.redirect("/");
    } catch (error) {
      console.error("OIDC callback failed:", error);
      return res.redirect("/?authError=signin_failed");
    }
  });

  app.get("/api/auth/logout", async (req: any, res) => {
    const idTokenHint = req.session?.oidc?.idToken;
    const logoutUrl = await buildLogoutUrl(idTokenHint);
    req.session.destroy((error: Error | null) => {
      if (error) {
        return res.status(500).json({ message: "Could not log out." });
      }
      res.clearCookie("connect.sid");
      return res.redirect(logoutUrl);
    });
  });
}
