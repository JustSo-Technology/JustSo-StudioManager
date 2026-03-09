import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { registerAuthRoutes, setupAuth, isAuthenticated } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import {
  CALENDAR_PROVIDER_OPTIONS,
  ROLE_OPTIONS,
  VISIBILITY_OPTIONS,
  type Booking,
} from "@shared/schema";
import { buildInternalCalendarIcs, deleteBookingFromCalendar, syncBookingToCalendar } from "./calendar-sync";
import { encryptSecret } from "./crypto";
import { EmailConfigurationError, emailService } from "./email";
import { scheduleBookingReminder, sendBookingCancellationEmail, sendBookingConfirmationEmail, getBookingEmailContext } from "./booking-email";

const visibilityEnum = z.enum(VISIBILITY_OPTIONS as unknown as [string, ...string[]]);
const roleEnum = z.enum(ROLE_OPTIONS as unknown as [string, ...string[]]);
const providerEnum = z.enum(CALENDAR_PROVIDER_OPTIONS as unknown as [string, ...string[]]);

async function getAuthContext(req: any) {
  const userId = req.session?.user?.id;
  if (!userId) {
    return null;
  }

  let profile = await storage.getProfile(userId);
  if (!profile) {
    try {
      profile = await storage.upsertProfile(userId, {
        role: "tenant",
        tenantName: req.session.user?.firstName || "Untitled Studio",
        displayName: req.session.user?.firstName ? `${req.session.user.firstName} Studio` : "Untitled Studio",
      });
    } catch {
      profile = {
        userId,
        role: "tenant",
        tenantName: req.session.user?.firstName || "Untitled Studio",
        displayName: req.session.user?.firstName ? `${req.session.user.firstName} Studio` : "Untitled Studio",
        publicSlug: slugify(req.session.user?.firstName || "studio"),
        tagline: null,
        heroTitle: null,
        heroDescription: null,
        bio: null,
        contactEmail: req.session.user?.email || null,
        contactPhone: null,
        websiteUrl: null,
        instagramUrl: null,
        logoUrl: null,
        coverImageUrl: null,
        brandColor: "#111827",
        bookingNotes: null,
        bookingTerms: null,
      };
    }
  }

  const teamIds = await storage.getUserTeamIds(userId);
  return { userId, profile, teamIds };
}

function requireAdminProfile(ctx: Awaited<ReturnType<typeof getAuthContext>>) {
  if (!ctx) {
    throw new Error("Unauthorized");
  }
  if (ctx.profile.role !== "admin") {
    throw new Error("Forbidden");
  }
}

function filterByVisibility<T extends { visibility: string; teamId: number | null }>(
  items: T[],
  role: string | undefined,
  userId: string,
  userTeamIds: number[],
  getOwnerId?: (item: T) => string | undefined,
) {
  if (role === "admin") {
    return items;
  }

  if (role === "tenant") {
    return items.filter((item) => {
      if (item.visibility === "public" || item.visibility === "all_tenants") {
        return true;
      }
      if (item.visibility === "team" && item.teamId && userTeamIds.includes(item.teamId)) {
        return true;
      }
      if (item.visibility === "private" && getOwnerId) {
        return getOwnerId(item) === userId;
      }
      return false;
    });
  }

  return items.filter((item) => item.visibility === "public");
}

async function canManageTeamResource(
  teamId: number | null,
  role: string | undefined,
  userId: string,
  userTeamIds: number[],
  resourceOwnerId?: string,
) {
  if (role === "admin") {
    return true;
  }
  if (role !== "tenant") {
    return false;
  }
  if (resourceOwnerId && resourceOwnerId === userId) {
    return true;
  }
  if (teamId && userTeamIds.includes(teamId)) {
    return true;
  }
  if (teamId) {
    const team = await storage.getTeam(teamId);
    return !!team && team.ownerId === userId;
  }
  return true;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeProfileInput(input: Record<string, unknown>, existing: Record<string, unknown> | undefined) {
  const parsed = api.profiles.update.input.parse(input);
  const tenantName = String(parsed.tenantName || parsed.displayName || existing?.tenantName || existing?.displayName || "Untitled Studio");
  const displayName = String(parsed.displayName || parsed.tenantName || existing?.displayName || tenantName);
  const publicSlug = slugify(String(parsed.publicSlug || existing?.publicSlug || displayName));
  return {
    ...parsed,
    role: parsed.role ? roleEnum.parse(String(parsed.role)) : String(existing?.role || "tenant"),
    tenantName,
    displayName,
    publicSlug,
    heroTitle: parsed.heroTitle || displayName,
    contactEmail: parsed.contactEmail || undefined,
  };
}

async function requireCalendarResourceForTenant(calendarResourceId: number | null | undefined, tenantId: string, allowAdmin = false) {
  if (!calendarResourceId) {
    throw new Error("Assign a calendar before saving this bookable resource.");
  }

  const details = await storage.getCalendarResourceWithConnection(calendarResourceId);
  if (!details) {
    throw new Error("Assigned calendar could not be found.");
  }

  if (details.resource.tenantId !== tenantId && !allowAdmin) {
    throw new Error("You can only assign calendars that belong to your tenant.");
  }

  return details;
}

function overlaps(startA: Date | string, endA: Date | string, startB: Date | string, endB: Date | string) {
  return new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB);
}

