import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Building2, Calendar, Package, Briefcase, Users } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const roleDisplay = profile?.role || "User";
  const firstName = user?.firstName || user?.email?.split('@')[0] || "there";
  const isInternalUser = profile?.role === "admin" || profile?.role === "tenant";

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-8 md:p-12 shadow-xl shadow-primary/10">
        <div className="relative z-10 max-w-2xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Welcome back, {firstName}.
          </h1>
          <p className="text-primary-foreground/80 text-lg md:text-xl mb-8">
            {isInternalUser 
              ? "Manage your creative studio bookings, internal services, and inventory all in one place."
              : "Discover and book services from our talented creators at JustSo. Studios."
            }
          </p>
          <div className="flex items-center gap-3 text-sm font-medium flex-wrap">
            <span className="bg-primary-foreground/10 px-3 py-1 rounded-full border border-primary-foreground/20">
              Role: <span className="capitalize">{roleDisplay}</span>
            </span>
            {profile?.tenantName && (
              <span className="bg-primary-foreground/10 px-3 py-1 rounded-full border border-primary-foreground/20">
                Tenant: {profile.tenantName}
              </span>
            )}
          </div>
        </div>
        
        {/* Abstract background shapes */}
        <div className="absolute right-0 top-0 w-1/2 h-full opacity-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-[40px] border-white rounded-full mix-blend-overlay" />
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold mb-6">
          {isInternalUser ? "Studio Management" : "Quick Actions"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isInternalUser && (
            <Link href="/teams" className="group">
              <div className="h-full bg-card rounded-2xl p-6 border border-border hover:border-primary/30 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <Users size={24} />
                </div>
                <h3 className="font-display font-bold text-xl mb-2">Manage Teams</h3>
                <p className="text-muted-foreground text-sm">Create teams and manage member access.</p>
              </div>
            </Link>
          )}

          {isInternalUser && (
            <Link href="/spaces" className="group">
              <div className="h-full bg-card rounded-2xl p-6 border border-border hover:border-primary/30 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <Building2 size={24} />
                </div>
                <h3 className="font-display font-bold text-xl mb-2">Manage Spaces</h3>
                <p className="text-muted-foreground text-sm">Configure and manage communal studio spaces.</p>
              </div>
            </Link>
          )}
          
          <Link href="/services" className="group">
            <div className="h-full bg-card rounded-2xl p-6 border border-border hover:border-primary/30 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                <Briefcase size={24} />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">
                {isInternalUser ? "Manage Services" : "Discover Services"}
              </h3>
              <p className="text-muted-foreground text-sm">
                {isInternalUser 
                  ? "Create and manage your service offerings."
                  : "Explore and book specialized services offered by our resident tenants."
                }
              </p>
            </div>
          </Link>

          <Link href="/bookings" className="group">
            <div className="h-full bg-card rounded-2xl p-6 border border-border hover:border-primary/30 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                <Calendar size={24} />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">
                {isInternalUser ? "View Bookings" : "Your Bookings"}
              </h3>
              <p className="text-muted-foreground text-sm">
                {isInternalUser
                  ? "Monitor all bookings and customer reservations."
                  : "Track and manage your service bookings."
                }
              </p>
            </div>
          </Link>

          {isInternalUser && (
            <Link href="/inventory" className="group">
              <div className="h-full bg-card rounded-2xl p-6 border border-border hover:border-primary/30 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <Package size={24} />
                </div>
                <h3 className="font-display font-bold text-xl mb-2">Manage Inventory</h3>
                <p className="text-muted-foreground text-sm">Track your equipment and inventory assets.</p>
              </div>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
