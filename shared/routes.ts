import { z } from 'zod';
import { 
  insertSpaceSchema, insertServiceSchema, insertBookingSchema, 
  insertInventoryItemSchema, insertInventoryHireSchema, insertUserProfileSchema,
  insertTeamSchema, insertTeamMemberSchema,
  spaces, services, bookings, inventoryItems, inventoryHires, userProfiles, teams, teamMembers
} from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
};

export const api = {
  profiles: {
    me: {
      method: 'GET' as const,
      path: '/api/profiles/me' as const,
      responses: {
        200: z.custom<typeof userProfiles.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/profiles/me' as const,
      input: insertUserProfileSchema.partial(),
      responses: {
        200: z.custom<typeof userProfiles.$inferSelect>(),
        400: errorSchemas.validation,
      }
    }
  },
  teams: {
    list: {
      method: 'GET' as const,
      path: '/api/teams' as const,
      responses: { 200: z.array(z.custom<typeof teams.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/teams' as const,
      input: insertTeamSchema,
      responses: { 201: z.custom<typeof teams.$inferSelect>(), 400: errorSchemas.validation }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/teams/:id' as const,
      input: insertTeamSchema.partial(),
      responses: { 200: z.custom<typeof teams.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/teams/:id' as const,
      responses: { 200: z.object({ message: z.string() }), 404: errorSchemas.notFound }
    },
    members: {
      list: {
        method: 'GET' as const,
        path: '/api/teams/:id/members' as const,
        responses: { 200: z.array(z.custom<typeof teamMembers.$inferSelect>()) }
      },
      add: {
        method: 'POST' as const,
        path: '/api/teams/:id/members' as const,
        input: z.object({ userId: z.string(), role: z.string().optional() }),
        responses: { 201: z.custom<typeof teamMembers.$inferSelect>(), 400: errorSchemas.validation }
      },
      remove: {
        method: 'DELETE' as const,
        path: '/api/teams/:id/members/:userId' as const,
        responses: { 200: z.object({ message: z.string() }) }
      }
    }
  },
  spaces: {
    list: {
      method: 'GET' as const,
      path: '/api/spaces' as const,
      responses: { 200: z.array(z.custom<typeof spaces.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/spaces' as const,
      input: insertSpaceSchema,
      responses: { 201: z.custom<typeof spaces.$inferSelect>(), 400: errorSchemas.validation }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/spaces/:id' as const,
      input: insertSpaceSchema.partial(),
      responses: { 200: z.custom<typeof spaces.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/spaces/:id' as const,
      responses: { 200: z.object({ message: z.string() }), 404: errorSchemas.notFound }
    }
  },
  services: {
    list: {
      method: 'GET' as const,
      path: '/api/services' as const,
      responses: { 200: z.array(z.custom<typeof services.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/services' as const,
      input: insertServiceSchema,
      responses: { 201: z.custom<typeof services.$inferSelect>(), 400: errorSchemas.validation }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/services/:id' as const,
      input: insertServiceSchema.partial(),
      responses: { 200: z.custom<typeof services.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/services/:id' as const,
      responses: { 200: z.object({ message: z.string() }), 404: errorSchemas.notFound }
    }
  },
  bookings: {
    list: {
      method: 'GET' as const,
      path: '/api/bookings' as const,
      responses: { 200: z.array(z.custom<typeof bookings.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/bookings' as const,
      input: insertBookingSchema,
      responses: { 201: z.custom<typeof bookings.$inferSelect>(), 400: errorSchemas.validation }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/bookings/:id' as const,
      input: insertBookingSchema.partial(),
      responses: { 200: z.custom<typeof bookings.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound }
    }
  },
  inventory: {
    list: {
      method: 'GET' as const,
      path: '/api/inventory' as const,
      responses: { 200: z.array(z.custom<typeof inventoryItems.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/inventory' as const,
      input: insertInventoryItemSchema,
      responses: { 201: z.custom<typeof inventoryItems.$inferSelect>(), 400: errorSchemas.validation }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/inventory/:id' as const,
      input: insertInventoryItemSchema.partial(),
      responses: { 200: z.custom<typeof inventoryItems.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/inventory/:id' as const,
      responses: { 200: z.object({ message: z.string() }), 404: errorSchemas.notFound }
    }
  },
  hires: {
    list: {
      method: 'GET' as const,
      path: '/api/hires' as const,
      responses: { 200: z.array(z.custom<typeof inventoryHires.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/hires' as const,
      input: insertInventoryHireSchema,
      responses: { 201: z.custom<typeof inventoryHires.$inferSelect>(), 400: errorSchemas.validation }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/hires/:id' as const,
      input: insertInventoryHireSchema.partial(),
      responses: { 200: z.custom<typeof inventoryHires.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound }
    }
  }
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