async function assertNoBookingConflict(target: { spaceId?: number; serviceId?: number; inventoryItemId?: number; startTime: Date; endTime: Date; ignoreBookingId?: number }) {
  const allBookings = await storage.getBookings();
  const matching = allBookings.filter((booking) => {
    if (booking.id === target.ignoreBookingId || booking.status === "cancelled") {
      return false;
    }
    if (target.spaceId && booking.spaceId === target.spaceId) {
      return overlaps(target.startTime, target.endTime, booking.startTime, booking.endTime);
    }
    if (target.serviceId && booking.serviceId === target.serviceId) {
      return overlaps(target.startTime, target.endTime, booking.startTime, booking.endTime);
    }
    if (target.inventoryItemId && booking.inventoryItemId === target.inventoryItemId) {
      return overlaps(target.startTime, target.endTime, booking.startTime, booking.endTime);
    }
    return false;
  });

  if (matching.length > 0) {
    throw new Error("That time is already reserved. Pick another slot.");
  }
}

async function syncConfirmedBooking(booking: Booking) {
  if (!booking.calendarResourceId) {
    return booking;
  }

  const details = await storage.getCalendarResourceWithConnection(booking.calendarResourceId);
  if (!details) {
    return storage.updateBooking(booking.id, {
      syncState: "sync_failed",
      syncError: "Assigned calendar is missing.",
    });
  }

  try {
    const syncResult = await syncBookingToCalendar(booking, details);
    await storage.updateCalendarConnection(details.connection.id, {
      syncStatus: "connected",
      lastSyncedAt: new Date(),
    });
    return storage.updateBooking(booking.id, syncResult);
  } catch (error) {
    await storage.updateCalendarConnection(details.connection.id, {
      syncStatus: "sync_failed",
      lastSyncedAt: new Date(),
    });
    return storage.updateBooking(booking.id, {
      syncState: "sync_failed",
      syncError: error instanceof Error ? error.message : "Calendar sync failed.",
    });
  }
}

async function finalizeConfirmedBooking(booking: Booking, previousStatus?: string) {
  const syncedBooking = await syncConfirmedBooking(booking);
  if (previousStatus !== "confirmed" && syncedBooking.guestEmail) {
    try {
      await sendBookingConfirmationEmail(syncedBooking);
    } catch (error) {
      console.error("Failed to send booking confirmation email:", error);
    }

    try {
      await scheduleBookingReminder(syncedBooking);
    } catch (error) {
      console.error("Failed to schedule booking reminder:", error);
    }
  }
  return syncedBooking;
}

async function deleteSyncedBooking(booking: Booking) {
  if (!booking.calendarResourceId || !booking.externalEventId) {
    return;
  }

  const details = await storage.getCalendarResourceWithConnection(booking.calendarResourceId);
  if (!details) {
    return;
  }

  try {
    await deleteBookingFromCalendar(booking, details);
    await storage.updateCalendarConnection(details.connection.id, {
      syncStatus: "connected",
      lastSyncedAt: new Date(),
    });
  } catch (error) {
    await storage.updateBooking(booking.id, {
      syncState: "sync_failed",
      syncError: error instanceof Error ? error.message : "Calendar delete failed.",
    });
  }
}

