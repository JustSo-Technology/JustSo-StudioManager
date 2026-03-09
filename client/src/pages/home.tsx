import { Link } from "wouter";
import { Briefcase, CalendarDays, CalendarRange, ExternalLink, Image, Package, PanelTop } from "lucide-react";
import { useBookings } from "@/hooks/use-bookings";
import { useCalendarConnections, useCalendarResources } from "@/hooks/use-calendars";
import { useInventory } from "@/hooks/use-inventory";
import { useProfile } from "@/hooks/use-profile";
import { useServices } from "@/hooks/use-services";
import { useSpaces } from "@/hooks/use-spaces";

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card px-5 py-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function Home() {
  const { data: profile } = useProfile();
  const { data: services } = useServices();
  const { data: spaces } = useSpaces();
  const { data: inventory } = useInventory();
  const { data: bookings } = useBookings();
  const { data: calendarConnections } = useCalendarConnections();
  const { data: calendarResources } = useCalendarResources();

  const publicServices = services?.filter((service) => service.visibility === "public").length ?? 0;
  const publicSpaces = spaces?.filter((space) => space.visibility === "public" && space.isBookable).length ?? 0;
  const rentableItems = inventory?.filter((item) => item.isAvailableForHire).length ?? 0;
  const syncedBookings = bookings?.filter((booking) => booking.syncState === "synced").length ?? 0;

  const checklist = [
    {
      title: "Finish your brand profile",
      done: !!profile?.displayName && !!profile?.publicSlug && !!profile?.heroTitle,
      href: "/profile",
    },
    {
      title: "Connect or create calendars",
      done: (calendarResources?.length ?? 0) > 0,
      href: "/calendars",
    },
    {
      title: "Publish at least one service or bookable space",
      done: publicServices + publicSpaces > 0,
      href: "/services",
    },
    {
      title: "Preview your public page",
      done: !!profile?.publicSlug,
      href: "/public-page",
    },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="relative overflow-hidden rounded-[2rem] bg-primary text-primary-foreground p-8 md:p-12 shadow-xl shadow-primary/10">
        <div className="relative z-10 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.22em] text-primary-foreground/60">Tenant Overview</p>
          <h1 className="mt-4 font-display text-4xl md:text-6xl font-bold tracking-tight">
            {profile?.displayName || profile?.tenantName || "Your workspace"} is ready to publish and book.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-primary-foreground/80">
            Treat this space as your operational backend: connect calendars, publish services, track reservations, and keep your public page on-brand.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/public-page" className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-primary transition hover:opacity-90">
              Preview public page
            </Link>
            <Link href="/calendars" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-primary-foreground/90 transition hover:bg-white/10">
              Manage calendars
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.22),_transparent_58%)] md:block" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Public services" value={publicServices} detail="Offerings customers can book from your microsite." />
        <StatCard label="Bookable spaces" value={publicSpaces} detail="Spaces with a calendar assignment and public visibility." />
        <StatCard label="Rentable items" value={rentableItems} detail="Inventory available for reservation or hire." />
        <StatCard label="Synced reservations" value={syncedBookings} detail="Confirmed bookings that made it into their assigned calendars." />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">Setup checklist</h2>
              <p className="mt-1 text-sm text-muted-foreground">The minimum a tenant needs before sharing a public booking link.</p>
            </div>
            <PanelTop className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-6 space-y-3">
            {checklist.map((item) => (
              <Link key={item.title} href={item.href} className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-4 transition hover:border-primary/30 hover:bg-muted/20">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.done ? "Complete" : "Needs attention"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {item.done ? "Done" : "Open"}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold">Tenant lens</h2>
          <p className="mt-1 text-sm text-muted-foreground">What matters if you are the tenant managing a real studio business?</p>
          <div className="mt-6 space-y-4 text-sm text-muted-foreground">
            <div className="rounded-2xl bg-muted/30 p-4">
              <p className="font-medium text-foreground">Can I trust availability?</p>
              <p className="mt-1">Every bookable service, space, and rentable item needs an assigned calendar before it can go live.</p>
            </div>
            <div className="rounded-2xl bg-muted/30 p-4">
              <p className="font-medium text-foreground">Can I share something polished?</p>
              <p className="mt-1">Your public slug, headline, contact details, and booking terms should be complete before promotion.</p>
            </div>
            <div className="rounded-2xl bg-muted/30 p-4">
              <p className="font-medium text-foreground">Will reservations stay organized?</p>
              <p className="mt-1">Track sync health from bookings and calendars so no confirmed reservation disappears into a blind spot.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/services" className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <Briefcase className="h-10 w-10 text-primary" />
          <h3 className="mt-4 font-display text-xl font-bold">Services</h3>
          <p className="mt-2 text-sm text-muted-foreground">Create public offerings and attach them to the right calendar.</p>
        </Link>
        <Link href="/spaces" className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <Image className="h-10 w-10 text-primary" />
          <h3 className="mt-4 font-display text-xl font-bold">Spaces</h3>
          <p className="mt-2 text-sm text-muted-foreground">Define bookable spaces and decide what belongs on your public page.</p>
        </Link>
        <Link href="/bookings" className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <CalendarDays className="h-10 w-10 text-primary" />
          <h3 className="mt-4 font-display text-xl font-bold">Bookings</h3>
          <p className="mt-2 text-sm text-muted-foreground">Review guest reservations, sync health, and pending verification states.</p>
        </Link>
        <Link href="/calendars" className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <CalendarRange className="h-10 w-10 text-primary" />
          <h3 className="mt-4 font-display text-xl font-bold">Calendars</h3>
          <p className="mt-2 text-sm text-muted-foreground">Create internal calendars or attach CalDAV calendars that tenants can subscribe to.</p>
        </Link>
      </section>

      <section className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Public page status</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.publicSlug ? `Your public page is available at /u/${profile.publicSlug}` : "Pick a public slug in Brand & Profile to generate your page link."}
            </p>
          </div>
          {profile?.publicSlug && (
            <a
              href={`/u/${profile.publicSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:text-primary"
            >
              Open public page
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
