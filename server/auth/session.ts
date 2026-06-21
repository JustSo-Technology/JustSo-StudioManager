import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
      fullName: string | null;
      profileImageUrl?: string | null;
      studioRole: string;
      activeStudioId?: string | null;
    } | null;
    oidc?: {
      state?: string;
      codeVerifier?: string;
      nonce?: string;
      idToken?: string;
    };
    activeOrganisationId?: string | null;
    inviteToken?: string | null;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const secureCookieOverride = process.env.SESSION_COOKIE_SECURE;
  const secureCookie =
    secureCookieOverride === "true"
      ? true
      : secureCookieOverride === "false"
        ? false
        : process.env.NODE_ENV === "production"
          ? "auto"
          : false;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    proxy: true,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  const trustProxy = process.env.SESSION_TRUST_PROXY;
  if (!trustProxy || trustProxy === "1") {
    app.set("trust proxy", 1);
  } else if (trustProxy === "true") {
    app.set("trust proxy", true);
  } else if (trustProxy === "false") {
    app.set("trust proxy", false);
  } else {
    const hops = Number.parseInt(trustProxy, 10);
    app.set("trust proxy", Number.isFinite(hops) ? hops : 1);
  }
  app.use(getSession());

  app.use(async (req, _res, next) => {
    const sessionUser = req.session?.user;
    if (!sessionUser?.id) {
      return next();
    }

    const user = await authStorage.getUser(sessionUser.id);
    if (!user) {
      req.session.user = null;
      req.session.activeOrganisationId = null;
      return next();
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      fullName: user.fullName ?? null,
      profileImageUrl: user.profileImageUrl ?? null,
      studioRole: req.session.user?.studioRole || "STUDIO_MEMBER",
      activeStudioId: req.session.user?.activeStudioId || null,
    };
    next();
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};