async function resolveBookableTarget(input: { spaceId?: number; serviceId?: number; inventoryItemId?: number }) {
  if (input.serviceId) {
    const service = await storage.getService(input.serviceId);
    if (!service) {
      throw new Error("Service not found.");
    }
    if (!service.calendarResourceId) {
      throw new Error("This service is not ready for bookings yet.");
    }
    return {
      tenantId: service.tenantId,
      calendarResourceId: service.calendarResourceId,
      resource: service,
    };
  }

  if (input.spaceId) {
    const space = await storage.getSpace(input.spaceId);
    if (!space) {
      throw new Error("Space not found.");
    }
    if (!space.isBookable || !space.calendarResourceId || !space.tenantId) {
      throw new Error("This space is not ready for bookings yet.");
    }
    return {
      tenantId: space.tenantId,
      calendarResourceId: space.calendarResourceId,
      resource: space,
    };
  }

  if (input.inventoryItemId) {
    const item = await storage.getInventoryItem(input.inventoryItemId);
    if (!item) {
      throw new Error("Inventory item not found.");
    }
    if (!item.isAvailableForHire || !item.calendarResourceId) {
      throw new Error("This item is not ready for reservations yet.");
    }
    return {
      tenantId: item.ownerId,
      calendarResourceId: item.calendarResourceId,
      resource: item,
    };
  }

  throw new Error("Choose a service, space, or rentable item.");
}

