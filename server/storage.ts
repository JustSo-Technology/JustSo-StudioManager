import { db } from "./db";
import { eq, and, or, inArray } from "drizzle-orm";
import {
  userProfiles, teams, teamMembers, spaces, services, bookings, inventoryItems, inventoryHires, emailVerificationCodes,
  type UserProfile, type Team, type TeamMember, type Space, type Service, type Booking, type InventoryItem, type InventoryHire, type EmailVerificationCode,
  type CreateTeamRequest, type UpdateTeamRequest,
  type CreateSpaceRequest, type UpdateSpaceRequest,
  type CreateServiceRequest, type UpdateServiceRequest,
  type CreateBookingRequest, type UpdateBookingRequest,
  type CreateInventoryItemRequest, type UpdateInventoryItemRequest,
  type CreateInventoryHireRequest, type UpdateInventoryHireRequest
} from "@shared/schema";

export interface IStorage {
  getProfile(userId: string): Promise<UserProfile | undefined>;
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

  getSpaces(): Promise<Space[]>;
  createSpace(space: CreateSpaceRequest): Promise<Space>;
  updateSpace(id: number, updates: UpdateSpaceRequest): Promise<Space>;
  deleteSpace(id: number): Promise<void>;

  getServices(): Promise<Service[]>;
  createService(tenantId: string, service: CreateServiceRequest): Promise<Service>;
  updateService(id: number, updates: UpdateServiceRequest): Promise<Service>;
  deleteService(id: number): Promise<void>;

  getBookings(): Promise<Booking[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  createBooking(userId: string | null, booking: CreateBookingRequest & { guestEmail?: string | null; guestName?: string | null }): Promise<Booking>;
  updateBooking(id: number, updates: UpdateBookingRequest): Promise<Booking>;

  createVerificationCode(email: string, code: string, bookingId: number, expiresAt: Date): Promise<EmailVerificationCode>;
  getVerificationCode(email: string, code: string): Promise<EmailVerificationCode | undefined>;
  deleteVerificationCode(id: number): Promise<void>;

  getInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItem(id: number): Promise<InventoryItem | undefined>;
  createInventoryItem(ownerId: string, item: CreateInventoryItemRequest): Promise<InventoryItem>;
  updateInventoryItem(id: number, updates: UpdateInventoryItemRequest): Promise<InventoryItem>;
  deleteInventoryItem(id: number): Promise<void>;

  getInventoryHires(): Promise<InventoryHire[]>;
  createInventoryHire(borrowerId: string, hire: CreateInventoryHireRequest): Promise<InventoryHire>;
  updateInventoryHire(id: number, updates: UpdateInventoryHireRequest): Promise<InventoryHire>;
}

export class DatabaseStorage implements IStorage {
  async getProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async upsertProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile> {
    const [existing] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    if (existing) {
      const [updated] = await db.update(userProfiles).set(profile).where(eq(userProfiles.userId, userId)).returning();
      return updated;
    } else {
      const [created] = await db.insert(userProfiles).values({ userId, role: 'user', ...profile }).returning();
      return created;
    }
  }

  async getTeams(): Promise<Team[]> {
    return await db.select().from(teams);
  }

  async getTeamsByOwner(ownerId: string): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.ownerId, ownerId));
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async createTeam(ownerId: string, team: CreateTeamRequest): Promise<Team> {
    const [created] = await db.insert(teams).values({ ...team, ownerId }).returning();
    await db.insert(teamMembers).values({ teamId: created.id, userId: ownerId, role: 'manager' });
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
    return await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
  }

  async addTeamMember(teamId: number, userId: string, role: string = 'member'): Promise<TeamMember> {
    const existing = await db.select().from(teamMembers).where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))
    );
    if (existing.length > 0) {
      const [updated] = await db.update(teamMembers).set({ role }).where(
        and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))
      ).returning();
      return updated;
    }
    const [created] = await db.insert(teamMembers).values({ teamId, userId, role }).returning();
    return created;
  }

  async removeTeamMember(teamId: number, userId: string): Promise<void> {
    await db.delete(teamMembers).where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))
    );
  }

  async getUserTeamIds(userId: string): Promise<number[]> {
    const memberships = await db.select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));
    return memberships.map(m => m.teamId);
  }

  async getSpaces(): Promise<Space[]> {
    return await db.select().from(spaces);
  }

  async createSpace(space: CreateSpaceRequest): Promise<Space> {
    const [created] = await db.insert(spaces).values(space).returning();
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
    return await db.select().from(services);
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
    return await db.select().from(bookings);
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async createBooking(userId: string | null, booking: CreateBookingRequest & { guestEmail?: string | null; guestName?: string | null }): Promise<Booking> {
    const [created] = await db.insert(bookings).values({ ...booking, userId, guestEmail: booking.guestEmail, guestName: booking.guestName }).returning();
    return created;
  }

  async updateBooking(id: number, updates: UpdateBookingRequest): Promise<Booking> {
    const [updated] = await db.update(bookings).set(updates).where(eq(bookings.id, id)).returning();
    return updated;
  }

  async createVerificationCode(email: string, code: string, bookingId: number, expiresAt: Date): Promise<EmailVerificationCode> {
    const [created] = await db.insert(emailVerificationCodes).values({ email, code, bookingId, expiresAt }).returning();
    return created;
  }

  async getVerificationCode(email: string, code: string): Promise<EmailVerificationCode | undefined> {
    const [found] = await db.select().from(emailVerificationCodes).where(and(eq(emailVerificationCodes.email, email), eq(emailVerificationCodes.code, code)));
    return found;
  }

  async deleteVerificationCode(id: number): Promise<void> {
    await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.id, id));
  }

  async getInventoryItems(): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems);
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
    return await db.select().from(inventoryHires);
  }

  async createInventoryHire(borrowerId: string, hire: CreateInventoryHireRequest): Promise<InventoryHire> {
    const [created] = await db.insert(inventoryHires).values({ ...hire, borrowerId }).returning();
    return created;
  }

  async updateInventoryHire(id: number, updates: UpdateInventoryHireRequest): Promise<InventoryHire> {
    const [updated] = await db.update(inventoryHires).set(updates).where(eq(inventoryHires.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
