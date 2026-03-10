import { boolean, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const APP_ROLE_OPTIONS = ["member", "admin"] as const;
export const STUDIO_ROLE_OPTIONS = ["STUDIO_OWNER", "STUDIO_ADMIN", "STUDIO_MEMBER"] as const;
export const ORGANISATION_ROLE_OPTIONS = ["ORG_OWNER", "ORG_ADMIN", "ORG_MEMBER"] as const;
export const TEAM_ROLE_OPTIONS = ["TEAM_ADMIN", "TEAM_MEMBER"] as const;
export const ORGANISATION_INVITE_STATUS_OPTIONS = ["pending", "accepted", "revoked", "expired"] as const;
export const VISIBILITY_OPTIONS = ["private", "team", "all_tenants", "public"] as const;
export const CALENDAR_PROVIDER_OPTIONS = ["internal", "caldav"] as const;
export const CALENDAR_SYNC_STATUS_OPTIONS = ["connected", "pending", "sync_failed", "disconnected"] as const;
export const BOOKING_STATUS_OPTIONS = ["pending", "confirmed", "cancelled"] as const;
export const RESERVATION_SYNC_STATE_OPTIONS = ["not_required", "pending", "synced", "sync_failed"] as const;
export const EMAIL_SECURITY_MODE_OPTIONS = ["none", "starttls", "ssl"] as const;
export const BOOKING_EMAIL_REMINDER_TYPE_OPTIONS = ["booking_reminder_24h"] as const;
export const BOOKING_EMAIL_REMINDER_STATUS_OPTIONS = ["pending", "processing", "sent", "failed", "cancelled"] as const;

export const studios = pgTable("studios", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const studioMemberships = pgTable(
  "studio_memberships",
  {
    id: serial("id").primaryKey(),
    studioId: varchar("studio_id").notNull(),
    userId: varchar("user_id").notNull(),
    role: text("role").notNull().default("STUDIO_MEMBER"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    studioUserUnique: uniqueIndex("studio_memberships_studio_user_unique").on(table.studioId, table.userId),
  }),
);

export const organisations = pgTable("organisations", {
  id: varchar("id").primaryKey(),
  studioId: varchar("studio_id").notNull(),
  name: text("name").notNull(),
  displayName: text("display_name"),
  publicSlug: text("public_slug"),
  tagline: text("tagline"),
  heroTitle: text("hero_title"),
  heroDescription: text("hero_description"),
  bio: text("bio"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  websiteUrl: text("website_url"),
  instagramUrl: text("instagram_url"),
  logoUrl: text("logo_url"),
  coverImageUrl: text("cover_image_url"),
  brandColor: text("brand_color").default("#111827"),
  bookingNotes: text("booking_notes"),
  bookingTerms: text("booking_terms"),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organisationMemberships = pgTable(
  "organisation_memberships",
  {
    id: serial("id").primaryKey(),
    organisationId: varchar("organisation_id").notNull(),
    userId: varchar("user_id").notNull(),
    role: text("role").notNull().default("ORG_MEMBER"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    organisationUserUnique: uniqueIndex("organisation_memberships_org_user_unique").on(table.organisationId, table.userId),
  }),
);

export const organisationInvites = pgTable("organisation_invites", {
  id: serial("id").primaryKey(),
  organisationId: varchar("organisation_id").notNull(),
  inviterUserId: varchar("inviter_user_id").notNull(),
  email: varchar("email").notNull(),
  role: text("role").notNull().default("ORG_MEMBER"),
  token: varchar("token").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  organisationId: varchar("organisation_id").notNull(),
  ownerId: varchar("owner_id").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamMemberships = pgTable(
  "team_memberships",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id").notNull(),
    userId: varchar("user_id").notNull(),
    role: text("role").notNull().default("TEAM_MEMBER"),
  },
  (table) => ({
    teamUserUnique: uniqueIndex("team_memberships_team_user_unique").on(table.teamId, table.userId),
  }),
);

export const calendarConnections = pgTable("calendar_connections", {
  id: serial("id").primaryKey(),
  organisationId: varchar("organisation_id").notNull(),
  name: text("name").notNull(),
  provider: text("provider").notNull().default("internal"),
  calendarUrl: text("calendar_url"),
  username: text("username"),
  password: text("password"),
  isActive: boolean("is_active").notNull().default(true),
  syncStatus: text("sync_status").notNull().default("connected"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const calendarResources = pgTable("calendar_resources", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(),
  organisationId: varchar("organisation_id").notNull(),
  name: text("name").notNull(),
  remoteId: text("remote_id"),
  color: text("color"),
  isReadOnly: boolean("is_read_only").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const spaces = pgTable("spaces", {
  id: serial("id").primaryKey(),
  organisationId: varchar("organisation_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  capacity: integer("capacity"),
  isActive: boolean("is_active").default(true),
  parentId: integer("parent_id"),
  isStorageLocation: boolean("is_storage_location").default(false),
  isBookable: boolean("is_bookable").default(true),
  teamId: integer("team_id"),
  visibility: text("visibility").notNull().default("all_tenants"),
  calendarResourceId: integer("calendar_resource_id"),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  organisationId: varchar("organisation_id").notNull(),
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
  calendarResourceId: integer("calendar_resource_id"),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  organisationId: varchar("organisation_id"),
  userId: varchar("user_id"),
  guestEmail: varchar("guest_email"),
  guestName: varchar("guest_name"),
  spaceId: integer("space_id"),
  serviceId: integer("service_id"),
  inventoryItemId: integer("inventory_item_id"),
  calendarResourceId: integer("calendar_resource_id"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default("pending"),
  syncState: text("sync_state").notNull().default("not_required"),
  syncError: text("sync_error"),
  externalEventId: text("external_event_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  organisationId: varchar("organisation_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  isAvailableForHire: boolean("is_available_for_hire").default(false),
  condition: text("condition").default("good"),
  storageLocationId: integer("storage_location_id"),
  teamId: integer("team_id"),
  visibility: text("visibility").notNull().default("team"),
  calendarResourceId: integer("calendar_resource_id"),
});

export const teamCalendarAccess = pgTable(
  "team_calendar_access",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id").notNull(),
    calendarResourceId: integer("calendar_resource_id").notNull(),
  },
  (table) => ({
    teamCalendarUnique: uniqueIndex("team_calendar_access_unique").on(table.teamId, table.calendarResourceId),
  }),
);

export const teamServiceAccess = pgTable(
  "team_service_access",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id").notNull(),
    serviceId: integer("service_id").notNull(),
  },
  (table) => ({
    teamServiceUnique: uniqueIndex("team_service_access_unique").on(table.teamId, table.serviceId),
  }),
);

export const teamSpaceAccess = pgTable(
  "team_space_access",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id").notNull(),
    spaceId: integer("space_id").notNull(),
  },
  (table) => ({
    teamSpaceUnique: uniqueIndex("team_space_access_unique").on(table.teamId, table.spaceId),
  }),
);

export const teamInventoryAccess = pgTable(
  "team_inventory_access",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id").notNull(),
    inventoryItemId: integer("inventory_item_id").notNull(),
  },
  (table) => ({
    teamInventoryUnique: uniqueIndex("team_inventory_access_unique").on(table.teamId, table.inventoryItemId),
  }),
);

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

export const emailSettings = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull().default(587),
  smtpUsername: text("smtp_username").notNull(),
  smtpPasswordEncrypted: text("smtp_password_encrypted").notNull(),
  securityMode: text("security_mode").notNull().default("starttls"),
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  replyToEmail: text("reply_to_email"),
  enabled: boolean("enabled").notNull().default(false),
  lastTestedAt: timestamp("last_tested_at"),
  lastTestStatus: text("last_test_status"),
  lastTestError: text("last_test_error"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bookingEmailReminders = pgTable("booking_email_reminders", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  reminderType: text("reminder_type").notNull().default("booking_reminder_24h"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastError: text("last_error"),
  processingStartedAt: timestamp("processing_started_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudioSchema = createInsertSchema(studios).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertStudioMembershipSchema = createInsertSchema(studioMemberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOrganisationSchema = createInsertSchema(organisations).omit({
  id: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOrganisationMembershipSchema = createInsertSchema(organisationMemberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOrganisationInviteSchema = createInsertSchema(organisationInvites).omit({
  id: true,
  inviterUserId: true,
  token: true,
  status: true,
  acceptedAt: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, ownerId: true, organisationId: true, createdAt: true });
export const insertTeamMembershipSchema = createInsertSchema(teamMemberships).omit({ id: true });
export const insertCalendarConnectionSchema = createInsertSchema(calendarConnections).omit({ id: true, organisationId: true, syncStatus: true, lastSyncedAt: true, createdAt: true });
export const insertCalendarResourceSchema = createInsertSchema(calendarResources).omit({ id: true, organisationId: true, createdAt: true });
export const insertSpaceSchema = createInsertSchema(spaces).omit({ id: true, organisationId: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, organisationId: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  userId: true,
  organisationId: true,
  calendarResourceId: true,
  syncState: true,
  syncError: true,
  externalEventId: true,
  createdAt: true,
});
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true, organisationId: true });
export const insertInventoryHireSchema = createInsertSchema(inventoryHires).omit({ id: true, borrowerId: true });
export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({
  id: true,
  smtpPasswordEncrypted: true,
  lastTestedAt: true,
  lastTestStatus: true,
  lastTestError: true,
  updatedAt: true,
});
export const insertBookingEmailReminderSchema = createInsertSchema(bookingEmailReminders).omit({
  id: true,
  createdAt: true,
  processingStartedAt: true,
  sentAt: true,
});

export type Studio = typeof studios.$inferSelect;
export type StudioMembership = typeof studioMemberships.$inferSelect;
export type Organisation = typeof organisations.$inferSelect;
export type OrganisationMembership = typeof organisationMemberships.$inferSelect;
export type OrganisationInvite = typeof organisationInvites.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamMembership = typeof teamMemberships.$inferSelect;
export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type CalendarResource = typeof calendarResources.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryHire = typeof inventoryHires.$inferSelect;
export type EmailVerificationCode = typeof emailVerificationCodes.$inferSelect;
export type EmailSettings = typeof emailSettings.$inferSelect;
export type BookingEmailReminder = typeof bookingEmailReminders.$inferSelect;

export type CreateStudioRequest = z.infer<typeof insertStudioSchema>;
export type CreateStudioMembershipRequest = z.infer<typeof insertStudioMembershipSchema>;
export type CreateOrganisationRequest = z.infer<typeof insertOrganisationSchema>;
export type UpdateOrganisationRequest = Partial<CreateOrganisationRequest>;
export type CreateOrganisationMembershipRequest = z.infer<typeof insertOrganisationMembershipSchema>;
export type CreateOrganisationInviteRequest = z.infer<typeof insertOrganisationInviteSchema>;
export type CreateTeamRequest = z.infer<typeof insertTeamSchema>;
export type UpdateTeamRequest = Partial<CreateTeamRequest>;
export type CreateTeamMembershipRequest = z.infer<typeof insertTeamMembershipSchema>;
export type CreateCalendarConnectionRequest = z.infer<typeof insertCalendarConnectionSchema>;
export type CreateCalendarResourceRequest = z.infer<typeof insertCalendarResourceSchema>;
export type CreateSpaceRequest = z.infer<typeof insertSpaceSchema>;
export type UpdateSpaceRequest = Partial<CreateSpaceRequest>;
export type CreateServiceRequest = z.infer<typeof insertServiceSchema>;
export type UpdateServiceRequest = Partial<CreateServiceRequest>;
export type CreateBookingRequest = z.infer<typeof insertBookingSchema>;
export type UpdateBookingRequest = Partial<CreateBookingRequest>;
export type CreateInventoryItemRequest = z.infer<typeof insertInventoryItemSchema>;
export type UpdateInventoryItemRequest = Partial<CreateInventoryItemRequest>;
export type CreateInventoryHireRequest = z.infer<typeof insertInventoryHireSchema>;
export type UpdateInventoryHireRequest = Partial<CreateInventoryHireRequest>;
export type CreateEmailSettingsRequest = z.infer<typeof insertEmailSettingsSchema> & {
  smtpPassword: string;
};
export type CreateBookingEmailReminderRequest = z.infer<typeof insertBookingEmailReminderSchema>;

export const organisationProfileResponseSchema = z.object({
  id: z.string(),
  studioRole: z.enum(["STUDIO_OWNER", "STUDIO_ADMIN", "STUDIO_MEMBER"]),
  organisationRole: z.enum(["ORG_OWNER", "ORG_ADMIN", "ORG_MEMBER"]).nullable(),
  role: z.enum(["admin", "tenant"]).nullable(),
  studioId: z.string(),
  name: z.string(),
  organisationName: z.string(),
  tenantName: z.string(),
  displayName: z.string().nullable(),
  publicSlug: z.string().nullable(),
  tagline: z.string().nullable(),
  heroTitle: z.string().nullable(),
  heroDescription: z.string().nullable(),
  bio: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  logoUrl: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  brandColor: z.string().nullable(),
  bookingNotes: z.string().nullable(),
  bookingTerms: z.string().nullable(),
  createdByUserId: z.string().nullable(),
});

export interface GuestBookingInitRequest {
  guestName: string;
  guestEmail: string;
  spaceId?: number;
  serviceId?: number;
  inventoryItemId?: number;
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

export type AppRole = typeof APP_ROLE_OPTIONS[number];
export type StudioRole = typeof STUDIO_ROLE_OPTIONS[number];
export type OrganisationRole = typeof ORGANISATION_ROLE_OPTIONS[number];
export type TeamRole = typeof TEAM_ROLE_OPTIONS[number];
export type OrganisationInviteStatus = typeof ORGANISATION_INVITE_STATUS_OPTIONS[number];
export type Visibility = typeof VISIBILITY_OPTIONS[number];
export type CalendarProvider = typeof CALENDAR_PROVIDER_OPTIONS[number];
export type CalendarSyncStatus = typeof CALENDAR_SYNC_STATUS_OPTIONS[number];
export type BookingStatus = typeof BOOKING_STATUS_OPTIONS[number];
export type ReservationSyncState = typeof RESERVATION_SYNC_STATE_OPTIONS[number];
export type EmailSecurityMode = typeof EMAIL_SECURITY_MODE_OPTIONS[number];
export type BookingEmailReminderType = typeof BOOKING_EMAIL_REMINDER_TYPE_OPTIONS[number];
export type BookingEmailReminderStatus = typeof BOOKING_EMAIL_REMINDER_STATUS_OPTIONS[number];

// Legacy aliases kept temporarily so the wider refactor can be completed incrementally.
export const workspaces = organisations;
export const workspaceMemberships = organisationMemberships;
export const workspaceInvites = organisationInvites;
export const teamMembers = teamMemberships;
export const insertWorkspaceSchema = insertOrganisationSchema;
export const insertWorkspaceMembershipSchema = insertOrganisationMembershipSchema;
export const insertWorkspaceInviteSchema = insertOrganisationInviteSchema;
export const insertTeamMemberSchema = insertTeamMembershipSchema;
export const workspaceProfileResponseSchema = organisationProfileResponseSchema;
export type Workspace = Organisation;
export type WorkspaceMembership = OrganisationMembership;
export type WorkspaceInvite = OrganisationInvite;
export type TeamMember = TeamMembership;
export type CreateWorkspaceRequest = CreateOrganisationRequest;
export type UpdateWorkspaceRequest = UpdateOrganisationRequest;
export type CreateWorkspaceMembershipRequest = CreateOrganisationMembershipRequest;
export type CreateWorkspaceInviteRequest = CreateOrganisationInviteRequest;
export type WorkspaceMembershipRole = OrganisationRole;
export type WorkspaceInviteStatus = OrganisationInviteStatus;
