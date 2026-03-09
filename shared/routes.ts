import { z } from "zod";
import {
  bookings,
  bookingEmailReminders,
  calendarConnections,
  calendarResources,
  emailSettings,
  inventoryHires,
  inventoryItems,
  insertBookingSchema,
  insertCalendarConnectionSchema,
  insertCalendarResourceSchema,
  insertInventoryHireSchema,
  insertInventoryItemSchema,
  insertServiceSchema,
  insertSpaceSchema,
  insertTeamMemberSchema,
  insertTeamSchema,
  insertWorkspaceInviteSchema,
  insertWorkspaceSchema,
  services,
  spaces,
  teamMembers,
  teams,
  workspaceInvites,
  workspaceProfileResponseSchema,
  workspaces,
} from "./schema";

const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string().nullable(),
  appRole: z.enum(["member", "admin"]),
});

const sessionWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().nullable(),
  publicSlug: z.string().nullable(),
  membershipRole: z.enum(["owner", "manager", "member"]).nullable(),
});

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  forbidden: z.object({ message: z.string() }),
};

export const api = {
  profiles: {
    me: {
      method: "GET" as const,
      path: "/api/profiles/me" as const,
      responses: {
        200: workspaceProfileResponseSchema,
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: "PUT" as const,
      path: "/api/profiles/me" as const,
      input: insertWorkspaceSchema.partial(),
      responses: {
        200: workspaceProfileResponseSchema,
        400: errorSchemas.validation,
      },
    },
  },
  auth: {
    session: {
      method: "GET" as const,
      path: "/api/auth/user" as const,
      responses: {
        200: z.object({
          user: sessionUserSchema,
          activeWorkspaceId: z.string().nullable(),
          workspaces: z.array(sessionWorkspaceSchema),
          invite: z
            .object({
              token: z.string(),
              workspaceId: z.string(),
              workspaceName: z.string(),
              email: z.string().email(),
              role: z.enum(["owner", "manager", "member"]),
              expiresAt: z.string(),
            })
            .nullable(),
        }),
        401: errorSchemas.unauthorized,
      },
    },
    switchWorkspace: {
      method: "POST" as const,
      path: "/api/auth/workspaces/switch" as const,
      input: z.object({ workspaceId: z.string() }),
      responses: { 200: z.object({ workspaceId: z.string() }), 400: errorSchemas.validation, 403: errorSchemas.forbidden },
    },
  },
  workspaces: {
    list: {
      method: "GET" as const,
      path: "/api/workspaces" as const,
      responses: { 200: z.array(z.custom<typeof workspaces.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/workspaces" as const,
      input: insertWorkspaceSchema,
      responses: { 201: z.custom<typeof workspaces.$inferSelect>(), 400: errorSchemas.validation },
    },
  },
  invites: {
    list: {
      method: "GET" as const,
      path: "/api/invites" as const,
      responses: { 200: z.array(z.custom<typeof workspaceInvites.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/invites" as const,
      input: insertWorkspaceInviteSchema.extend({
        workspaceId: z.string(),
        email: z.string().email(),
        role: z.enum(["owner", "manager", "member"]).default("member"),
        expiresAt: z.coerce.date().optional(),
      }),
      responses: { 201: z.custom<typeof workspaceInvites.$inferSelect>(), 400: errorSchemas.validation },
    },
    resolve: {
      method: "GET" as const,
      path: "/api/invites/:token" as const,
      responses: {
        200: z.object({
          invite: z.custom<typeof workspaceInvites.$inferSelect>(),
          workspace: z.custom<typeof workspaces.$inferSelect>(),
        }),
        404: errorSchemas.notFound,
      },
    },
    revoke: {
      method: "POST" as const,
      path: "/api/invites/:id/revoke" as const,
      responses: { 200: z.custom<typeof workspaceInvites.$inferSelect>(), 404: errorSchemas.notFound },
    },
    resend: {
      method: "POST" as const,
      path: "/api/invites/:id/resend" as const,
      responses: { 200: z.custom<typeof workspaceInvites.$inferSelect>(), 404: errorSchemas.notFound },
    },
    accept: {
      method: "POST" as const,
      path: "/api/invites/:token/accept" as const,
      responses: { 200: z.object({ workspaceId: z.string() }), 404: errorSchemas.notFound },
    },
  },
  teams: {
    list: {
      method: "GET" as const,
      path: "/api/teams" as const,
      responses: { 200: z.array(z.custom<typeof teams.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/teams" as const,
      input: insertTeamSchema,
      responses: { 201: z.custom<typeof teams.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: "PUT" as const,
      path: "/api/teams/:id" as const,
      input: insertTeamSchema.partial(),
      responses: { 200: z.custom<typeof teams.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/teams/:id" as const,
      responses: { 200: z.object({ message: z.string() }), 404: errorSchemas.notFound },
    },
    members: {
      list: {
        method: "GET" as const,
        path: "/api/teams/:id/members" as const,
        responses: { 200: z.array(z.custom<typeof teamMembers.$inferSelect>()) },
      },
      add: {
        method: "POST" as const,
        path: "/api/teams/:id/members" as const,
        input: z.object({ userId: z.string(), role: z.string().optional() }),
        responses: { 201: z.custom<typeof teamMembers.$inferSelect>(), 400: errorSchemas.validation },
      },
      remove: {
        method: "DELETE" as const,
        path: "/api/teams/:id/members/:userId" as const,
        responses: { 200: z.object({ message: z.string() }) },
      },
    },
  },
  calendars: {
    connections: {
      list: {
        method: "GET" as const,
        path: "/api/calendars/connections" as const,
        responses: { 200: z.array(z.custom<typeof calendarConnections.$inferSelect>()) },
      },
      create: {
        method: "POST" as const,
        path: "/api/calendars/connections" as const,
        input: insertCalendarConnectionSchema.extend({
          resourceName: z.string().min(1, "Resource name is required"),
          resourceColor: z.string().optional(),
        }),
        responses: { 201: z.custom<typeof calendarConnections.$inferSelect>(), 400: errorSchemas.validation },
      },
      delete: {
        method: "DELETE" as const,
        path: "/api/calendars/connections/:id" as const,
        responses: { 200: z.object({ message: z.string() }) },
      },
    },
    resources: {
      list: {
        method: "GET" as const,
        path: "/api/calendars/resources" as const,
        responses: { 200: z.array(z.custom<typeof calendarResources.$inferSelect>()) },
      },
      create: {
        method: "POST" as const,
        path: "/api/calendars/resources" as const,
        input: insertCalendarResourceSchema,
        responses: { 201: z.custom<typeof calendarResources.$inferSelect>(), 400: errorSchemas.validation },
      },
    },
  },
  spaces: {
    list: {
      method: "GET" as const,
      path: "/api/spaces" as const,
      responses: { 200: z.array(z.custom<typeof spaces.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/spaces" as const,
      input: insertSpaceSchema,
      responses: { 201: z.custom<typeof spaces.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: "PUT" as const,
      path: "/api/spaces/:id" as const,
      input: insertSpaceSchema.partial(),
      responses: { 200: z.custom<typeof spaces.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/spaces/:id" as const,
      responses: { 200: z.object({ message: z.string() }), 404: errorSchemas.notFound },
    },
  },
  services: {
    list: {
      method: "GET" as const,
      path: "/api/services" as const,
      responses: { 200: z.array(z.custom<typeof services.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/services" as const,
      input: insertServiceSchema,
      responses: { 201: z.custom<typeof services.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: "PUT" as const,
      path: "/api/services/:id" as const,
      input: insertServiceSchema.partial(),
      responses: { 200: z.custom<typeof services.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/services/:id" as const,
      responses: { 200: z.object({ message: z.string() }), 404: errorSchemas.notFound },
    },
  },
  bookings: {
    list: {
      method: "GET" as const,
      path: "/api/bookings" as const,
      responses: { 200: z.array(z.custom<typeof bookings.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/bookings" as const,
      input: insertBookingSchema,
      responses: { 201: z.custom<typeof bookings.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: "PUT" as const,
      path: "/api/bookings/:id" as const,
      input: insertBookingSchema.partial(),
      responses: { 200: z.custom<typeof bookings.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
  },
  inventory: {
    list: {
      method: "GET" as const,
      path: "/api/inventory" as const,
      responses: { 200: z.array(z.custom<typeof inventoryItems.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/inventory" as const,
      input: insertInventoryItemSchema,
      responses: { 201: z.custom<typeof inventoryItems.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: "PUT" as const,
      path: "/api/inventory/:id" as const,
      input: insertInventoryItemSchema.partial(),
      responses: { 200: z.custom<typeof inventoryItems.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/inventory/:id" as const,
      responses: { 200: z.object({ message: z.string() }), 404: errorSchemas.notFound },
    },
  },
  hires: {
    list: {
      method: "GET" as const,
      path: "/api/hires" as const,
      responses: { 200: z.array(z.custom<typeof inventoryHires.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/hires" as const,
      input: insertInventoryHireSchema,
      responses: { 201: z.custom<typeof inventoryHires.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: "PUT" as const,
      path: "/api/hires/:id" as const,
      input: insertInventoryHireSchema.partial(),
      responses: { 200: z.custom<typeof inventoryHires.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
  },
  admin: {
    emailSettings: {
      get: {
        method: "GET" as const,
        path: "/api/admin/email-settings" as const,
        responses: { 200: z.custom<typeof emailSettings.$inferSelect | null>() },
      },
      update: {
        method: "PUT" as const,
        path: "/api/admin/email-settings" as const,
        input: z.object({
          smtpHost: z.string().min(1),
          smtpPort: z.coerce.number().int().min(1).max(65535),
          smtpUsername: z.string().min(1),
          smtpPassword: z.string().optional().or(z.literal("")),
          securityMode: z.enum(["none", "starttls", "ssl"]),
          fromName: z.string().min(1),
          fromEmail: z.string().email(),
          replyToEmail: z.string().email().optional().or(z.literal("")),
          enabled: z.boolean(),
        }),
        responses: { 200: z.custom<typeof emailSettings.$inferSelect>(), 400: errorSchemas.validation },
      },
      test: {
        method: "POST" as const,
        path: "/api/admin/email-settings/test" as const,
        input: z.object({ email: z.string().email() }),
        responses: { 200: z.object({ message: z.string() }), 400: errorSchemas.validation },
      },
      health: {
        method: "GET" as const,
        path: "/api/admin/email-settings/health" as const,
        responses: {
          200: z.object({
            configured: z.boolean(),
            enabled: z.boolean(),
            pendingReminders: z.number(),
            failedReminders: z.number(),
            lastReminderError: z.string().nullable(),
            lastTestedAt: z.string().nullable(),
            lastTestStatus: z.string().nullable(),
          }),
        },
      },
      reminders: {
        method: "GET" as const,
        path: "/api/admin/email-reminders" as const,
        responses: { 200: z.array(z.custom<typeof bookingEmailReminders.$inferSelect>()) },
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
