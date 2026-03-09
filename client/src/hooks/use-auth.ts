import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

type Credentials = {
  email: string;
  password: string;
};

type SignupPayload = Credentials & {
  studioName: string;
};

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

async function readAuthError(response: Response) {
  const payload = await response.json().catch(() => null);
  return payload?.message || "Authentication failed";
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
    mutationFn: async (credentials: Credentials) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      if (!response.ok) throw new Error(await readAuthError(response));
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });

  const signupMutation = useMutation({
    mutationFn: async (payload: SignupPayload) => {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!response.ok) throw new Error(await readAuthError(response));
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
    signIn: loginMutation.mutate,
    isSigningIn: loginMutation.isPending,
    signUp: signupMutation.mutate,
    isSigningUp: signupMutation.isPending,
    loginAdmin: loginAdminMutation.mutate,
    isLoggingInAdmin: loginAdminMutation.isPending,
  };
}
