import { BadgeCheck, ExternalLink, Mail, Shield, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function UserProfile() {
  const { user, authentikAccountUrl } = useAuth();

  return (
    <div className="mx-auto max-w-3xl animate-in fade-in duration-500 space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Account</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Your user profile</h1>
        <p className="mt-2 text-muted-foreground">Personal identity is managed by Authentik. These details are shown from your current account session.</p>
      </div>

      <div className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          {user?.profileImageUrl ? (
            <img src={user.profileImageUrl} alt={user.fullName || user.username || "User avatar"} className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {user?.firstName?.[0] ? <span className="text-xl font-bold">{user.firstName[0]}</span> : <UserIcon className="h-6 w-6" />}
            </div>
          )}
          <div className="space-y-1">
            <p className="font-display text-2xl font-bold">{user?.fullName || user?.username || "User"}</p>
            <p className="text-sm text-muted-foreground">@{user?.username || "unknown"}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="flex items-center gap-3 rounded-xl bg-muted/30 px-4 py-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{user?.email || "No email on file"}</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-muted/30 px-4 py-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Studio role: {user?.studioRole || "STUDIO_MEMBER"}</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-muted/30 px-4 py-3">
            <BadgeCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Authentication source: Authentik OIDC</span>
          </div>
        </div>

        {authentikAccountUrl ? (
          <div className="mt-6">
            <a href={authentikAccountUrl} target="_blank" rel="noreferrer">
              <Button className="rounded-full">
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage account in Authentik
              </Button>
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
