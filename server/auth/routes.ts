import type { Express } from "express";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { api } from "@shared/routes";
import { users } from "@shared/models/auth";
import { organisationMemberships, studioMemberships, studios } from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { authStorage } from "./storage";
import { buildLoginUrl, buildLogoutUrl, exchangeCallback, getAuthentikConfig, getUserInfo } from "./oidc";

const inviteTokenQuerySchema = z.object({
  invite: z.string().optional(),
});

function normalizeOrganisationRole(role: unknown): "ORG_OWNER" | "ORG_ADMIN" | "ORG_MEMBER" | null {
  const value = String(role || "").trim().toUpperCase();
  if (value === "ORG_OWNER" || value === "OWNER") {
    return "ORG_OWNER";
  }
  if (value === "ORG_ADMIN" || value === "ADMIN") {
    return "ORG_ADMIN";
  }
  if (value === "ORG_MEMBER" || value === "MEMBER") {
    return "ORG_MEMBER";
  }
  return null;
}

function resolveAuthentikAccountUrl(): string | null {
  const configured = process.env.AUTH_ACCOUNT_URL?.trim();
  if (configured) {
    return configured;
  }
  try {
    const { issuerUrl } = getAuthentikConfig();
    return `${new URL(issuerUrl).origin}/if/user/#/settings`;
  } catch {
    return null;
  }
}

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

const DEFAULT_STUDIO_ID = "justso-studios";

async function ensureDefaultStudio() {
  const [existing] = await db.select().from(studios).where(eq(studios.id, DEFAULT_STUDIO_ID));
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(studios)
    .values({
      id: DEFAULT_STUDIO_ID,
      name: "JustSo. Studios",
      slug: "justso-studios",
      description: "Default studio for this Studio Manager deployment.",
      updatedAt: new Date(),
    })
    .returning();
  return created;
}

