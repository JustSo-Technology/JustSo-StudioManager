import type { Express } from "express";
import passport from "passport";
import { z } from "zod";
import { authStorage } from "./storage";
import { storage } from "../storage";
import { hashPassword } from "./password";

const signupSchema = z.object({
  studioName: z.string().min(2, "Studio name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 10;
const authAttempts = new Map<string, { count: number; resetAt: number }>();

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function getClientKey(req: any) {
  return req.ip || req.headers["x-forwarded-for"] || "unknown";
}

function checkRateLimit(req: any, res: any) {
  const key = String(getClientKey(req));
  const now = Date.now();
  const existing = authAttempts.get(key);

  if (!existing || existing.resetAt < now) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return false;
  }

  if (existing.count >= AUTH_MAX_ATTEMPTS) {
    res.status(429).json({ message: "Too many auth attempts. Please try again later." });
    return true;
  }

  existing.count += 1;
  authAttempts.set(key, existing);
  return false;
}

function clearRateLimit(req: any) {
  authAttempts.delete(String(getClientKey(req)));
}

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", async (req: any, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(req.session.user);
  });

  app.post("/api/auth/signup", async (req: any, res) => {
    try {
      if (checkRateLimit(req, res)) {
        return;
      }
      const input = signupSchema.parse(req.body);
      const email = input.email.toLowerCase();
      const existing = await authStorage.getUserByEmail(email);

      if (existing) {
        return res.status(409).json({ message: "That email is already registered." });
      }

      const user = await authStorage.createUser({
        email,
        firstName: input.studioName,
        passwordHash: await hashPassword(input.password),
      });

      await storage.upsertProfile(user.id, {
        role: "tenant",
        tenantName: input.studioName,
        displayName: input.studioName,
        publicSlug: slugify(input.studioName),
        contactEmail: email,
      });

      req.login(user, (error: any) => {
        if (error) {
          return res.status(500).json({ message: "Session error" });
        }
        clearRateLimit(req);
        return res.status(201).json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Could not create account." });
    }
  });

  app.post("/api/auth/login", async (req: any, res) => {
    try {
      if (checkRateLimit(req, res)) {
        return;
      }
      const input = loginSchema.parse(req.body);
      req.body.email = input.email.toLowerCase();

      passport.authenticate("local", (error: any, user: any, info: { message?: string } | undefined) => {
        if (error) {
          return res.status(500).json({ message: "Could not sign in." });
        }
        if (!user) {
          return res.status(401).json({ message: info?.message || "Invalid email or password." });
        }

        req.login(user, (loginError: any) => {
          if (loginError) {
            return res.status(500).json({ message: "Session error" });
          }
          clearRateLimit(req);
          return res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          });
        });
      })(req, res);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Could not sign in." });
    }
  });
}
