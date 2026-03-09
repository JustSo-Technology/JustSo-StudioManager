import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useCalendarConnections() {
  return useQuery({
    queryKey: [api.calendars.connections.list.path],
    queryFn: async () => {
      const res = await fetch(api.calendars.connections.list.path, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch calendars");
      }
      return res.json();
    },
  });
}

export function useCalendarResources() {
  return useQuery({
    queryKey: [api.calendars.resources.list.path],
    queryFn: async () => {
      const res = await fetch(api.calendars.resources.list.path, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch calendar resources");
      }
      return res.json();
    },
  });
}

export function useCreateCalendarConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const validated = api.calendars.connections.create.input.parse(data);
      const res = await fetch(api.calendars.connections.create.path, {
        method: api.calendars.connections.create.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(validated),
      });
      if (!res.ok) {
        throw new Error("Failed to create calendar connection");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.calendars.connections.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.calendars.resources.list.path] });
    },
  });
}

export function useDeleteCalendarConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/calendars/connections/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to delete calendar connection");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.calendars.connections.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.calendars.resources.list.path] });
    },
  });
}
