import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import type { Space } from "@shared/schema";

export function useStorageLocations() {
  return useQuery<Space[]>({
    queryKey: ['/api/spaces/storage-locations'],
    queryFn: async () => {
      const res = await fetch('/api/spaces/storage-locations', { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch storage locations");
      return res.json();
    },
  });
}

export function useInventory() {
  return useQuery({
    queryKey: [api.inventory.list.path],
    queryFn: async () => {
      const res = await fetch(api.inventory.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return api.inventory.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const validated = api.inventory.create.input.parse(data);
      const res = await fetch(api.inventory.create.path, {
        method: api.inventory.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create inventory item");
      return api.inventory.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.inventory.list.path] }),
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Record<string, any>) => {
      const validated = api.inventory.update.input.parse(updates);
      const url = buildUrl(api.inventory.update.path, { id });
      const res = await fetch(url, {
        method: api.inventory.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update inventory item");
      return api.inventory.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.inventory.list.path] }),
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/inventory/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.inventory.list.path] }),
  });
}
