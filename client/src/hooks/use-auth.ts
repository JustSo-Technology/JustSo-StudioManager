import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  await fetch("/api/logout", { 
    method: "POST",
    credentials: "include" 
  });
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.removeQueries();
      window.location.reload();
    },
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/login-demo", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Login failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });

  const loginAdminMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/login-demo-admin", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Admin login failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginAdmin: loginAdminMutation.mutate,
    isLoggingInAdmin: loginAdminMutation.isPending,
  };
}
