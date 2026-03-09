import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "./db";
import {
  bookings,
  bookingEmailReminders,
  calendarConnections,
  calendarResources,
  emailSettings,
  emailVerificationCodes,
  inventoryHires,
  inventoryItems,
  services,
  spaces,
  teamMembers,
  teams,
  userProfiles,
  type Booking,
  type CalendarConnection,
  type CalendarResource,
  type CreateBookingRequest,
  type CreateBookingEmailReminderRequest,
  type CreateCalendarConnectionRequest,
  type CreateCalendarResourceRequest,
  type CreateInventoryHireRequest,
  type CreateInventoryItemRequest,
  type CreateServiceRequest,
  type CreateSpaceRequest,
  type CreateTeamRequest,
  type EmailVerificationCode,
  type EmailSettings,
  type BookingEmailReminder,
  type InventoryHire,
  type InventoryItem,
  type Service,
  type Space,
  type Team,
  type TeamMember,
  type UpdateBookingRequest,
  type UpdateInventoryHireRequest,
  type UpdateInventoryItemRequest,
  type UpdateServiceRequest,
  type UpdateSpaceRequest,
  type UpdateTeamRequest,
  type UserProfile,
} from "@shared/schema";

export interface IStorage {
  getProfile(userId: string): Promise<UserProfile | undefined>;
  getProfileBySlug(publicSlug: string): Promise<UserProfile | undefined>;
  upsertProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile>;

  getTeams(): Promise<Team[]>;
  getTeamsByOwner(ownerId: string): Promise<Team[]>;
  getTeam(id: number): Promise<Team | undefined>;
  createTeam(ownerId: string, team: CreateTeamRequest): Promise<Team>;
  updateTeam(id: number, updates: UpdateTeamRequest): Promise<Team>;
  deleteTeam(id: number): Promise<void>;
  getTeamMembers(teamId: number): Promise<TeamMember[]>;
  addTeamMember(teamId: number, userId: string, role?: string): Promise<TeamMember>;
  removeTeamMember(teamId: number, userId: string): Promise<void>;
  getUserTeamIds(userId: string): Promise<number[]>;

  getCalendarConnectionsByTenant(tenantId: string): Promise<CalendarConnection[]>;
  getCalendarResourcesByTenant(tenantId: string): Promise<CalendarResource[]>;
  getCalendarConnection(id: number): Promise<CalendarConnection | undefined>;
  getCalendarResource(id: number): Promise<CalendarResource | undefined>;
  getCalendarResourceWithConnection(id: number): Promise<{ resource: CalendarResource; connection: CalendarConnection } | undefined>;
  createCalendarConnection(tenantId: string, input: CreateCalendarConnectionRequest): Promise<CalendarConnection>;
  updateCalendarConnection(id: number, updates: Partial<CalendarConnection>): Promise<CalendarConnection>;
  deleteCalendarConnection(id: number): Promise<void>;
  createCalendarResource(tenantId: string, input: CreateCalendarResourceRequest): Promise<CalendarResource>;
  createConnectionWithResource(
    tenantId: string,
    connectionInput: CreateCalendarConnectionRequest,
    resourceInput: Omit<CreateCalendarResourceRequest, "connectionId">,
  ): Promise<{ connection: CalendarConnection; resource: CalendarResource }>;

  getSpaces(): Promise<Space[]>;
  getSpace(id: number): Promise<Space | undefined>;
  createSpace(tenantId: string, space: CreateSpaceRequest): Promise<Space>;
  updateSpace(id: number, updates: UpdateSpaceRequest): Promise<Space>;
  deleteSpace(id: number): Promise<void>;

  getServices(): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(tenantId: string, service: CreateServiceRequest): Promise<Service>;
  updateService(id: number, updates: UpdateServiceRequest): Promise<Service>;
  deleteService(id: number): Promise<void>;

