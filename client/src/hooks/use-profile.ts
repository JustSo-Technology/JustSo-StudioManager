import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useProfile() {
  return useQuery({
    queryKey: [api.profiles.me.path],
    queryFn: async () => {
      const res = await fetch(api.profiles.me.path, { credentials: "include" });
      if (res.status === 401 || res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch profile");
      return api.profiles.me.responses[200].parse(await res.json());
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const validated = api.profiles.update.input.parse(data);
      const res = await fetch(api.profiles.update.path, {
        method: api.profiles.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return api.profiles.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.profiles.me.path] });
    },
  });
}
