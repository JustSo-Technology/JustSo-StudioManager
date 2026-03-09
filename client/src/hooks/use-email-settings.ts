import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

async function readJsonOrThrow(res: Response) {
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.message || "Request failed");
  }
  return res.json();
}

export function useEmailSettings(enabled = true) {
  return useQuery({
    queryKey: [api.admin.emailSettings.get.path],
    enabled,
    queryFn: async () => {
      const res = await fetch(api.admin.emailSettings.get.path, { credentials: "include" });
      if (res.status === 403) {
        throw new Error("Forbidden");
      }
      return api.admin.emailSettings.get.responses[200].parse(await readJsonOrThrow(res));
    },
  });
}

export function useEmailHealth(enabled = true) {
  return useQuery({
    queryKey: [api.admin.emailSettings.health.path],
    enabled,
    queryFn: async () => {
      const res = await fetch(api.admin.emailSettings.health.path, { credentials: "include" });
      if (res.status === 403) {
        throw new Error("Forbidden");
      }
      return api.admin.emailSettings.health.responses[200].parse(await readJsonOrThrow(res));
    },
    refetchInterval: enabled ? 30_000 : false,
  });
}

export function useEmailReminders(enabled = true) {
  return useQuery({
    queryKey: [api.admin.emailSettings.reminders.path],
    enabled,
    queryFn: async () => {
      const res = await fetch(api.admin.emailSettings.reminders.path, { credentials: "include" });
      if (res.status === 403) {
        throw new Error("Forbidden");
      }
      return api.admin.emailSettings.reminders.responses[200].parse(await readJsonOrThrow(res));
    },
    refetchInterval: enabled ? 30_000 : false,
  });
}

export function useUpdateEmailSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: typeof api.admin.emailSettings.update.input._type) => {
      const input = api.admin.emailSettings.update.input.parse(payload);
      const res = await fetch(api.admin.emailSettings.update.path, {
        method: api.admin.emailSettings.update.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      return api.admin.emailSettings.update.responses[200].parse(await readJsonOrThrow(res));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.emailSettings.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.admin.emailSettings.health.path] });
    },
  });
}

export function useSendTestEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const input = api.admin.emailSettings.test.input.parse({ email });
      const res = await fetch(api.admin.emailSettings.test.path, {
        method: api.admin.emailSettings.test.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      return api.admin.emailSettings.test.responses[200].parse(await readJsonOrThrow(res));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.emailSettings.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.admin.emailSettings.health.path] });
      queryClient.invalidateQueries({ queryKey: [api.admin.emailSettings.reminders.path] });
    },
  });
}