async function ensureStudioMembership(userId: string, role: "STUDIO_OWNER" | "STUDIO_ADMIN" | "STUDIO_MEMBER") {
  await ensureDefaultStudio();
  const [existing] = await db
    .select()
    .from(studioMemberships)
    .where(and(eq(studioMemberships.studioId, DEFAULT_STUDIO_ID), eq(studioMemberships.userId, userId)));

  if (existing) {
    if (existing.role === role) {
      return existing;
    }
    const [updated] = await db
      .update(studioMemberships)
      .set({ role, updatedAt: new Date() })
      .where(eq(studioMemberships.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(studioMemberships)
    .values({
      studioId: DEFAULT_STUDIO_ID,
      userId,
      role,
      updatedAt: new Date(),
    })
    .returning();
  return created;
}

async function resolveLocalUser(userInfo: Record<string, unknown>, issuer: string) {
  const subject = String(userInfo.sub || "").trim();
  if (!subject) {
    throw new Error("Authentik response is missing required subject claim.");
  }

  const existingByIdentity = await authStorage.getUserByAuthentikIdentity(issuer, subject);
  const rawEmail = String(userInfo.email || "").trim().toLowerCase();
  const preferredUsername = String(userInfo.preferred_username || "").trim().toLowerCase();
  const fallbackEmailFromUsername = preferredUsername.includes("@") ? preferredUsername : "";
  const surrogateEmail = `${subject}@authentik.local`;
  const email = rawEmail || existingByIdentity?.email || fallbackEmailFromUsername || surrogateEmail;

  if (!rawEmail) {
    console.warn(`OIDC userinfo missing email for subject ${subject}; using fallback email ${email}.`);
  }

  const names = deriveNames(userInfo);
  const preferredUsernameBase = String(userInfo.preferred_username || email.split("@")[0] || "user");
  const existing =
    existingByIdentity ||
    (await authStorage.getUserByEmail(email));

  const username = existing?.username || (await ensureUniqueUsername(preferredUsernameBase));
  const shouldBootstrap = await shouldBootstrapAdmin(email);
  const appRole = existing?.appRole || (shouldBootstrap ? "admin" : "member");

  const user = await authStorage.upsertUser({
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

  await ensureStudioMembership(user.id, shouldBootstrap ? "STUDIO_OWNER" : "STUDIO_MEMBER");
  return user;
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

  const [existingOrganisationMembership] = await db
    .select()
    .from(organisationMemberships)
    .where(and(eq(organisationMemberships.organisationId, invite.organisationId), eq(organisationMemberships.userId, user.id)));
  if (!existingOrganisationMembership) {
    await storage.addWorkspaceMembership(invite.organisationId, user.id, invite.role);
  }
  await storage.updateWorkspaceInvite(invite.id, {
    status: "accepted",
    acceptedAt: new Date(),
  });

  req.session.activeOrganisationId = invite.organisationId;
  req.session.inviteToken = null;
}

async function saveSession(req: any): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.save((error: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export function registerAuthRoutes(app: Express): void {
  app.get(api.auth.session.path, async (req: any, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    if (!req.session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const organisations = await storage.getWorkspacesForUser(req.session.user.id);
    const [studioMembership] = await db
      .select()
      .from(studioMemberships)
      .where(and(eq(studioMemberships.studioId, DEFAULT_STUDIO_ID), eq(studioMemberships.userId, req.session.user.id)));

    const activeOrganisationId =
      req.session.activeOrganisationId && organisations.some((organisation) => organisation.id === req.session.activeOrganisationId)
        ? req.session.activeOrganisationId
        : organisations[0]?.id || null;
    req.session.activeOrganisationId = activeOrganisationId;

    let invite = null;
    if (req.session.inviteToken) {
      const resolvedInvite = await storage.getWorkspaceInviteByToken(req.session.inviteToken);
      const organisation = resolvedInvite ? await storage.getWorkspace(resolvedInvite.organisationId) : undefined;
      if (resolvedInvite && organisation) {
        invite = {
          token: resolvedInvite.token,
          organisationId: resolvedInvite.organisationId,
          organisationName: organisation.displayName || organisation.name,
          workspaceId: resolvedInvite.organisationId,
          workspaceName: organisation.displayName || organisation.name,
          email: resolvedInvite.email,
          role: normalizeOrganisationRole(resolvedInvite.role) || "ORG_MEMBER",
          expiresAt: resolvedInvite.expiresAt.toISOString(),
        };
      }
    }

    return res.json({
      user: {
        ...req.session.user,
        studioRole: studioMembership?.role || req.session.user.studioRole || "STUDIO_MEMBER",
        appRole: req.session.user.appRole || "member",
      },
      activeStudioId: DEFAULT_STUDIO_ID,
      activeOrganisationId,
      activeWorkspaceId: activeOrganisationId,
      authentikAccountUrl: resolveAuthentikAccountUrl(),
      organisations: organisations.map((organisation) => ({
        id: organisation.id,
        name: organisation.name,
        displayName: organisation.displayName,
        publicSlug: organisation.publicSlug,
        organisationRole: normalizeOrganisationRole(organisation.membershipRole),
      })),
      workspaces: organisations.map((organisation) => ({
        id: organisation.id,
        name: organisation.name,
        displayName: organisation.displayName,
        publicSlug: organisation.publicSlug,
        organisationRole: normalizeOrganisationRole(organisation.membershipRole),
      })),
      invite,
    });
  });

  app.post(api.auth.switchOrganisation.path, async (req: any, res) => {
    if (!req.session?.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const input = api.auth.switchOrganisation.input.parse(req.body);
    const membership = await storage.getWorkspaceMembership(input.organisationId, req.session.user.id);
    if (!membership && req.session.user.studioRole !== "STUDIO_OWNER" && req.session.user.studioRole !== "STUDIO_ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }

    req.session.activeOrganisationId = input.organisationId;
    return res.json({ organisationId: input.organisationId });
  });

  app.get("/api/auth/login", async (req: any, res) => {
    try {
      const query = inviteTokenQuerySchema.parse(req.query);
      if (query.invite) {
        req.session.inviteToken = query.invite;
      }

      const { url, state, codeVerifier } = await buildLoginUrl();
      req.session.oidc = { state, codeVerifier };
      await saveSession(req);
      return res.redirect(url);
    } catch (error) {
      console.error("OIDC login init failed:", error);
      return res.redirect("/?authError=signin_failed");
    }
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
        profileImageUrl: user.profileImageUrl ?? null,
        studioRole: (await ensureStudioMembership(user.id, user.appRole === "admin" ? "STUDIO_OWNER" : "STUDIO_MEMBER")).role,
        activeStudioId: DEFAULT_STUDIO_ID,
      };
      req.session.oidc = { idToken: tokens.id_token };

      await applyInviteIfPresent(req, user);

      const organisations = await storage.getWorkspacesForUser(user.id);
      if (!req.session.activeOrganisationId && organisations[0]) {
        req.session.activeOrganisationId = organisations[0].id;
      }

      await saveSession(req);
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
