import { ExternalLink, Loader2 } from "lucide-react";
import { useInventory } from "@/hooks/use-inventory";
import { useProfile } from "@/hooks/use-profile";
import { useServices } from "@/hooks/use-services";
import { useSpaces } from "@/hooks/use-spaces";

export default function PublicPage() {
  const { data: profile, isLoading } = useProfile();
  const { data: services } = useServices();
  const { data: spaces } = useSpaces();
  const { data: inventory } = useInventory();

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const publicServices = services?.filter((service) => service.visibility === "public") ?? [];
  const publicSpaces = spaces?.filter((space) => space.visibility === "public" && space.isBookable) ?? [];
  const publicInventory = inventory?.filter((item) => item.visibility === "public" && item.isAvailableForHire) ?? [];
  const previewUrl = profile?.publicSlug ? `/u/${profile.publicSlug}` : null;

  const blockers = [
    !profile?.publicSlug && "Set a public slug in Brand & Profile.",
    !profile?.heroTitle && "Add a public hero title.",
    !profile?.contactEmail && "Add a contact email clients can trust.",
    publicServices.length + publicSpaces.length === 0 && "Publish at least one public service or bookable space.",
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Public Page</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">The page guests will actually see.</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            If you were the tenant, this is where you confirm the public page feels credible, branded, and ready for guests who only verify by email.
          </p>
        </div>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-primary/30 hover:text-primary">
            Open public page
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold">Publishing status</h2>
          <p className="mt-1 text-sm text-muted-foreground">{blockers.length === 0 ? "Your page is ready to share." : "These blockers still stand between you and a confident public launch."}</p>
          <div className="mt-6 space-y-3">
            {blockers.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm text-emerald-700">No blockers. You can share this page now.</div>
            ) : (
              blockers.map((blocker) => (
                <div key={blocker} className="rounded-2xl bg-amber-50 px-4 py-4 text-sm text-amber-700">
                  {blocker}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold">What guests can book</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-muted/20 p-5">
              <p className="text-sm text-muted-foreground">Services</p>
              <p className="mt-2 font-display text-3xl font-bold">{publicServices.length}</p>
            </div>
            <div className="rounded-2xl bg-muted/20 p-5">
              <p className="text-sm text-muted-foreground">Bookable spaces</p>
              <p className="mt-2 font-display text-3xl font-bold">{publicSpaces.length}</p>
            </div>
            <div className="rounded-2xl bg-muted/20 p-5">
              <p className="text-sm text-muted-foreground">Rentable inventory</p>
              <p className="mt-2 font-display text-3xl font-bold">{publicInventory.length}</p>
            </div>
          </div>
          <div className="mt-6 rounded-3xl border border-border/60 bg-muted/10 p-5">
            <p className="font-medium text-foreground">Preview mindset</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask the tenant question directly: would you trust this page if you were a new customer finding the studio for the first time? If not, tighten the headline, contact details, or offering list before sharing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
