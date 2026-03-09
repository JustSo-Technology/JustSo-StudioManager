import { ReactNode, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSidebar } from "./app-sidebar";
import { useAuth } from "@/hooks/use-auth";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function AppLayout({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const { isAuthenticated, isLoading, signIn, logout, user, pendingInvite, activeWorkspaceId } = useAuth();
  const [workspaceName, setWorkspaceName] = useState("");
  const [createError, setCreateError] = useState("");
  const authError = useMemo(() => new URLSearchParams(window.location.search).get("authError"), [location]);

  const createWorkspace = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: workspaceName,
          displayName: workspaceName,
          publicSlug: slugify(workspaceName),
          contactEmail: user?.email,
          heroTitle: workspaceName,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Could not create workspace.");
      }
      return response.json();
    },
    onSuccess: async () => {
      setCreateError("");
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      setCreateError(error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="glass-panel p-10 rounded-3xl max-w-3xl w-full text-center relative z-10 shadow-2xl shadow-black/5">
          <img
            src="/justso-logo.png"
            alt="JustSo. Studio Manager"
            className="mx-auto mb-6 h-auto w-full max-w-[760px] object-contain"
          />
          <p className="mx-auto mb-3 max-w-2xl text-muted-foreground">
            Studio Manager now uses Authentik for sign-in. User accounts are person-first, and workspace access is granted by invite.
          </p>
          {pendingInvite ? (
            <p className="mx-auto mb-6 max-w-xl text-sm text-foreground/80">
              You have a pending invite to <strong>{pendingInvite.workspaceName}</strong>. Sign in with the invited email to join that workspace.
            </p>
          ) : (
            <p className="mx-auto mb-6 max-w-xl text-sm text-foreground/80">
              Public signup is disabled by default. Platform admins create workspaces and invite users into them.
            </p>
          )}
          {authError ? <p className="mb-4 text-sm text-destructive">Sign-in failed. Check the Authentik client settings and try again.</p> : null}
          <div className="mx-auto max-w-md space-y-3">
            <Button className="w-full h-12 text-base rounded-xl" onClick={() => signIn(pendingInvite?.token)}>
              Sign in with Authentik
            </Button>
            <div className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-4 text-left text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Invite-only onboarding</p>
              <p className="mt-1">If you need access, contact the JustSo. Studios admin for a workspace invite.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!activeWorkspaceId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="glass-panel w-full max-w-2xl rounded-3xl p-10 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight">Finish onboarding</h1>
          {user?.appRole === "admin" ? (
            <>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                You are signed in as the platform admin. Create the first workspace, then invite tenant users into it.
              </p>
              <div className="mx-auto mt-8 max-w-md space-y-3">
                <Input
                  className="h-12 rounded-xl bg-background"
                  placeholder="Workspace name"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                />
                {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
                <Button className="h-12 w-full rounded-xl" disabled={!workspaceName || createWorkspace.isPending} onClick={() => createWorkspace.mutate()}>
                  {createWorkspace.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create first workspace"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                Your account exists, but it is not attached to a workspace yet. Ask a platform admin to send you an invite, then sign back in with the invited email.
              </p>
              <Button className="mt-8 rounded-xl" variant="outline" onClick={() => logout()}>
                Sign out
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center px-4 border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-md z-30">
            <SidebarTrigger className="hover-elevate" />
          </header>
          <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
