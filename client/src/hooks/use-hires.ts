import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useHires() {
  return useQuery({
    queryKey: [api.hires.list.path],
    queryFn: async () => {
      const res = await fetch(api.hires.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch hires");
      const hires = api.hires.list.responses[200].parse(await res.json());
      return hires.map((hire) => ({
        ...hire,
        startTime: new Date(hire.startTime),
        endTime: new Date(hire.endTime),
      }));
    },
  });
}

export function useCreateHire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const validated = api.hires.create.input.parse(data);
      const res = await fetch(api.hires.create.path, {
        method: api.hires.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create hire");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.hires.list.path] }),
  });
}

export function useUpdateHire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Record<string, any>) => {
      const validated = api.hires.update.input.parse(updates);
      const url = buildUrl(api.hires.update.path, { id });
      const res = await fetch(url, {
        method: api.hires.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update hire");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.hires.list.path] }),
  });
}
