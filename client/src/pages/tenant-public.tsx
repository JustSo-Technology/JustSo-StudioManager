import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { CalendarDays, Clock3, Loader2, MailCheck, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePublicTenant, useSendGuestVerification, useStartGuestBooking, useVerifyGuestBooking } from "@/hooks/use-public-tenant";

type ResourceSelection =
  | { kind: "service"; id: number; label: string }
  | { kind: "space"; id: number; label: string };

export default function TenantPublicPage() {
  const [, params] = useRoute("/u/:slug");
  const slug = params?.slug || "";
  const { data, isLoading, isError } = usePublicTenant(slug);
  const startBooking = useStartGuestBooking();
  const sendVerification = useSendGuestVerification();
  const verifyBooking = useVerifyGuestBooking();

  const [selected, setSelected] = useState<ResourceSelection | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const resources = useMemo(() => {
    if (!data) {
      return [];
    }
    return [
      ...(data.services || []).map((service: any) => ({ kind: "service" as const, id: service.id, label: service.name, description: service.description, meta: `$${service.price} · ${service.durationMinutes} mins` })),
      ...(data.spaces || []).map((space: any) => ({ kind: "space" as const, id: space.id, label: space.name, description: space.description, meta: space.capacity ? `${space.capacity} people` : "Bookable space" })),
    ];
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data?.profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-lg rounded-[2rem] border border-border/60 bg-card p-8 text-center shadow-sm">
          <h1 className="font-display text-3xl font-bold">Tenant page not found</h1>
          <p className="mt-3 text-muted-foreground">This public page either does not exist yet or is still being configured.</p>
        </div>
      </div>
    );
  }

  const profile = data.profile;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.06),_transparent_44%),linear-gradient(180deg,_#fcfcfc_0%,_#f6f5f2_100%)] text-foreground">
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <section className="overflow-hidden rounded-[2.5rem] border border-black/5 bg-white shadow-[0_40px_120px_rgba(17,24,39,0.08)]">
          <div
            className="px-6 py-10 md:px-12 md:py-14"
            style={{
              background: `linear-gradient(135deg, ${profile.brandColor || "#111827"} 0%, rgba(17,24,39,0.92) 100%)`,
            }}
          >
            <p className="text-xs uppercase tracking-[0.28em] text-white/60">JustSo. Studios tenant page</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight text-white md:text-6xl">
              {profile.heroTitle || profile.displayName || profile.tenantName}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-white/78">
              {profile.heroDescription || profile.tagline || "Request a booking and confirm it with a one-time code sent to your email."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/80">
              {profile.contactEmail && <span className="rounded-full border border-white/20 px-3 py-1.5">{profile.contactEmail}</span>}
              {profile.contactPhone && <span className="rounded-full border border-white/20 px-3 py-1.5">{profile.contactPhone}</span>}
              {profile.websiteUrl && <span className="rounded-full border border-white/20 px-3 py-1.5">{profile.websiteUrl}</span>}
            </div>
          </div>

          <div className="grid gap-8 px-6 py-8 md:px-12 md:py-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-8">
              <section>
                <h2 className="font-display text-3xl font-bold">About</h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  {profile.bio || "This tenant has not added a full studio bio yet."}
                </p>
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-3xl font-bold">Bookable offerings</h2>
                </div>
                <div className="mt-5 grid gap-4">
                  {resources.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-border/60 bg-muted/20 px-5 py-12 text-center">
                      <p className="font-medium">No public offerings yet.</p>
                      <p className="mt-2 text-sm text-muted-foreground">This tenant still needs to publish services or spaces from the backend.</p>
                    </div>
                  ) : (
                    resources.map((resource) => (
                      <button
                        key={`${resource.kind}-${resource.id}`}
                        type="button"
                        onClick={() => {
                          setSelected({ kind: resource.kind, id: resource.id, label: resource.label });
                          setStatusMessage(null);
                        }}
                        className={`rounded-[2rem] border px-5 py-5 text-left transition ${
                          selected?.kind === resource.kind && selected?.id === resource.id
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border/60 bg-white hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-display text-2xl font-bold">{resource.label}</p>
                            <p className="mt-2 text-sm text-muted-foreground">{resource.description || "No description yet."}</p>
                          </div>
                          <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">{resource.meta}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </div>

            <aside className="rounded-[2rem] border border-border/60 bg-[#faf8f4] p-6 shadow-sm">
              <h2 className="font-display text-3xl font-bold">Request a booking</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose an offering, enter your details, then confirm the booking with the one-time code sent to your email.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Selected offering</label>
                  <div className="rounded-2xl border border-border/60 bg-white px-4 py-3 text-sm">
                    {selected ? selected.label : "Choose a service or space from the list"}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Your name</label>
                    <Input className="h-12 rounded-xl bg-white" value={guestName} onChange={(event) => setGuestName(event.target.value)} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Email</label>
                    <Input className="h-12 rounded-xl bg-white" type="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Start time</label>
                    <Input className="h-12 rounded-xl bg-white" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">End time</label>
                    <Input className="h-12 rounded-xl bg-white" type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Notes</label>
                  <Textarea className="min-h-[100px] rounded-xl bg-white" value={notes} onChange={(event) => setNotes(event.target.value)} />
                </div>

                <Button
                  className="w-full rounded-full"
                  disabled={!selected || startBooking.isPending || sendVerification.isPending}
                  onClick={() => {
                    if (!selected) {
                      return;
                    }
                    const currentSelection = selected;
                    startBooking.mutate(
                      {
                        guestName,
                        guestEmail,
                        notes,
                        startTime,
                        endTime,
                        ...(currentSelection.kind === "service" ? { serviceId: currentSelection.id } : { spaceId: currentSelection.id }),
                      },
                      {
                        onSuccess: (booking) => {
                          setBookingId(booking.id);
                          sendVerification.mutate(
                            { email: guestEmail, bookingId: booking.id },
                            {
                              onSuccess: () => setStatusMessage("We sent a verification code to your email. Enter it below to confirm."),
                              onError: (error) => setStatusMessage(error.message),
                            },
                          );
                        },
                        onError: (error) => setStatusMessage(error.message),
                      },
                    );
                  }}
                >
                  {startBooking.isPending || sendVerification.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send verification code"}
                </Button>

                {bookingId && (
                  <div className="rounded-[1.75rem] border border-border/60 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <MailCheck className="h-5 w-5 text-primary" />
                      <p className="font-medium">Confirm your reservation</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Paste the one-time code from your email to finalise the booking.</p>
                    <div className="mt-4 flex gap-3">
                      <Input className="h-12 rounded-xl" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} placeholder="6-digit code" />
                      <Button
                        className="rounded-full"
                        disabled={verifyBooking.isPending}
                        onClick={() =>
                          verifyBooking.mutate(
                            { email: guestEmail, code: verificationCode, bookingId },
                            {
                              onSuccess: () => setStatusMessage("Booking confirmed. Your reservation has been added to the assigned calendar."),
                              onError: (error) => setStatusMessage(error.message),
                            },
                          )
                        }
                      >
                        {verifyBooking.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                      </Button>
                    </div>
                  </div>
                )}

                {statusMessage && <p className="rounded-2xl bg-white px-4 py-3 text-sm text-muted-foreground">{statusMessage}</p>}

                {(profile.bookingNotes || profile.bookingTerms) && (
                  <div className="space-y-3 rounded-[1.75rem] border border-border/60 bg-white p-4 text-sm text-muted-foreground">
                    {profile.bookingNotes && (
                      <div>
                        <p className="font-medium text-foreground">Booking notes</p>
                        <p className="mt-1">{profile.bookingNotes}</p>
                      </div>
                    )}
                    {profile.bookingTerms && (
                      <div>
                        <p className="font-medium text-foreground">Booking terms</p>
                        <p className="mt-1 whitespace-pre-wrap">{profile.bookingTerms}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[2rem] border border-border/60 bg-white p-5 shadow-sm">
            <Clock3 className="h-8 w-8 text-primary" />
            <h3 className="mt-4 font-display text-xl font-bold">Email verification</h3>
            <p className="mt-2 text-sm text-muted-foreground">No account required. Guests confirm by email before the reservation becomes final.</p>
          </div>
          <div className="rounded-[2rem] border border-border/60 bg-white p-5 shadow-sm">
            <MapPin className="h-8 w-8 text-primary" />
            <h3 className="mt-4 font-display text-xl font-bold">Calendar-backed availability</h3>
            <p className="mt-2 text-sm text-muted-foreground">Each bookable offering is tied to a calendar from the tenant backend before it can appear here.</p>
          </div>
          <div className="rounded-[2rem] border border-border/60 bg-white p-5 shadow-sm">
            <CalendarDays className="h-8 w-8 text-primary" />
            <h3 className="mt-4 font-display text-xl font-bold">Simple public flow</h3>
            <p className="mt-2 text-sm text-muted-foreground">This v1 focuses on a single branded page and one clear booking path rather than a full public CMS.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
