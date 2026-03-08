import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Team, TeamMember } from "@shared/schema";

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });
}

export function useTeamMembers(teamId: number | null) {
  return useQuery<TeamMember[]>({
    queryKey: ["/api/teams", teamId, "members"],
    enabled: !!teamId,
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team members");
      return res.json();
    },
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await apiRequest("POST", "/api/teams", data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/teams"] }),
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number; name?: string; description?: string }) => {
      const res = await apiRequest("PUT", `/api/teams/${id}`, updates);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/teams"] }),
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/teams/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/teams"] }),
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, userId, role }: { teamId: number; userId: string; role?: string }) => {
      const res = await apiRequest("POST", `/api/teams/${teamId}/members`, { userId, role });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", variables.teamId, "members"] });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: string }) => {
      await apiRequest("DELETE", `/api/teams/${teamId}/members/${userId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", variables.teamId, "members"] });
    },
  });
}
