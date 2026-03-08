import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";

export function useSpaces() {
  return useQuery({
    queryKey: [api.spaces.list.path],
    queryFn: async () => {
      const res = await fetch(api.spaces.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch spaces");
      return api.spaces.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const validated = api.spaces.create.input.parse(data);
      const res = await fetch(api.spaces.create.path, {
        method: api.spaces.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create space");
      return api.spaces.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.spaces.list.path] }),
  });
}

export function useUpdateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Record<string, any>) => {
      const validated = api.spaces.update.input.parse(updates);
      const url = buildUrl(api.spaces.update.path, { id });
      const res = await fetch(url, {
        method: api.spaces.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update space");
      return api.spaces.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.spaces.list.path] }),
  });
}

export function useDeleteSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/spaces/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.spaces.list.path] }),
  });
}
