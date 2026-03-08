import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerAuthRoutes, setupAuth, isAuthenticated } from "./auth";
import { VISIBILITY_OPTIONS } from "@shared/schema";

const visibilityEnum = z.enum(VISIBILITY_OPTIONS as unknown as [string, ...string[]]);

async function getAuthContext(req: any) {
  const userId = req.session?.user?.id;
  if (!userId) return null;
  const profile = await storage.getProfile(userId);
  const teamIds = await storage.getUserTeamIds(userId);
  return { userId, profile, teamIds };
}

function filterByVisibility<T extends { visibility: string; teamId: number | null }>(
  items: T[],
  role: string | undefined,
  userId: string,
  userTeamIds: number[],
  getOwnerId?: (item: T) => string | undefined
): T[] {
  if (role === "admin") return items;
  if (role === "tenant") {
    return items.filter(item => {
      if (item.visibility === "public") return true;
      if (item.visibility === "all_tenants") return true;
      if (item.visibility === "team" && item.teamId && userTeamIds.includes(item.teamId)) return true;
      if (item.visibility === "private" && getOwnerId) {
        return getOwnerId(item) === userId;
      }
      return false;
    });
  }
  return items.filter(item => item.visibility === "public");
}

async function canManageTeamResource(
  teamId: number | null,
  role: string | undefined,
  userId: string,
  userTeamIds: number[],
  resourceOwnerId?: string
): Promise<boolean> {
  if (role === "admin") return true;
  if (role !== "tenant") return false;
  if (resourceOwnerId && resourceOwnerId === userId) return true;
  if (teamId) {
    const team = await storage.getTeam(teamId);
    if (team && team.ownerId === userId) return true;
  }
  return false;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  const requireAuth = isAuthenticated;

  // Profiles
  app.get(api.profiles.me.path, requireAuth, async (req: any, res) => {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    let profile = await storage.getProfile(userId);
    if (!profile) {
      profile = await storage.upsertProfile(userId, { role: 'user' });
    }
    res.json(profile);
  });

  app.put(api.profiles.update.path, requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const input = api.profiles.update.input.parse(req.body);
      const profile = await storage.upsertProfile(userId, input);
      res.json(profile);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Demo login
  app.post("/api/login-demo", async (req: any, res) => {
    const demoUser = {
      id: "demo-user-123",
      firstName: "Demo",
      lastName: "User",
      email: "demo@example.com"
    };
    req.session.user = demoUser;
    req.session.save((err: any) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ message: "Session error" });
      }
      storage.upsertProfile(demoUser.id, { role: 'user' }).catch(console.error);
      res.json({ message: "Logged in as demo user", user: demoUser });
    });
  });

  app.post("/api/logout", (req: any, res) => {
    req.session.user = null;
    res.json({ message: "Logged out" });
  });

  // ========== TEAMS ==========

  app.get(api.teams.list.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    if (ctx.profile?.role === "admin") {
      const allTeams = await storage.getTeams();
      return res.json(allTeams);
    }
    if (ctx.profile?.role === "tenant") {
      const ownTeams = await storage.getTeamsByOwner(ctx.userId);
      return res.json(ownTeams);
    }
    return res.status(403).json({ message: "Forbidden" });
  });

  app.post(api.teams.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      if (ctx.profile?.role !== "admin" && ctx.profile?.role !== "tenant") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const input = api.teams.create.input.parse(req.body);
      const team = await storage.createTeam(ctx.userId, input);
      res.status(201).json(team);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/teams/:id", requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      const team = await storage.getTeam(Number(req.params.id));
      if (!team) return res.status(404).json({ message: "Team not found" });
      if (ctx.profile?.role !== "admin" && team.ownerId !== ctx.userId) {
        return res.status(403).json({ message: "Forbidden - you can only edit your own teams" });
      }
      const input = api.teams.update.input.parse(req.body);
      const updated = await storage.updateTeam(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/teams/:id", requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    const team = await storage.getTeam(Number(req.params.id));
    if (!team) return res.status(404).json({ message: "Team not found" });
    if (ctx.profile?.role !== "admin" && team.ownerId !== ctx.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteTeam(Number(req.params.id));
    res.json({ message: "Team deleted" });
  });

  app.get("/api/teams/:id/members", requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    const team = await storage.getTeam(Number(req.params.id));
    if (!team) return res.status(404).json({ message: "Team not found" });
    if (ctx.profile?.role !== "admin" && team.ownerId !== ctx.userId && !ctx.teamIds.includes(team.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const members = await storage.getTeamMembers(Number(req.params.id));
    res.json(members);
  });

  app.post("/api/teams/:id/members", requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      const team = await storage.getTeam(Number(req.params.id));
      if (!team) return res.status(404).json({ message: "Team not found" });
      if (ctx.profile?.role !== "admin" && team.ownerId !== ctx.userId) {
        return res.status(403).json({ message: "Forbidden - only team owner or admin can add members" });
      }
      const { userId, role } = api.teams.members.add.input.parse(req.body);
      const member = await storage.addTeamMember(Number(req.params.id), userId, role || 'member');
      res.status(201).json(member);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/teams/:id/members/:userId", requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    const team = await storage.getTeam(Number(req.params.id));
    if (!team) return res.status(404).json({ message: "Team not found" });
    if (ctx.profile?.role !== "admin" && team.ownerId !== ctx.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.removeTeamMember(Number(req.params.id), req.params.userId);
    res.json({ message: "Member removed" });
  });

  app.get("/api/config/google-maps-key", requireAuth, (req: any, res) => {
    res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY || "" });
  });

  // ========== SPACES ==========

  app.get(api.spaces.list.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    const allSpaces = await storage.getSpaces();
    const filtered = filterByVisibility(allSpaces, ctx.profile?.role, ctx.userId, ctx.teamIds);
    res.json(filtered);
  });

  app.post(api.spaces.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      if (ctx.profile?.role !== "admin" && ctx.profile?.role !== "tenant") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const input = api.spaces.create.input.parse(req.body);
      if (input.visibility) visibilityEnum.parse(input.visibility);
      if (ctx.profile?.role === "tenant" && input.teamId) {
        const team = await storage.getTeam(input.teamId);
        if (!team || team.ownerId !== ctx.userId) {
          return res.status(403).json({ message: "Forbidden - you can only create spaces in your own team" });
        }
      }
      const space = await storage.createSpace(input);
      res.status(201).json(space);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.spaces.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      const allSpaces = await storage.getSpaces();
      const existing = allSpaces.find(s => s.id === Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Space not found" });
      if (!(await canManageTeamResource(existing.teamId, ctx.profile?.role, ctx.userId, ctx.teamIds))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const input = api.spaces.update.input.parse(req.body);
      if (input.visibility) visibilityEnum.parse(input.visibility);
      if (input.parentId !== undefined && input.parentId !== null) {
        const spaceId = Number(req.params.id);
        if (input.parentId === spaceId) {
          return res.status(400).json({ message: "A space cannot be its own parent" });
        }
        const getDescendantIds = (id: number): number[] => {
          const children = allSpaces.filter(s => s.parentId === id);
          const ids: number[] = children.map(c => c.id);
          for (const child of children) {
            ids.push(...getDescendantIds(child.id));
          }
          return ids;
        };
        const descendantIds = getDescendantIds(spaceId);
        if (descendantIds.includes(input.parentId)) {
          return res.status(400).json({ message: "Cannot set a descendant space as parent (would create a cycle)" });
        }
      }
      const space = await storage.updateSpace(Number(req.params.id), input);
      res.json(space);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get("/api/spaces/storage-locations", requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    const allSpaces = await storage.getSpaces();
    const filtered = filterByVisibility(allSpaces, ctx.profile?.role, ctx.userId, ctx.teamIds);
    const storageLocations = filtered.filter(s => s.isStorageLocation);
    res.json(storageLocations);
  });

  app.delete("/api/spaces/:id", requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    const existing = await storage.getSpaces().then(ss => ss.find(s => s.id === Number(req.params.id)));
    if (!existing) return res.status(404).json({ message: "Space not found" });
    if (!(await canManageTeamResource(existing.teamId, ctx.profile?.role, ctx.userId, ctx.teamIds))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteSpace(Number(req.params.id));
    res.json({ message: "Space deleted" });
  });

  // ========== SERVICES ==========

  app.get(api.services.list.path, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    const allServices = await storage.getServices();
    if (!ctx) {
      return res.json(allServices.filter(s => s.visibility === "public"));
    }
    const filtered = filterByVisibility(allServices, ctx.profile?.role, ctx.userId, ctx.teamIds, (s) => s.tenantId);
    res.json(filtered);
  });

  app.post(api.services.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      if (ctx.profile?.role !== "admin" && ctx.profile?.role !== "tenant") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const bodySchema = api.services.create.input.extend({ price: z.coerce.number(), durationMinutes: z.coerce.number() });
      const input = bodySchema.parse(req.body);
      if (input.visibility) visibilityEnum.parse(input.visibility);
      if (input.locationType === "internal" && !input.locationSpaceId) {
        return res.status(400).json({ message: "Internal location requires a space selection" });
      }
      if (input.locationType === "external" && !input.locationAddress) {
        return res.status(400).json({ message: "External location requires an address" });
      }
      if (!input.locationType) {
        input.locationSpaceId = null;
        input.locationAddress = null;
        input.locationLat = null;
        input.locationLng = null;
      }
      if (ctx.profile?.role === "tenant" && input.teamId) {
        const team = await storage.getTeam(input.teamId);
        if (!team || team.ownerId !== ctx.userId) {
          return res.status(403).json({ message: "Forbidden - you can only create services in your own team" });
        }
      }
      const service = await storage.createService(ctx.userId, input);
      res.status(201).json(service);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.services.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      const existing = await storage.getServices().then(ss => ss.find(s => s.id === Number(req.params.id)));
      if (!existing) return res.status(404).json({ message: "Service not found" });
      if (!(await canManageTeamResource(existing.teamId, ctx.profile?.role, ctx.userId, ctx.teamIds, existing.tenantId))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const bodySchema = api.services.update.input.extend({
        price: z.coerce.number().optional(),
        durationMinutes: z.coerce.number().optional()
      });
      const input = bodySchema.parse(req.body);
      if (input.visibility) visibilityEnum.parse(input.visibility);
      const effectiveLocationType = input.locationType !== undefined ? input.locationType : existing.locationType;
      if (effectiveLocationType === "internal" && input.locationSpaceId === null && !existing.locationSpaceId) {
        return res.status(400).json({ message: "Internal location requires a space selection" });
      }
      if (effectiveLocationType === "external" && input.locationAddress === null && !existing.locationAddress) {
        return res.status(400).json({ message: "External location requires an address" });
      }
      if (input.locationType === null || input.locationType === undefined && !existing.locationType) {
        input.locationSpaceId = null;
        input.locationAddress = null;
        input.locationLat = null;
        input.locationLng = null;
      }
      const service = await storage.updateService(Number(req.params.id), input);
      res.json(service);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/services/:id", requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    const existing = await storage.getServices().then(ss => ss.find(s => s.id === Number(req.params.id)));
    if (!existing) return res.status(404).json({ message: "Service not found" });
    if (!(await canManageTeamResource(existing.teamId, ctx.profile?.role, ctx.userId, ctx.teamIds, existing.tenantId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteService(Number(req.params.id));
    res.json({ message: "Service deleted" });
  });

  // ========== BOOKINGS ==========

  app.get(api.bookings.list.path, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    const allBookings = await storage.getBookings();
    if (ctx.profile?.role === "admin" || ctx.profile?.role === "tenant") {
      return res.json(allBookings);
    }
    res.json(allBookings.filter(b => b.userId === ctx.userId));
  });

  app.post(api.bookings.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      const bodySchema = api.bookings.create.input.extend({
        spaceId: z.coerce.number().optional(),
        serviceId: z.coerce.number().optional(),
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
      });
      const input = bodySchema.parse(req.body);
      const booking = await storage.createBooking(ctx.userId, input);
      res.status(201).json(booking);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.bookings.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      const isInternal = ctx.profile?.role === "admin" || ctx.profile?.role === "tenant";
      const existingBooking = await storage.getBooking(Number(req.params.id));
      if (!existingBooking) return res.status(404).json({ message: "Booking not found" });
      if (!isInternal && existingBooking.userId !== ctx.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const bodySchema = api.bookings.update.input.extend({
        spaceId: z.coerce.number().optional(),
        serviceId: z.coerce.number().optional(),
        startTime: z.coerce.date().optional(),
        endTime: z.coerce.date().optional(),
      });
      const input = bodySchema.parse(req.body);
      const booking = await storage.updateBooking(Number(req.params.id), input);
      res.json(booking);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // ========== PUBLIC BOOKING ENDPOINTS ==========

  app.post("/api/public/bookings/start", async (req, res) => {
    try {
      const { guestName, guestEmail, spaceId, serviceId, startTime, endTime, notes } = req.body;
      if (!guestName || !guestEmail || !startTime || !endTime) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const booking = await storage.createBooking(null, {
        guestName, guestEmail,
        spaceId: spaceId ? Number(spaceId) : undefined,
        serviceId: serviceId ? Number(serviceId) : undefined,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        notes, status: "pending"
      });
      res.status(201).json(booking);
    } catch (err) {
      console.error("Error starting guest booking:", err);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  app.post("/api/public/send-verification", async (req, res) => {
    try {
      const { email, bookingId } = req.body;
      if (!email || !bookingId) return res.status(400).json({ message: "Missing email or bookingId" });
      const booking = await storage.getBooking(Number(bookingId));
      if (!booking || booking.guestEmail !== email) return res.status(400).json({ message: "Booking not found or email mismatch" });
      const { emailService } = await import("./email");
      const code = emailService.generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await storage.createVerificationCode(email, code, Number(bookingId), expiresAt);
      await emailService.sendVerificationCode(email, code);
      res.json({ message: "Verification code sent" });
    } catch (err) {
      console.error("Error sending verification code:", err);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  app.post("/api/public/bookings/verify", async (req, res) => {
    try {
      const { email, code, bookingId } = req.body;
      if (!email || !code || !bookingId) return res.status(400).json({ message: "Missing required fields" });
      const verificationCode = await storage.getVerificationCode(email, code);
      if (!verificationCode || verificationCode.expiresAt < new Date()) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
      }
      await storage.updateBooking(Number(bookingId), { status: "confirmed" });
      await storage.deleteVerificationCode(verificationCode.id);
      res.json({ message: "Booking confirmed" });
    } catch (err) {
      console.error("Error verifying email:", err);
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  app.post("/api/public/signup", async (req, res) => {
    try {
      const { bookingId, email, firstName, lastName } = req.body;
      if (!bookingId || !email || !firstName || !lastName) return res.status(400).json({ message: "Missing required fields" });
      const booking = await storage.getBooking(Number(bookingId));
      if (!booking || booking.status !== "confirmed") return res.status(400).json({ message: "Invalid booking state" });
      res.json({
        message: "Account signup is not available yet. Return to the home page and use the sign-in button to continue.",
        redirectUrl: "/",
      });
    } catch (err) {
      console.error("Error in signup:", err);
      res.status(500).json({ message: "Failed to process signup" });
    }
  });

  // ========== INVENTORY ==========

  app.get(api.inventory.list.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    if (ctx.profile?.role !== "admin" && ctx.profile?.role !== "tenant") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const allItems = await storage.getInventoryItems();
    const filtered = filterByVisibility(allItems, ctx.profile?.role, ctx.userId, ctx.teamIds, (i) => i.ownerId);
    res.json(filtered);
  });

  app.post(api.inventory.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      if (ctx.profile?.role !== "admin" && ctx.profile?.role !== "tenant") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const input = api.inventory.create.input.parse(req.body);
      if (input.visibility) visibilityEnum.parse(input.visibility);
      if (ctx.profile?.role === "tenant" && input.teamId) {
        const team = await storage.getTeam(input.teamId);
        if (!team || team.ownerId !== ctx.userId) {
          return res.status(403).json({ message: "Forbidden - you can only create items in your own team" });
        }
      }
      const item = await storage.createInventoryItem(ctx.userId, input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.inventory.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      const existing = await storage.getInventoryItem(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Item not found" });
      if (!(await canManageTeamResource(existing.teamId, ctx.profile?.role, ctx.userId, ctx.teamIds, existing.ownerId))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const input = api.inventory.update.input.parse(req.body);
      if (input.visibility) visibilityEnum.parse(input.visibility);
      const item = await storage.updateInventoryItem(Number(req.params.id), input);
      res.json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/inventory/:id", requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    const existing = await storage.getInventoryItem(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Item not found" });
    if (!(await canManageTeamResource(existing.teamId, ctx.profile?.role, ctx.userId, ctx.teamIds, existing.ownerId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteInventoryItem(Number(req.params.id));
    res.json({ message: "Item deleted" });
  });

  // ========== HIRES ==========

  app.get(api.hires.list.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) return res.status(401).json({ message: "Unauthorized" });
    if (ctx.profile?.role !== "admin" && ctx.profile?.role !== "tenant") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const hires = await storage.getInventoryHires();
    res.json(hires);
  });

  app.post(api.hires.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      if (ctx.profile?.role !== "admin" && ctx.profile?.role !== "tenant") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const bodySchema = api.hires.create.input.extend({
        itemId: z.coerce.number(),
        bookingId: z.coerce.number().optional(),
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
      });
      const input = bodySchema.parse(req.body);
      const hire = await storage.createInventoryHire(ctx.userId, input);
      res.status(201).json(hire);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.hires.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) return res.status(401).json({ message: "Unauthorized" });
      if (ctx.profile?.role !== "admin" && ctx.profile?.role !== "tenant") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const bodySchema = api.hires.update.input.extend({
        itemId: z.coerce.number().optional(),
        bookingId: z.coerce.number().optional(),
        startTime: z.coerce.date().optional(),
        endTime: z.coerce.date().optional(),
      });
      const input = bodySchema.parse(req.body);
      const hire = await storage.updateInventoryHire(Number(req.params.id), input);
      res.json(hire);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // ========== SEED DATA ==========

  async function seedDatabase() {
    try {
      const existingSpaces = await storage.getSpaces();
      if (existingSpaces.length === 0) {
        await storage.createSpace({
          name: "Main Studio Room",
          description: "Large open space for photography and events",
          capacity: 25,
          isActive: true,
          visibility: "all_tenants"
        });
        await storage.createSpace({
          name: "Editing Suite A",
          description: "Quiet room with editing rig",
          capacity: 2,
          isActive: true,
          visibility: "all_tenants"
        });
      }

      const existingItems = await storage.getInventoryItems();
      if (existingItems.length === 0) {
        await storage.createInventoryItem("system", {
          name: "Profoto B10 Flash",
          description: "Battery powered studio flash",
          category: "Lighting",
          isAvailableForHire: true,
          condition: "excellent",
          visibility: "all_tenants"
        });
        await storage.createInventoryItem("system", {
          name: "Sony A7IV",
          description: "Mirrorless Camera Body",
          category: "Cameras",
          isAvailableForHire: true,
          condition: "good",
          visibility: "all_tenants"
        });
      }
    } catch (err) {
      console.error("Error seeding database:", err);
    }
  }

  seedDatabase();

  return httpServer;
}
