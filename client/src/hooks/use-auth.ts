import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

type SessionResponse = typeof api.auth.session.responses[200]["_type"];

async function fetchSession(): Promise<SessionResponse | null> {
  const response = await fetch(api.auth.session.path, {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
  return api.auth.session.responses[200].parse(await response.json());
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [api.auth.session.path],
    queryFn: fetchSession,
    retry: false,
    staleTime: 1000 * 60,
  });

  const switchOrganisationMutation = useMutation({
    mutationFn: async (organisationId: string) => {
      const response = await fetch(api.auth.switchOrganisation.path, {
        method: api.auth.switchOrganisation.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ organisationId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Could not switch organisation.");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  return {
    session: data,
    user: data?.user ?? null,
    organisations: data?.organisations ?? [],
    activeOrganisationId: data?.activeOrganisationId ?? null,
    workspaces: data?.workspaces ?? data?.organisations ?? [],
    activeWorkspaceId: data?.activeWorkspaceId ?? data?.activeOrganisationId ?? null,
    pendingInvite: data?.invite ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
    signIn: (inviteToken?: string) => {
      const url = inviteToken ? `/api/auth/login?invite=${encodeURIComponent(inviteToken)}` : "/api/auth/login";
      window.location.assign(url);
    },
    logout: () => {
      window.location.assign("/api/auth/logout");
    },
    switchOrganisation: switchOrganisationMutation.mutate,
    isSwitchingOrganisation: switchOrganisationMutation.isPending,
    switchWorkspace: switchOrganisationMutation.mutate,
    isSwitchingWorkspace: switchOrganisationMutation.isPending,
  };
}
