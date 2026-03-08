import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export * from "./models/auth";

export const userProfiles = pgTable("user_profiles", {
  userId: varchar("user_id").primaryKey(),
  role: text("role").notNull().default("user"),
  tenantName: text("tenant_name"),
  bio: text("bio"),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: varchar("owner_id").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("member"),
});

export const spaces = pgTable("spaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  capacity: integer("capacity"),
  isActive: boolean("is_active").default(true),
  parentId: integer("parent_id"),
  isStorageLocation: boolean("is_storage_location").default(false),
  isBookable: boolean("is_bookable").default(true),
  teamId: integer("team_id"),
  visibility: text("visibility").notNull().default("all_tenants"),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  locationType: text("location_type"),
  locationSpaceId: integer("location_space_id"),
  locationAddress: text("location_address"),
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  teamId: integer("team_id"),
  visibility: text("visibility").notNull().default("public"),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  guestEmail: varchar("guest_email"),
  guestName: varchar("guest_name"),
  spaceId: integer("space_id"),
  serviceId: integer("service_id"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default("confirmed"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  isAvailableForHire: boolean("is_available_for_hire").default(false),
  condition: text("condition").default("good"),
  storageLocationId: integer("storage_location_id"),
  teamId: integer("team_id"),
  visibility: text("visibility").notNull().default("team"),
});

export const inventoryHires = pgTable("inventory_hires", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  borrowerId: varchar("borrower_id").notNull(),
  bookingId: integer("booking_id"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default("active"),
});

export const emailVerificationCodes = pgTable("email_verification_codes", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull(),
  code: varchar("code").notNull(),
  bookingId: integer("booking_id"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ userId: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, ownerId: true, createdAt: true });
export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({ id: true });
export const insertSpaceSchema = createInsertSchema(spaces).omit({ id: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, tenantId: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, userId: true });
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true, ownerId: true });
export const insertInventoryHireSchema = createInsertSchema(inventoryHires).omit({ id: true, borrowerId: true });

export type UserProfile = typeof userProfiles.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryHire = typeof inventoryHires.$inferSelect;

export type CreateTeamRequest = z.infer<typeof insertTeamSchema>;
export type UpdateTeamRequest = Partial<CreateTeamRequest>;
export type CreateSpaceRequest = z.infer<typeof insertSpaceSchema>;
export type UpdateSpaceRequest = Partial<CreateSpaceRequest>;
export type CreateServiceRequest = z.infer<typeof insertServiceSchema>;
export type UpdateServiceRequest = Partial<CreateServiceRequest>;
export type CreateBookingRequest = z.infer<typeof insertBookingSchema>;
export type UpdateBookingRequest = Partial<CreateBookingRequest>;

export type EmailVerificationCode = typeof emailVerificationCodes.$inferSelect;

export interface GuestBookingInitRequest {
  guestName: string;
  guestEmail: string;
  spaceId?: number;
  serviceId?: number;
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
  bookingId: number;
}

export interface CompleteGuestBookingRequest {
  bookingId: number;
  email: string;
  code: string;
}

export interface GuestSignupRequest {
  bookingId: number;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}
export type CreateInventoryItemRequest = z.infer<typeof insertInventoryItemSchema>;
export type UpdateInventoryItemRequest = Partial<CreateInventoryItemRequest>;
export type CreateInventoryHireRequest = z.infer<typeof insertInventoryHireSchema>;
export type UpdateInventoryHireRequest = Partial<CreateInventoryHireRequest>;

export const VISIBILITY_OPTIONS = ["private", "team", "all_tenants", "public"] as const;
export type Visibility = typeof VISIBILITY_OPTIONS[number];
