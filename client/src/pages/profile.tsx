import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, User as UserIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  tenantName: z.string().min(2, "Workspace name is required"),
  displayName: z.string().min(2, "Display name is required"),
  publicSlug: z.string().min(2, "Public slug is required"),
  tagline: z.string().optional(),
  heroTitle: z.string().optional(),
  heroDescription: z.string().optional(),
  bio: z.string().optional(),
  contactEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  websiteUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  coverImageUrl: z.string().optional(),
  brandColor: z.string().optional(),
  bookingNotes: z.string().optional(),
  bookingTerms: z.string().optional(),
});

export default function Profile() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tenantName: "",
      displayName: "",
      publicSlug: "",
      tagline: "",
      heroTitle: "",
      heroDescription: "",
      bio: "",
      contactEmail: "",
      contactPhone: "",
      websiteUrl: "",
      instagramUrl: "",
      logoUrl: "",
      coverImageUrl: "",
      brandColor: "#111827",
      bookingNotes: "",
      bookingTerms: "",
    },
  });

  useEffect(() => {
    if (!profile) {
      return;
    }
    form.reset({
      tenantName: profile.tenantName || "",
      displayName: profile.displayName || profile.tenantName || "",
      publicSlug: profile.publicSlug || "",
      tagline: profile.tagline || "",
      heroTitle: profile.heroTitle || "",
      heroDescription: profile.heroDescription || "",
      bio: profile.bio || "",
      contactEmail: profile.contactEmail || "",
      contactPhone: profile.contactPhone || "",
      websiteUrl: profile.websiteUrl || "",
      instagramUrl: profile.instagramUrl || "",
      logoUrl: profile.logoUrl || "",
      coverImageUrl: profile.coverImageUrl || "",
      brandColor: profile.brandColor || "#111827",
      bookingNotes: profile.bookingNotes || "",
      bookingTerms: profile.bookingTerms || "",
    });
  }, [profile, form]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Brand &amp; Profile</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Shape the public face of your studio.</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            If you were the tenant sharing this with real clients, this is where you would set the brand voice, contact details, booking notes, and the public URL people trust.
          </p>
        </div>
        {profile?.publicSlug && (
          <a href={`/u/${profile.publicSlug}`} target="_blank" rel="noreferrer" className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-primary/30 hover:text-primary">
            Preview /u/{profile.publicSlug}
          </a>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {user?.firstName?.[0] ? <span className="text-2xl font-bold">{user.firstName[0]}</span> : <UserIcon className="h-7 w-7" />}
            </div>
            <div>
              <p className="font-display text-xl font-bold">{profile?.displayName || profile?.tenantName || "Workspace"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl bg-muted/30 p-4">
              <p className="font-medium text-foreground">Tenant check</p>
              <p className="mt-1">Would you feel comfortable sending this page link to a client today?</p>
            </div>
            <div className="rounded-2xl bg-muted/30 p-4">
              <p className="font-medium text-foreground">Calendar check</p>
              <p className="mt-1">Do your public services and spaces point at calendars that will actually keep reservations visible?</p>
            </div>
            <div className="rounded-2xl bg-muted/30 p-4">
              <p className="font-medium text-foreground">Trust check</p>
              <p className="mt-1">Are your booking notes and terms clear enough for a first-time guest verifying by email?</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => updateProfile.mutate(values))} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="tenantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workspace name</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="JustSo. Portrait Studio" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public display name</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="JustSo. Portrait Studio" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <FormField
                  control={form.control}
                  name="publicSlug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public page slug</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="justso-portraits" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="brandColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand color</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12 w-full md:w-32" type="color" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="tagline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tagline</FormLabel>
                    <FormControl>
                      <Input className="rounded-xl h-12" placeholder="Portraits, studio hire, and creative production." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="heroTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public hero title</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="Book your next session with confidence." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="heroDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public hero description</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="A short sentence explaining what makes your studio valuable." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>About your studio</FormLabel>
                    <FormControl>
                      <Textarea className="rounded-xl min-h-[120px]" placeholder="Tell clients what you do, how you work, and what kind of projects you’re best at." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact email</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="hello@yourstudio.com" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact phone</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="+61 ..." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="websiteUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website URL</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="https://yourstudio.com" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="instagramUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instagram URL</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="https://instagram.com/yourstudio" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo image URL</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="https://..." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="coverImageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cover image URL</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="https://..." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="bookingNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Booking notes</FormLabel>
                    <FormControl>
                      <Textarea className="rounded-xl min-h-[100px]" placeholder="What should a guest know before requesting a booking?" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bookingTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Booking terms</FormLabel>
                    <FormControl>
                      <Textarea className="rounded-xl min-h-[120px]" placeholder="Cancellation policy, arrival expectations, rescheduling terms..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="rounded-full px-6" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save brand profile"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