async function seedDatabase() {
  const demoUserId = "demo-user-123";
  await storage.upsertProfile(demoUserId, {
    role: "tenant",
    tenantName: "Demo Studio",
    displayName: "Demo Studio",
    publicSlug: "demo-studio",
    tagline: "Creative production, portrait sessions, and studio hire.",
    heroTitle: "Book time with Demo Studio",
    heroDescription: "A tenant-facing backend and a branded public booking page in one place.",
    bio: "Demo Studio is a multi-disciplinary creative workspace built to test real tenant flows.",
    contactEmail: "bookings@demostudio.local",
    contactPhone: "+61 2 5555 0101",
    websiteUrl: "https://demo.justso.studio",
    instagramUrl: "https://instagram.com/demostudio",
    bookingNotes: "Bookings are confirmed once we verify your email.",
    bookingTerms: "Please arrive on time. Cancellations within 24 hours may incur a fee.",
  });

  const existingConnections = await storage.getCalendarConnectionsByTenant(demoUserId);
  if (existingConnections.length === 0) {
    await storage.createConnectionWithResource(
      demoUserId,
      {
        name: "Main Studio Calendar",
        provider: "internal",
        calendarUrl: null,
        username: null,
        password: null,
        isActive: true,
      },
      {
        name: "Main Studio Calendar",
        remoteId: "main-studio",
        color: "#111827",
        isReadOnly: false,
      },
    );
    await storage.createConnectionWithResource(
      demoUserId,
      {
        name: "Brand Sessions",
        provider: "internal",
        calendarUrl: null,
        username: null,
        password: null,
        isActive: true,
      },
      {
        name: "Brand Sessions",
        remoteId: "brand-sessions",
        color: "#0f766e",
        isReadOnly: false,
      },
    );
  }

  const resources = await storage.getCalendarResourcesByTenant(demoUserId);
  const mainCalendar = resources[0];
  const servicesCalendar = resources[1] || resources[0];

  const existingSpaces = await storage.getSpaces();
  if (existingSpaces.length === 0 && mainCalendar) {
    await storage.createSpace(demoUserId, {
      name: "Main Studio Room",
      description: "Large open space for photography and intimate production days.",
      capacity: 25,
      isActive: true,
      isBookable: true,
      isStorageLocation: false,
      parentId: null,
      teamId: null,
      visibility: "public",
      calendarResourceId: mainCalendar.id,
    });
  }

  const existingServices = await storage.getServices();
  if (existingServices.length === 0 && servicesCalendar) {
    await storage.createService(demoUserId, {
      name: "Brand Portrait Session",
      description: "A guided portrait session for founders, creatives, and small teams.",
      price: 450,
      durationMinutes: 90,
      locationType: "internal",
      locationSpaceId: null,
      locationAddress: null,
      locationLat: null,
      locationLng: null,
      teamId: null,
      visibility: "public",
      calendarResourceId: servicesCalendar.id,
    });
  }

  const existingItems = await storage.getInventoryItems();
  if (existingItems.length === 0 && servicesCalendar) {
    await storage.createInventoryItem(demoUserId, {
      name: "Sony A7IV",
      description: "Mirrorless camera body for short tenant hires.",
      category: "Cameras",
      isAvailableForHire: true,
      condition: "good",
      storageLocationId: null,
      teamId: null,
      visibility: "public",
      calendarResourceId: servicesCalendar.id,
    });
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  const requireAuth = isAuthenticated;

  app.get(api.profiles.me.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(ctx.profile);
  });

  app.put(api.profiles.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const existingBySlug = req.body.publicSlug ? await storage.getProfileBySlug(slugify(req.body.publicSlug)) : undefined;
      if (existingBySlug && existingBySlug.userId !== ctx.userId) {
        return res.status(400).json({ message: "That public page slug is already taken." });
      }

      const normalized = normalizeProfileInput(req.body, ctx.profile);
      const profile = await storage.upsertProfile(ctx.userId, normalized);
      res.json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.post("/api/login-demo", async (req: any, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ message: "Not found" });
    }

    const demoUser = {
      id: "demo-user-123",
      firstName: "Demo",
      lastName: "Tenant",
      email: "demo@example.com",
    };

    req.session.user = demoUser;
    req.session.save(async (err: any) => {
      if (err) {
        return res.status(500).json({ message: "Session error" });
      }

      await storage.upsertProfile(demoUser.id, {
        role: "tenant",
        tenantName: "Demo Studio",
        displayName: "Demo Studio",
        publicSlug: "demo-studio",
      });
      res.json({ message: "Logged in as demo user", user: demoUser });
    });
  });

  app.post("/api/login-demo-admin", async (req: any, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ message: "Not found" });
    }

    const demoUser = {
      id: "demo-admin-123",
      firstName: "Demo",
      lastName: "Admin",
      email: "admin@example.com",
    };

    req.session.user = demoUser;
    req.session.save(async (err: any) => {
      if (err) {
        return res.status(500).json({ message: "Session error" });
      }

      await storage.upsertProfile(demoUser.id, {
        role: "admin",
        tenantName: "JustSo. Studios",
        displayName: "JustSo. Studios",
        publicSlug: "justso-studios",
        tagline: "Tenant backend and platform controls.",
        heroTitle: "Run the platform and support tenants.",
        heroDescription: "Admin works like a tenant workspace with app-wide privileges layered on top.",
        contactEmail: "hello@justso.studio",
        brandColor: "#0f172a",
      });
      res.json({ message: "Logged in as demo admin", user: demoUser });
    });
  });

  app.post("/api/logout", (req: any, res) => {
    const finish = () => {
      req.session?.destroy?.(() => {
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out" });
      });
    };

    if (req.logout) {
      req.logout(finish);
      return;
    }

    finish();
  });

  app.get(api.admin.emailSettings.get.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      requireAdminProfile(ctx);
      res.json(await emailService.getMaskedSettings());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Forbidden";
      res.status(message === "Unauthorized" ? 401 : 403).json({ message });
    }
  });

  app.put(api.admin.emailSettings.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      requireAdminProfile(ctx);
      const input = api.admin.emailSettings.update.input.parse(req.body);
      const existing = await storage.getEmailSettings();
      const smtpPassword = input.smtpPassword || (existing ? "preserve-existing" : "");
      if (!smtpPassword) {
        return res.status(400).json({ message: "SMTP password is required the first time email settings are configured." });
      }
      const decryptedPassword =
        smtpPassword === "preserve-existing" && existing
          ? emailService.getDecryptedPassword(existing)
          : smtpPassword;

      const decryptedSettings = {
        id: 0,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpUsername: input.smtpUsername,
        smtpPasswordEncrypted: "",
        smtpPassword: decryptedPassword,
        securityMode: input.securityMode,
        fromName: input.fromName,
        fromEmail: input.fromEmail,
        replyToEmail: input.replyToEmail || null,
        enabled: input.enabled,
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestError: null,
        updatedAt: new Date(),
      };

      if (input.enabled) {
        await emailService.verifyTransport(decryptedSettings);
      }

      const settings = await storage.upsertEmailSettings({
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpUsername: input.smtpUsername,
        smtpPasswordEncrypted: smtpPassword === "preserve-existing" && existing ? existing.smtpPasswordEncrypted : encryptSecret(decryptedPassword),
        securityMode: input.securityMode,
        fromName: input.fromName,
        fromEmail: input.fromEmail,
        replyToEmail: input.replyToEmail || null,
        enabled: input.enabled,
        lastTestedAt: existing?.lastTestedAt || null,
        lastTestStatus: existing?.lastTestStatus || null,
        lastTestError: existing?.lastTestError || null,
      });

      res.json({ ...settings, smtpPasswordEncrypted: "•••• saved" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to save email settings" });
    }
  });

  app.post(api.admin.emailSettings.test.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      requireAdminProfile(ctx);
      const input = api.admin.emailSettings.test.input.parse(req.body);
      await emailService.sendTestEmail(input.email);
      await storage.updateEmailSettingsStatus({
        lastTestedAt: new Date(),
        lastTestStatus: "success",
        lastTestError: null,
      });
      res.json({ message: "Test email sent" });
    } catch (error) {
      await storage.updateEmailSettingsStatus({
        lastTestedAt: new Date(),
        lastTestStatus: "failed",
        lastTestError: error instanceof Error ? error.message : "Test email failed",
      });
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(error instanceof EmailConfigurationError ? 400 : 500).json({ message: error instanceof Error ? error.message : "Failed to send test email" });
    }
  });

  app.get(api.admin.emailSettings.health.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      requireAdminProfile(ctx);
      const settings = await storage.getEmailSettings();
      const reminders = await storage.getBookingReminders();
      const failedReminder = reminders.find((reminder) => reminder.status === "failed" && reminder.lastError);
      res.json({
        configured: !!settings,
        enabled: !!settings?.enabled,
        pendingReminders: reminders.filter((reminder) => reminder.status === "pending").length,
        failedReminders: reminders.filter((reminder) => reminder.status === "failed").length,
        lastReminderError: failedReminder?.lastError || null,
        lastTestedAt: settings?.lastTestedAt ? settings.lastTestedAt.toISOString() : null,
        lastTestStatus: settings?.lastTestStatus || null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Forbidden";
      res.status(message === "Unauthorized" ? 401 : 403).json({ message });
    }
  });

  app.get(api.admin.emailSettings.reminders.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      requireAdminProfile(ctx);
      res.json(await storage.getBookingReminders());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Forbidden";
      res.status(message === "Unauthorized" ? 401 : 403).json({ message });
    }
  });

  app.get(api.calendars.connections.list.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const connections = await storage.getCalendarConnectionsByTenant(ctx.userId);
    res.json(connections);
  });

  app.get(api.calendars.resources.list.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const resources = await storage.getCalendarResourcesByTenant(ctx.userId);
    res.json(resources);
  });

  app.post(api.calendars.connections.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const input = api.calendars.connections.create.input.parse(req.body);
      providerEnum.parse(input.provider);
      const { resourceName, resourceColor, ...connectionInput } = input;

      const result = await storage.createConnectionWithResource(
        ctx.userId,
        connectionInput,
        {
          name: resourceName,
          remoteId: connectionInput.provider === "internal" ? slugify(resourceName) : connectionInput.calendarUrl || slugify(resourceName),
          color: resourceColor || ctx.profile.brandColor || "#111827",
          isReadOnly: false,
        },
      );

      res.status(201).json({ ...result.connection, resourceId: result.resource.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.delete(api.calendars.connections.delete.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const connection = await storage.getCalendarConnection(Number(req.params.id));
    if (!connection) {
      return res.status(404).json({ message: "Calendar connection not found" });
    }
    if (connection.tenantId !== ctx.userId && ctx.profile.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    await storage.deleteCalendarConnection(connection.id);
    res.json({ message: "Calendar connection removed" });
  });

  app.get(api.teams.list.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (ctx.profile.role === "admin") {
      return res.json(await storage.getTeams());
    }
    return res.json(await storage.getTeamsByOwner(ctx.userId));
  });

  app.post(api.teams.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const team = await storage.createTeam(ctx.userId, api.teams.create.input.parse(req.body));
      res.status(201).json(team);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.put(api.teams.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const team = await storage.getTeam(Number(req.params.id));
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      if (team.ownerId !== ctx.userId && ctx.profile.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const updated = await storage.updateTeam(team.id, api.teams.update.input.parse(req.body));
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.delete(api.teams.delete.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const team = await storage.getTeam(Number(req.params.id));
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }
    if (team.ownerId !== ctx.userId && ctx.profile.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteTeam(team.id);
    res.json({ message: "Team deleted" });
  });

  app.get(api.teams.members.list.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const team = await storage.getTeam(Number(req.params.id));
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }
    if (team.ownerId !== ctx.userId && !ctx.teamIds.includes(team.id) && ctx.profile.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(await storage.getTeamMembers(team.id));
  });

  app.post(api.teams.members.add.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const team = await storage.getTeam(Number(req.params.id));
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      if (team.ownerId !== ctx.userId && ctx.profile.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const input = api.teams.members.add.input.parse(req.body);
      const member = await storage.addTeamMember(team.id, input.userId, input.role || "member");
      res.status(201).json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.delete(api.teams.members.remove.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const team = await storage.getTeam(Number(req.params.id));
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }
    if (team.ownerId !== ctx.userId && ctx.profile.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.removeTeamMember(team.id, req.params.userId);
    res.json({ message: "Member removed" });
  });

  app.get("/api/config/google-maps-key", requireAuth, (_req, res) => {
    res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY || "" });
  });

  app.get(api.spaces.list.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const allSpaces = await storage.getSpaces();
    const scoped = ctx.profile.role === "admin"
      ? allSpaces
      : allSpaces.filter((space) => space.tenantId === ctx.userId || filterByVisibility([space], ctx.profile.role, ctx.userId, ctx.teamIds).length > 0);
    res.json(scoped);
  });

  app.get("/api/spaces/storage-locations", requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const scoped = (await storage.getSpaces()).filter((space) => space.isStorageLocation && (ctx.profile.role === "admin" || space.tenantId === ctx.userId));
    res.json(scoped);
  });

  app.post(api.spaces.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const input = api.spaces.create.input.parse(req.body);
      visibilityEnum.parse(input.visibility);
      if (input.isBookable) {
        await requireCalendarResourceForTenant(input.calendarResourceId, ctx.userId, ctx.profile.role === "admin");
      }
      const created = await storage.createSpace(ctx.userId, input);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create space" });
    }
  });

  app.put(api.spaces.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const existing = await storage.getSpace(Number(req.params.id));
      if (!existing) {
        return res.status(404).json({ message: "Space not found" });
      }
      if (existing.tenantId !== ctx.userId && ctx.profile.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const input = api.spaces.update.input.parse(req.body);
      if ((input.isBookable ?? existing.isBookable) && (input.calendarResourceId ?? existing.calendarResourceId)) {
        await requireCalendarResourceForTenant(input.calendarResourceId ?? existing.calendarResourceId, existing.tenantId || ctx.userId, ctx.profile.role === "admin");
      } else if (input.isBookable ?? existing.isBookable) {
        throw new Error("Bookable spaces need a calendar assignment.");
      }
      const updated = await storage.updateSpace(existing.id, input);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update space" });
    }
  });

  app.delete(api.spaces.delete.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const existing = await storage.getSpace(Number(req.params.id));
    if (!existing) {
      return res.status(404).json({ message: "Space not found" });
    }
    if (existing.tenantId !== ctx.userId && ctx.profile.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteSpace(existing.id);
    res.json({ message: "Space deleted" });
  });

  app.get(api.services.list.path, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    const allServices = await storage.getServices();
    if (!ctx) {
      return res.json(allServices.filter((service) => service.visibility === "public"));
    }
    const filtered = ctx.profile.role === "admin"
      ? allServices
      : filterByVisibility(allServices, ctx.profile.role, ctx.userId, ctx.teamIds, (service) => service.tenantId).filter((service) => service.tenantId === ctx.userId || service.visibility !== "private");
    res.json(filtered);
  });

  app.post(api.services.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const bodySchema = api.services.create.input.extend({
        price: z.coerce.number().min(0),
        durationMinutes: z.coerce.number().min(15),
      });
      const input = bodySchema.parse(req.body);
      visibilityEnum.parse(input.visibility);
      await requireCalendarResourceForTenant(input.calendarResourceId, ctx.userId, ctx.profile.role === "admin");
      const created = await storage.createService(ctx.userId, input);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create service" });
    }
  });

  app.put(api.services.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const existing = await storage.getService(Number(req.params.id));
      if (!existing) {
        return res.status(404).json({ message: "Service not found" });
      }
      if (!(await canManageTeamResource(existing.teamId, ctx.profile.role, ctx.userId, ctx.teamIds, existing.tenantId))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const bodySchema = api.services.update.input.extend({
        price: z.coerce.number().optional(),
        durationMinutes: z.coerce.number().optional(),
      });
      const input = bodySchema.parse(req.body);
      visibilityEnum.parse((input.visibility || existing.visibility) as string);
      await requireCalendarResourceForTenant(input.calendarResourceId ?? existing.calendarResourceId, existing.tenantId, ctx.profile.role === "admin");
      const updated = await storage.updateService(existing.id, input);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update service" });
    }
  });

  app.delete(api.services.delete.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const existing = await storage.getService(Number(req.params.id));
    if (!existing) {
      return res.status(404).json({ message: "Service not found" });
    }
    if (!(await canManageTeamResource(existing.teamId, ctx.profile.role, ctx.userId, ctx.teamIds, existing.tenantId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteService(existing.id);
    res.json({ message: "Service deleted" });
  });

  app.get(api.inventory.list.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const allItems = await storage.getInventoryItems();
    const filtered = ctx.profile.role === "admin"
      ? allItems
      : filterByVisibility(allItems, ctx.profile.role, ctx.userId, ctx.teamIds, (item) => item.ownerId).filter((item) => item.ownerId === ctx.userId || item.visibility !== "private");
    res.json(filtered);
  });

  app.post(api.inventory.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const input = api.inventory.create.input.parse(req.body);
      visibilityEnum.parse(input.visibility);
      if (input.isAvailableForHire) {
        await requireCalendarResourceForTenant(input.calendarResourceId, ctx.userId, ctx.profile.role === "admin");
      }
      const created = await storage.createInventoryItem(ctx.userId, input);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create item" });
    }
  });

  app.put(api.inventory.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const existing = await storage.getInventoryItem(Number(req.params.id));
      if (!existing) {
        return res.status(404).json({ message: "Item not found" });
      }
      if (!(await canManageTeamResource(existing.teamId, ctx.profile.role, ctx.userId, ctx.teamIds, existing.ownerId))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const input = api.inventory.update.input.parse(req.body);
      if (input.isAvailableForHire ?? existing.isAvailableForHire) {
        await requireCalendarResourceForTenant(input.calendarResourceId ?? existing.calendarResourceId, existing.ownerId, ctx.profile.role === "admin");
      }
      const updated = await storage.updateInventoryItem(existing.id, input);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update item" });
    }
  });

  app.delete(api.inventory.delete.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const existing = await storage.getInventoryItem(Number(req.params.id));
    if (!existing) {
      return res.status(404).json({ message: "Item not found" });
    }
    if (!(await canManageTeamResource(existing.teamId, ctx.profile.role, ctx.userId, ctx.teamIds, existing.ownerId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteInventoryItem(existing.id);
    res.json({ message: "Item deleted" });
  });

  app.get(api.bookings.list.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const allBookings = await storage.getBookings();
    const scoped = ctx.profile.role === "admin"
      ? allBookings
      : allBookings.filter((booking) => booking.tenantId === ctx.userId);
    res.json(scoped);
  });

  app.post(api.bookings.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const bodySchema = api.bookings.create.input.extend({
        spaceId: z.coerce.number().optional(),
        serviceId: z.coerce.number().optional(),
        inventoryItemId: z.coerce.number().optional(),
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
      });
      const input = bodySchema.parse(req.body);
      const target = await resolveBookableTarget(input);
      if (target.tenantId !== ctx.userId && ctx.profile.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      await assertNoBookingConflict({
        spaceId: input.spaceId,
        serviceId: input.serviceId,
        inventoryItemId: input.inventoryItemId,
        startTime: input.startTime,
        endTime: input.endTime,
      });
      let created = await storage.createBooking(ctx.userId, {
        ...input,
        tenantId: target.tenantId,
        calendarResourceId: target.calendarResourceId,
        status: "confirmed",
        syncState: "pending",
      });
      created = await finalizeConfirmedBooking(created);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create booking" });
    }
  });

  app.put(api.bookings.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const existing = await storage.getBooking(Number(req.params.id));
      if (!existing) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (existing.tenantId !== ctx.userId && ctx.profile.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const bodySchema = api.bookings.update.input.extend({
        spaceId: z.coerce.number().optional(),
        serviceId: z.coerce.number().optional(),
        inventoryItemId: z.coerce.number().optional(),
        startTime: z.coerce.date().optional(),
        endTime: z.coerce.date().optional(),
      });
      const input = bodySchema.parse(req.body);

      if ((input.status || existing.status) === "cancelled") {
        await deleteSyncedBooking(existing);
      }

      const updated = await storage.updateBooking(existing.id, input);
      if (updated.status === "confirmed") {
        const synced = await finalizeConfirmedBooking(updated, existing.status);
        return res.json(synced);
      }
      if (existing.status === "confirmed" && updated.status === "cancelled" && updated.guestEmail) {
        await storage.cancelBookingRemindersForBooking(updated.id);
        try {
          await sendBookingCancellationEmail(updated);
        } catch (error) {
          console.error("Failed to send booking cancellation email:", error);
        }
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update booking" });
    }
  });

  app.get(api.hires.list.path, requireAuth, async (req: any, res) => {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const hires = await storage.getInventoryHires();
    const items = await storage.getInventoryItems();
    const allowedIds = new Set(items.filter((item) => ctx.profile.role === "admin" || item.ownerId === ctx.userId).map((item) => item.id));
    res.json(hires.filter((hire) => allowedIds.has(hire.itemId)));
  });

  app.post(api.hires.create.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const bodySchema = api.hires.create.input.extend({
        itemId: z.coerce.number(),
        bookingId: z.coerce.number().optional(),
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
      });
      const input = bodySchema.parse(req.body);
      const item = await storage.getInventoryItem(input.itemId);
      if (!item) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      if (item.ownerId !== ctx.userId && ctx.profile.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const hire = await storage.createInventoryHire(ctx.userId, input);
      res.status(201).json(hire);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.put(api.hires.update.path, requireAuth, async (req: any, res) => {
    try {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return res.status(401).json({ message: "Unauthorized" });
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.get("/api/public/tenant/:slug", async (req, res) => {
    const profile = await storage.getProfileBySlug(req.params.slug);
    if (!profile) {
      return res.status(404).json({ message: "Tenant page not found" });
    }

    const [allServices, allSpaces, allItems, resources] = await Promise.all([
      storage.getServices(),
      storage.getSpaces(),
      storage.getInventoryItems(),
      storage.getCalendarResourcesByTenant(profile.userId),
    ]);

    res.json({
      profile,
      services: allServices.filter((service) => service.tenantId === profile.userId && service.visibility === "public"),
      spaces: allSpaces.filter((space) => space.tenantId === profile.userId && space.visibility === "public" && space.isBookable),
      inventory: allItems.filter((item) => item.ownerId === profile.userId && item.visibility === "public" && item.isAvailableForHire),
      calendars: resources,
    });
  });

  app.get("/api/public/calendars/:id.ics", async (req, res) => {
    const details = await storage.getCalendarResourceWithConnection(Number(req.params.id));
    if (!details) {
      return res.status(404).send("Calendar not found");
    }
    if (details.connection.provider !== "internal") {
      return res.status(400).send("Only internal calendars expose an ICS feed.");
    }

    const bookings = (await storage.getBookings()).filter(
      (booking) => booking.calendarResourceId === details.resource.id && booking.status === "confirmed",
    );
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.send(buildInternalCalendarIcs(details.resource.name, bookings));
  });

  app.post("/api/public/bookings/start", async (req, res) => {
    try {
      const bodySchema = z.object({
        guestName: z.string().min(1, "Guest name is required"),
        guestEmail: z.string().email("Valid email is required"),
        spaceId: z.coerce.number().optional(),
        serviceId: z.coerce.number().optional(),
        inventoryItemId: z.coerce.number().optional(),
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
        notes: z.string().optional(),
      });
      const input = bodySchema.parse(req.body);
      const target = await resolveBookableTarget(input);
      await assertNoBookingConflict({
        spaceId: input.spaceId,
        serviceId: input.serviceId,
        inventoryItemId: input.inventoryItemId,
        startTime: input.startTime,
        endTime: input.endTime,
      });
      const booking = await storage.createBooking(null, {
        ...input,
        tenantId: target.tenantId,
        calendarResourceId: target.calendarResourceId,
        status: "pending",
        syncState: "pending",
      });
      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to start booking" });
    }
  });

  app.post("/api/public/send-verification", async (req, res) => {
    try {
      const bodySchema = z.object({
        email: z.string().email(),
        bookingId: z.coerce.number(),
      });
      const input = bodySchema.parse(req.body);
      const booking = await storage.getBooking(input.bookingId);
      if (!booking || booking.guestEmail !== input.email) {
        return res.status(400).json({ message: "Booking not found or email mismatch" });
      }
      const code = emailService.generateCode();
      await storage.deleteVerificationCodesForBooking(input.email, input.bookingId);
      await storage.createVerificationCode(input.email, code, input.bookingId, new Date(Date.now() + 10 * 60 * 1000));
      const context = await getBookingEmailContext(booking);
      await emailService.sendVerificationCode(input.email, code, context.tenantDisplayName);
      res.json({ message: "Verification code sent" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(error instanceof EmailConfigurationError ? 400 : 500).json({ message: error instanceof Error ? error.message : "Failed to send verification code" });
    }
  });

  app.post("/api/public/bookings/verify", async (req, res) => {
    try {
      const bodySchema = z.object({
        email: z.string().email(),
        code: z.string().min(6),
        bookingId: z.coerce.number(),
      });
      const input = bodySchema.parse(req.body);
      const verificationCode = await storage.getVerificationCode(input.email, input.code);
      if (!verificationCode || verificationCode.bookingId !== input.bookingId || verificationCode.expiresAt < new Date()) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
      }
      let booking = await storage.updateBooking(input.bookingId, { status: "confirmed" });
      booking = await finalizeConfirmedBooking(booking, "pending");
      await storage.deleteVerificationCode(verificationCode.id);
      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  app.post("/api/public/signup", async (_req, res) => {
    res.json({
      message: "Public bookings only require email verification in this version.",
      redirectUrl: "/",
    });
  });

  try {
    await seedDatabase();
  } catch (error) {
    console.error("Skipping seed data:", error);
  }

  return httpServer;
}
