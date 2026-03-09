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

  const switchWorkspaceMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      const response = await fetch(api.auth.switchWorkspace.path, {
        method: api.auth.switchWorkspace.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workspaceId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Could not switch workspace.");
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
    workspaces: data?.workspaces ?? [],
    activeWorkspaceId: data?.activeWorkspaceId ?? null,
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
    switchWorkspace: switchWorkspaceMutation.mutate,
    isSwitchingWorkspace: switchWorkspaceMutation.isPending,
  };
}
