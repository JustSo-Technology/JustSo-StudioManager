import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Send, RefreshCcw, Ban } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function AccessPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, activeOrganisationId } = useAuth();
  const [organisationName, setOrganisationName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: organisations = [], isLoading: isOrganisationsLoading } = useQuery({
    queryKey: ["/api/organisations"],
    queryFn: async () => {
      const response = await fetch("/api/organisations", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load organisations.");
      return response.json();
    },
  });

  const { data: invites = [], isLoading: isInvitesLoading } = useQuery({
    queryKey: ["/api/invites", activeOrganisationId],
    queryFn: async () => {
      const response = await fetch("/api/invites", { credentials: "include" });
      if (response.status === 403) return [];
      if (!response.ok) throw new Error("Failed to load invites.");
      return response.json();
    },
    enabled: !!activeOrganisationId,
  });

  const createOrganisation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: organisationName,
          displayName: organisationName,
          publicSlug: slugify(organisationName),
          contactEmail: user?.email,
          studioId: "justso-studios",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Could not create organisation.");
      return payload;
    },
    onSuccess: async () => {
      setOrganisationName("");
      toast({ title: "Organisation created" });
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast({ title: "Organisation error", description: error.message, variant: "destructive" });
    },
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organisationId: activeOrganisationId,
          email: inviteEmail,
          role: "ORG_MEMBER",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Could not create invite.");
      return payload;
    },
    onSuccess: async (invite) => {
      setInviteEmail("");
      toast({
        title: "Invite created",
        description: `Share /api/auth/login?invite=${invite.token} with ${invite.email}.`,
      });
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast({ title: "Invite error", description: error.message, variant: "destructive" });
    },
  });

  const inviteActions = useMemo(
    () => ({
      resend: async (id: number) => {
        const response = await fetch(`/api/invites/${id}/resend`, { method: "POST", credentials: "include" });
        if (!response.ok) throw new Error("Could not resend invite.");
        await queryClient.invalidateQueries();
      },
      revoke: async (id: number) => {
        const response = await fetch(`/api/invites/${id}/revoke`, { method: "POST", credentials: "include" });
        if (!response.ok) throw new Error("Could not revoke invite.");
        await queryClient.invalidateQueries();
      },
    }),
    [queryClient],
  );

  if (user?.studioRole !== "STUDIO_OWNER" && user?.studioRole !== "STUDIO_ADMIN") {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">Organisation Access</h1>
        <p className="text-muted-foreground">Only studio admins can manage organisations and invites.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Organisation Access</h1>
        <p className="mt-1 text-muted-foreground">Create organisations, then invite users into them through Authentik-backed sign-in.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Workspaces</CardTitle>
            <CardDescription>Studio admins create branded organisations. Users are then attached by invite.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input placeholder="New organisation name" value={organisationName} onChange={(event) => setOrganisationName(event.target.value)} />
              <Button onClick={() => createOrganisation.mutate()} disabled={!organisationName || createOrganisation.isPending}>
                {createOrganisation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            <div className="space-y-3">
              {isOrganisationsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                organisations.map((organisation: any) => (
                  <div key={organisation.id} className="rounded-2xl border border-border/70 px-4 py-3">
                    <div className="font-medium">{organisation.displayName || organisation.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Slug: {organisation.publicSlug || "Not set"}</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Invite Users</CardTitle>
            <CardDescription>Invites are app-owned. The invited user signs in through Authentik, then the organisation membership is attached after callback.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder={activeOrganisationId ? "Invite email address" : "Select or create an organisation first"}
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                disabled={!activeOrganisationId}
              />
              <Button onClick={() => createInvite.mutate()} disabled={!inviteEmail || !activeOrganisationId || createInvite.isPending}>
                {createInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="space-y-3">
              {isInvitesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invites for the active organisation yet.</p>
              ) : (
                invites.map((invite: any) => (
                  <div key={invite.id} className="rounded-2xl border border-border/70 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{invite.email}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Status: {invite.status} · Expires {new Date(invite.expiresAt).toLocaleString()}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">Sign-in URL: `/api/auth/login?invite={invite.token}`</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="icon" variant="outline" onClick={() => inviteActions.resend(invite.id)}>
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => inviteActions.revoke(invite.id)}>
                          <Ban className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
