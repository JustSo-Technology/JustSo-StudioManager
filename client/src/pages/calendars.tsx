import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { useCalendarConnections, useCalendarResources, useCreateCalendarConnection, useDeleteCalendarConnection } from "@/hooks/use-calendars";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(2, "Calendar name is required"),
  provider: z.enum(["internal", "caldav"]),
  resourceName: z.string().min(2, "Calendar resource name is required"),
  resourceColor: z.string().optional(),
  calendarUrl: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

export default function Calendars() {
  const { data: profile } = useProfile();
  const { data: connections, isLoading } = useCalendarConnections();
  const { data: resources } = useCalendarResources();
  const createConnection = useCreateCalendarConnection();
  const deleteConnection = useDeleteCalendarConnection();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      provider: "internal",
      resourceName: "",
      resourceColor: profile?.brandColor || "#111827",
      calendarUrl: "",
      username: "",
      password: "",
    },
  });

  const provider = form.watch("provider");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Calendars</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Every bookable thing needs a calendar.</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            If you were the tenant, this is where you decide whether reservations live in a JustSo internal calendar or a connected CalDAV calendar like Nextcloud or iCloud.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl font-bold">Add calendar</h2>
          </div>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) =>
                createConnection.mutate(values, {
                  onSuccess: () => {
                    toast({ title: "Calendar added", description: "The calendar is ready to assign to bookable resources." });
                    form.reset({
                      name: "",
                      provider: "internal",
                      resourceName: "",
                      resourceColor: profile?.brandColor || "#111827",
                      calendarUrl: "",
                      username: "",
                      password: "",
                    });
                  },
                }),
              )}
              className="mt-6 space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Connection name</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="Main Studio Calendar" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provider</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl h-12">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="internal">Internal JustSo calendar</SelectItem>
                          <SelectItem value="caldav">CalDAV calendar</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <FormField
                  control={form.control}
                  name="resourceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calendar resource name</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12" placeholder="Brand Sessions" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="resourceColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Colour</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl h-12 md:w-28" type="color" {...field} value={field.value || "#111827"} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {provider === "caldav" && (
                <>
                  <FormField
                    control={form.control}
                    name="calendarUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CalDAV calendar URL</FormLabel>
                        <FormControl>
                          <Input className="rounded-xl h-12" placeholder="https://nextcloud.example.com/remote.php/dav/calendars/tenant/studio/" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input className="rounded-xl h-12" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password / app password</FormLabel>
                          <FormControl>
                            <Input className="rounded-xl h-12" type="password" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              <Button type="submit" className="rounded-full px-6" disabled={createConnection.isPending}>
                {createConnection.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create calendar"}
              </Button>
            </form>
          </Form>
        </div>

        <div className="rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold">Connected calendars</h2>
          <p className="mt-1 text-sm text-muted-foreground">Assign these calendars to services, spaces, or rentable gear before you publish them.</p>
          <div className="mt-6 space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : connections?.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/60 bg-muted/20 px-5 py-12 text-center">
                <p className="font-medium">No calendars yet</p>
                <p className="mt-2 text-sm text-muted-foreground">Start with an internal calendar if you want an easy Apple/Google subscription link.</p>
              </div>
            ) : (
              connections?.map((connection: any) => {
                const resource = resources?.find((item: any) => item.connectionId === connection.id);
                const icsUrl = resource ? `${window.location.origin}/api/public/calendars/${resource.id}.ics` : null;
                return (
                  <div key={connection.id} className="rounded-3xl border border-border/60 bg-muted/10 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-xl font-bold">{connection.name}</h3>
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{connection.provider}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${connection.syncStatus === "connected" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {connection.syncStatus}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">Resource: {resource?.name || "Not configured"}</p>
                        {connection.provider === "caldav" && connection.calendarUrl && (
                          <p className="mt-1 break-all text-xs text-muted-foreground">{connection.calendarUrl}</p>
                        )}
                        {resource && connection.provider === "internal" && icsUrl && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <a href={icsUrl} target="_blank" rel="noreferrer" className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/30 hover:text-primary">
                              ICS feed
                            </a>
                            <button
                              type="button"
                              onClick={async () => {
                                await navigator.clipboard.writeText(icsUrl);
                                toast({ title: "ICS link copied", description: "Use this link to subscribe in Apple Calendar or Google Calendar." });
                              }}
                              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/30 hover:text-primary"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy subscription link
                            </button>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          deleteConnection.mutate(connection.id, {
                            onSuccess: () => toast({ title: "Calendar removed" }),
                          })
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