  getBookings(): Promise<Booking[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  createBooking(
    userId: string | null,
    booking: CreateBookingRequest & {
      tenantId?: string | null;
      guestEmail?: string | null;
      guestName?: string | null;
      calendarResourceId?: number | null;
      syncState?: string;
      externalEventId?: string | null;
      syncError?: string | null;
    },
  ): Promise<Booking>;
  updateBooking(id: number, updates: UpdateBookingRequest & Partial<Booking>): Promise<Booking>;

  createVerificationCode(email: string, code: string, bookingId: number, expiresAt: Date): Promise<EmailVerificationCode>;
  getVerificationCode(email: string, code: string): Promise<EmailVerificationCode | undefined>;
  deleteVerificationCode(id: number): Promise<void>;
  deleteVerificationCodesForBooking(email: string, bookingId: number): Promise<void>;

  getInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItem(id: number): Promise<InventoryItem | undefined>;
  createInventoryItem(ownerId: string, item: CreateInventoryItemRequest): Promise<InventoryItem>;
  updateInventoryItem(id: number, updates: UpdateInventoryItemRequest): Promise<InventoryItem>;
  deleteInventoryItem(id: number): Promise<void>;

  getInventoryHires(): Promise<InventoryHire[]>;
  createInventoryHire(borrowerId: string, hire: CreateInventoryHireRequest): Promise<InventoryHire>;
  updateInventoryHire(id: number, updates: UpdateInventoryHireRequest): Promise<InventoryHire>;

  getEmailSettings(): Promise<EmailSettings | undefined>;
  upsertEmailSettings(settings: Omit<EmailSettings, "id" | "lastTestedAt" | "lastTestStatus" | "lastTestError" | "updatedAt"> & Partial<Pick<EmailSettings, "lastTestedAt" | "lastTestStatus" | "lastTestError">>): Promise<EmailSettings>;
  updateEmailSettingsStatus(updates: Partial<Pick<EmailSettings, "lastTestedAt" | "lastTestStatus" | "lastTestError" | "enabled">>): Promise<EmailSettings | undefined>;

  createBookingReminder(reminder: CreateBookingEmailReminderRequest): Promise<BookingEmailReminder>;
  getBookingReminders(): Promise<BookingEmailReminder[]>;
  getBookingRemindersByBooking(bookingId: number): Promise<BookingEmailReminder[]>;
  getPendingDueBookingReminders(now: Date): Promise<BookingEmailReminder[]>;
  updateBookingReminder(id: number, updates: Partial<BookingEmailReminder>): Promise<BookingEmailReminder>;
  cancelBookingRemindersForBooking(bookingId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async getProfileBySlug(publicSlug: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.publicSlug, publicSlug));
    return profile;
  }

  async upsertProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile> {
    const [existing] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    if (existing) {
      const [updated] = await db.update(userProfiles).set(profile).where(eq(userProfiles.userId, userId)).returning();
      return updated;
    }

    const [created] = await db.insert(userProfiles).values({ userId, role: "tenant", ...profile }).returning();
    return created;
  }

  async getTeams(): Promise<Team[]> {
    return db.select().from(teams);
  }

  async getTeamsByOwner(ownerId: string): Promise<Team[]> {
    return db.select().from(teams).where(eq(teams.ownerId, ownerId));
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async createTeam(ownerId: string, team: CreateTeamRequest): Promise<Team> {
    const [created] = await db.insert(teams).values({ ...team, ownerId }).returning();
    await db.insert(teamMembers).values({ teamId: created.id, userId: ownerId, role: "manager" });
    return created;
  }

  async updateTeam(id: number, updates: UpdateTeamRequest): Promise<Team> {
    const [updated] = await db.update(teams).set(updates).where(eq(teams.id, id)).returning();
    return updated;
  }

  async deleteTeam(id: number): Promise<void> {
    await db.delete(teamMembers).where(eq(teamMembers.teamId, id));
    await db.delete(teams).where(eq(teams.id, id));
  }

  async getTeamMembers(teamId: number): Promise<TeamMember[]> {
    return db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
  }

  async addTeamMember(teamId: number, userId: string, role = "member"): Promise<TeamMember> {
    const [existing] = await db.select().from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    if (existing) {
      const [updated] = await db
        .update(teamMembers)
        .set({ role })
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .returning();
      return updated;
    }

    const [created] = await db.insert(teamMembers).values({ teamId, userId, role }).returning();
    return created;
  }

  async removeTeamMember(teamId: number, userId: string): Promise<void> {
    await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  }

  async getUserTeamIds(userId: string): Promise<number[]> {
    const memberships = await db.select({ teamId: teamMembers.teamId }).from(teamMembers).where(eq(teamMembers.userId, userId));
    return memberships.map((membership) => membership.teamId);
  }

  async getCalendarConnectionsByTenant(tenantId: string): Promise<CalendarConnection[]> {
    return db.select().from(calendarConnections).where(eq(calendarConnections.tenantId, tenantId));
  }

  async getCalendarResourcesByTenant(tenantId: string): Promise<CalendarResource[]> {
    return db.select().from(calendarResources).where(eq(calendarResources.tenantId, tenantId));
  }

  async getCalendarConnection(id: number): Promise<CalendarConnection | undefined> {
    const [connection] = await db.select().from(calendarConnections).where(eq(calendarConnections.id, id));
    return connection;
  }

  async getCalendarResource(id: number): Promise<CalendarResource | undefined> {
    const [resource] = await db.select().from(calendarResources).where(eq(calendarResources.id, id));
    return resource;
  }

  async getCalendarResourceWithConnection(id: number): Promise<{ resource: CalendarResource; connection: CalendarConnection } | undefined> {
    const resource = await this.getCalendarResource(id);
    if (!resource) {
      return undefined;
    }

    const connection = await this.getCalendarConnection(resource.connectionId);
    if (!connection) {
      return undefined;
    }

    return { resource, connection };
  }

  async createCalendarConnection(tenantId: string, input: CreateCalendarConnectionRequest): Promise<CalendarConnection> {
    const [created] = await db.insert(calendarConnections).values({ ...input, tenantId }).returning();
    return created;
  }

  async updateCalendarConnection(id: number, updates: Partial<CalendarConnection>): Promise<CalendarConnection> {
    const [updated] = await db.update(calendarConnections).set(updates).where(eq(calendarConnections.id, id)).returning();
    return updated;
  }

  async deleteCalendarConnection(id: number): Promise<void> {
    await db.delete(calendarResources).where(eq(calendarResources.connectionId, id));
    await db.delete(calendarConnections).where(eq(calendarConnections.id, id));
  }

  async createCalendarResource(tenantId: string, input: CreateCalendarResourceRequest): Promise<CalendarResource> {
    const [created] = await db.insert(calendarResources).values({ ...input, tenantId }).returning();
    return created;
  }

  async createConnectionWithResource(
    tenantId: string,
    connectionInput: CreateCalendarConnectionRequest,
    resourceInput: Omit<CreateCalendarResourceRequest, "connectionId">,
  ): Promise<{ connection: CalendarConnection; resource: CalendarResource }> {
    const connection = await this.createCalendarConnection(tenantId, connectionInput);
    const resource = await this.createCalendarResource(tenantId, { ...resourceInput, connectionId: connection.id });
    return { connection, resource };
  }

  async getSpaces(): Promise<Space[]> {
    return db.select().from(spaces);
  }

  async getSpace(id: number): Promise<Space | undefined> {
    const [space] = await db.select().from(spaces).where(eq(spaces.id, id));
    return space;
  }

  async createSpace(tenantId: string, space: CreateSpaceRequest): Promise<Space> {
    const [created] = await db.insert(spaces).values({ ...space, tenantId }).returning();
    return created;
  }

  async updateSpace(id: number, updates: UpdateSpaceRequest): Promise<Space> {
    const [updated] = await db.update(spaces).set(updates).where(eq(spaces.id, id)).returning();
    return updated;
  }

  async deleteSpace(id: number): Promise<void> {
    await db.delete(spaces).where(eq(spaces.id, id));
  }

  async getServices(): Promise<Service[]> {
    return db.select().from(services);
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(tenantId: string, service: CreateServiceRequest): Promise<Service> {
    const [created] = await db.insert(services).values({ ...service, tenantId }).returning();
    return created;
  }

  async updateService(id: number, updates: UpdateServiceRequest): Promise<Service> {
    const [updated] = await db.update(services).set(updates).where(eq(services.id, id)).returning();
    return updated;
  }

  async deleteService(id: number): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  async getBookings(): Promise<Booking[]> {
    return db.select().from(bookings);
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async createBooking(
    userId: string | null,
    booking: CreateBookingRequest & {
      tenantId?: string | null;
      guestEmail?: string | null;
      guestName?: string | null;
      calendarResourceId?: number | null;
      syncState?: string;
      externalEventId?: string | null;
      syncError?: string | null;
    },
  ): Promise<Booking> {
    const [created] = await db
      .insert(bookings)
      .values({
        ...booking,
        userId,
        guestEmail: booking.guestEmail,
        guestName: booking.guestName,
        tenantId: booking.tenantId ?? null,
        calendarResourceId: booking.calendarResourceId ?? null,
        syncState: booking.syncState ?? "not_required",
        externalEventId: booking.externalEventId ?? null,
        syncError: booking.syncError ?? null,
      })
      .returning();
    return created;
  }

  async updateBooking(id: number, updates: UpdateBookingRequest & Partial<Booking>): Promise<Booking> {
    const [updated] = await db.update(bookings).set(updates).where(eq(bookings.id, id)).returning();
    return updated;
  }

  async createVerificationCode(email: string, code: string, bookingId: number, expiresAt: Date): Promise<EmailVerificationCode> {
    const [created] = await db.insert(emailVerificationCodes).values({ email, code, bookingId, expiresAt }).returning();
    return created;
  }

  async getVerificationCode(email: string, code: string): Promise<EmailVerificationCode | undefined> {
    const [verificationCode] = await db
      .select()
      .from(emailVerificationCodes)
      .where(and(eq(emailVerificationCodes.email, email), eq(emailVerificationCodes.code, code)));
    return verificationCode;
  }

  async deleteVerificationCode(id: number): Promise<void> {
    await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.id, id));
  }

  async deleteVerificationCodesForBooking(email: string, bookingId: number): Promise<void> {
    await db
      .delete(emailVerificationCodes)
      .where(and(eq(emailVerificationCodes.email, email), eq(emailVerificationCodes.bookingId, bookingId)));
  }

  async getInventoryItems(): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems);
  }

  async getInventoryItem(id: number): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return item;
  }

  async createInventoryItem(ownerId: string, item: CreateInventoryItemRequest): Promise<InventoryItem> {
    const [created] = await db.insert(inventoryItems).values({ ...item, ownerId }).returning();
    return created;
  }

  async updateInventoryItem(id: number, updates: UpdateInventoryItemRequest): Promise<InventoryItem> {
    const [updated] = await db.update(inventoryItems).set(updates).where(eq(inventoryItems.id, id)).returning();
    return updated;
  }

  async deleteInventoryItem(id: number): Promise<void> {
    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  }

  async getInventoryHires(): Promise<InventoryHire[]> {
    return db.select().from(inventoryHires);
  }

  async createInventoryHire(borrowerId: string, hire: CreateInventoryHireRequest): Promise<InventoryHire> {
    const [created] = await db.insert(inventoryHires).values({ ...hire, borrowerId }).returning();
    return created;
  }

  async updateInventoryHire(id: number, updates: UpdateInventoryHireRequest): Promise<InventoryHire> {
    const [updated] = await db.update(inventoryHires).set(updates).where(eq(inventoryHires.id, id)).returning();
    return updated;
  }

  async getEmailSettings(): Promise<EmailSettings | undefined> {
    const [settings] = await db.select().from(emailSettings).orderBy(emailSettings.id);
    return settings;
  }

  async upsertEmailSettings(
    settings: Omit<EmailSettings, "id" | "lastTestedAt" | "lastTestStatus" | "lastTestError" | "updatedAt"> &
      Partial<Pick<EmailSettings, "lastTestedAt" | "lastTestStatus" | "lastTestError">>,
  ): Promise<EmailSettings> {
    const existing = await this.getEmailSettings();
    if (existing) {
      const [updated] = await db
        .update(emailSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(emailSettings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(emailSettings).values({ ...settings, updatedAt: new Date() }).returning();
    return created;
  }

  async updateEmailSettingsStatus(
    updates: Partial<Pick<EmailSettings, "lastTestedAt" | "lastTestStatus" | "lastTestError" | "enabled">>,
  ): Promise<EmailSettings | undefined> {
    const existing = await this.getEmailSettings();
    if (!existing) {
      return undefined;
    }
    const [updated] = await db
      .update(emailSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailSettings.id, existing.id))
      .returning();
    return updated;
  }

  async createBookingReminder(reminder: CreateBookingEmailReminderRequest): Promise<BookingEmailReminder> {
    const [created] = await db.insert(bookingEmailReminders).values(reminder).returning();
    return created;
  }

  async getBookingReminders(): Promise<BookingEmailReminder[]> {
    return db.select().from(bookingEmailReminders);
  }

  async getBookingRemindersByBooking(bookingId: number): Promise<BookingEmailReminder[]> {
    return db.select().from(bookingEmailReminders).where(eq(bookingEmailReminders.bookingId, bookingId));
  }

  async getPendingDueBookingReminders(now: Date): Promise<BookingEmailReminder[]> {
    return db
      .select()
      .from(bookingEmailReminders)
      .where(and(eq(bookingEmailReminders.status, "pending"), lte(bookingEmailReminders.scheduledFor, now)))
      .orderBy(asc(bookingEmailReminders.scheduledFor));
  }

  async updateBookingReminder(id: number, updates: Partial<BookingEmailReminder>): Promise<BookingEmailReminder> {
    const [updated] = await db.update(bookingEmailReminders).set(updates).where(eq(bookingEmailReminders.id, id)).returning();
    return updated;
  }

  async cancelBookingRemindersForBooking(bookingId: number): Promise<void> {
    await db
      .update(bookingEmailReminders)
      .set({ status: "cancelled" })
      .where(and(eq(bookingEmailReminders.bookingId, bookingId), eq(bookingEmailReminders.status, "pending")));
  }
}

export const storage = new DatabaseStorage();
