import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, Mail, RefreshCcw, Send } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { useEmailHealth, useEmailReminders, useEmailSettings, useSendTestEmail, useUpdateEmailSettings } from "@/hooks/use-email-settings";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@shared/routes";

const formSchema = api.admin.emailSettings.update.input.extend({
  smtpPassword: z.string().optional(),
  replyToEmail: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not yet tested";
  }
  return new Date(value).toLocaleString();
}

function getStatusTone(configured: boolean, enabled: boolean, failedReminders: number) {
  if (!configured || !enabled) {
    return "secondary";
  }
  if (failedReminders > 0) {
    return "destructive";
  }
  return "default";
}

export default function EmailSettingsPage() {
  const { toast } = useToast();
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const isAdmin = profile?.role === "admin";

  const { data: settings, isLoading: isSettingsLoading, refetch: refetchSettings } = useEmailSettings(isAdmin);
  const { data: health, isLoading: isHealthLoading, refetch: refetchHealth } = useEmailHealth(isAdmin);
  const { data: reminders, isLoading: isRemindersLoading, refetch: refetchReminders } = useEmailReminders(isAdmin);
  const updateSettings = useUpdateEmailSettings();
  const sendTestEmail = useSendTestEmail();
  const [testEmail, setTestEmail] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      smtpHost: "",
      smtpPort: 587,
      smtpUsername: "",
      smtpPassword: "",
      securityMode: "starttls",
      fromName: "",
      fromEmail: "",
      replyToEmail: "",
      enabled: false,
    },
  });

  useEffect(() => {
    if (!settings) {
      return;
    }

    form.reset({
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUsername: settings.smtpUsername,
      smtpPassword: "",
      securityMode: settings.securityMode as FormValues["securityMode"],
      fromName: settings.fromName,
      fromEmail: settings.fromEmail,
      replyToEmail: settings.replyToEmail || "",
      enabled: settings.enabled,
    });
    setTestEmail(settings.fromEmail);
  }, [form, settings]);

  const recentReminders = useMemo(() => {
    return [...(reminders || [])]
      .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime())
      .slice(0, 6);
  }, [reminders]);

  if (isProfileLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Admin</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Email settings</h1>
        </div>
        <Alert variant="destructive" className="max-w-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Admin access required</AlertTitle>
          <AlertDescription>This screen is reserved for the platform admin tenant because it controls app-wide OTPs, confirmations, and reminders.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Admin</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Email settings</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            If you were running JustSo. for real tenants, this page should answer one question quickly: will booking emails actually send and keep sending.
          </p>
        </div>
        <Badge variant={getStatusTone(!!health?.configured, !!health?.enabled, health?.failedReminders || 0)}>
          {!health?.configured ? "Not configured" : !health.enabled ? "Configured but disabled" : health.failedReminders ? "Needs attention" : "Operational"}
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[2rem] border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-3xl">SMTP transport</CardTitle>
            <CardDescription>Store one app-wide mail transport for OTPs, confirmations, and reminders. Passwords are masked after save and kept server-side.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="space-y-5"
                onSubmit={form.handleSubmit((values) =>
                  updateSettings.mutate(values, {
                    onSuccess: () => {
                      toast({ title: "Email settings saved", description: "Booking emails now use the updated SMTP transport." });
                      refetchSettings();
                      refetchHealth();
                    },
                    onError: (error) => {
                      toast({ title: "Could not save email settings", description: error.message, variant: "destructive" });
                    },
                  }),
                )}
              >
                <div className="grid gap-4 md:grid-cols-[1fr_140px]">
                  <FormField
                    control={form.control}
                    name="smtpHost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP host</FormLabel>
                        <FormControl>
                          <Input className="h-12 rounded-xl" placeholder="smtp.mailprovider.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="smtpPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Port</FormLabel>
                        <FormControl>
                          <Input
                            className="h-12 rounded-xl"
                            type="number"
                            min={1}
                            max={65535}
                            {...field}
                            onChange={(event) => field.onChange(Number(event.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="smtpUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input className="h-12 rounded-xl" placeholder="smtp-user@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="smtpPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password / app password</FormLabel>
                        <FormControl>
                          <Input className="h-12 rounded-xl" type="password" placeholder={settings ? "Leave blank to keep the saved secret" : "Enter SMTP password"} {...field} />
                        </FormControl>
                        {settings?.smtpPasswordEncrypted ? <p className="text-xs text-muted-foreground">Saved secret: {settings.smtpPasswordEncrypted}</p> : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="securityMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Security mode</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="starttls">STARTTLS</SelectItem>
                            <SelectItem value="ssl">SSL / TLS</SelectItem>
                            <SelectItem value="none">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="rounded-2xl border border-border/60 px-4 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <FormLabel>Enable outbound email</FormLabel>
                            <p className="mt-1 text-sm text-muted-foreground">When enabled, public OTP requests and booking emails use this transport immediately.</p>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fromName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From name</FormLabel>
                        <FormControl>
                          <Input className="h-12 rounded-xl" placeholder="JustSo. Studios" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fromEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From email</FormLabel>
                        <FormControl>
                          <Input className="h-12 rounded-xl" type="email" placeholder="bookings@justso.studio" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="replyToEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reply-to email</FormLabel>
                      <FormControl>
                        <Input className="h-12 rounded-xl" type="email" placeholder="Optional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" className="rounded-full px-6" disabled={updateSettings.isPending}>
                    {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Save email settings
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full px-5"
                    disabled={isSettingsLoading || isHealthLoading}
                    onClick={() => {
                      refetchSettings();
                      refetchHealth();
                      refetchReminders();
                    }}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh status
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[2rem] border-border/60">
            <CardHeader>
              <CardTitle className="font-display text-3xl">Health</CardTitle>
              <CardDescription>One view for transport readiness, reminder backlog, and the last failed send.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isHealthLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Transport</p>
                      <p className="mt-2 text-2xl font-semibold">{health?.configured ? (health.enabled ? "Live" : "Disabled") : "Missing"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Last test</p>
                      <p className="mt-2 text-sm font-medium">{formatDateTime(health?.lastTestedAt || null)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{health?.lastTestStatus || "No test yet"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pending reminders</p>
                      <p className="mt-2 text-2xl font-semibold">{health?.pendingReminders || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Failed reminders</p>
                      <p className="mt-2 text-2xl font-semibold">{health?.failedReminders || 0}</p>
                    </div>
                  </div>

                  {health?.lastReminderError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Latest reminder failure</AlertTitle>
                      <AlertDescription>{health.lastReminderError}</AlertDescription>
                    </Alert>
                  ) : (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>No current reminder failures</AlertTitle>
                      <AlertDescription>The reminder poller has not reported a failed delivery.</AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-border/60">
            <CardHeader>
              <CardTitle className="font-display text-3xl">Send test email</CardTitle>
              <CardDescription>Verify the SMTP transport before relying on guest OTPs and booking notifications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input className="h-12 rounded-xl" type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="admin@example.com" />
              <Button
                className="w-full rounded-full"
                disabled={sendTestEmail.isPending}
                onClick={() =>
                  sendTestEmail.mutate(testEmail, {
                    onSuccess: ({ message }) => {
                      toast({ title: "Test email sent", description: message });
                      refetchHealth();
                    },
                    onError: (error) => {
                      toast({ title: "Test email failed", description: error.message, variant: "destructive" });
                      refetchHealth();
                    },
                  })
                }
              >
                {sendTestEmail.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send test email
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="rounded-[2rem] border-border/60">
        <CardHeader>
          <CardTitle className="font-display text-3xl">Recent reminder jobs</CardTitle>
          <CardDescription>Keep this list short and legible. If I were the admin tenant, I’d want to know which booking failed and whether retries are happening.</CardDescription>
        </CardHeader>
        <CardContent>
          {isRemindersLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : recentReminders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/60 bg-muted/10 px-5 py-12 text-center">
              <p className="font-medium">No reminder jobs yet</p>
              <p className="mt-2 text-sm text-muted-foreground">Confirmed bookings that are more than 24 hours away will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentReminders.map((reminder) => (
                <div key={reminder.id} className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-muted/10 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">Booking #{reminder.bookingId}</p>
                      <Badge variant={reminder.status === "failed" ? "destructive" : reminder.status === "sent" ? "default" : "secondary"}>{reminder.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Scheduled for {new Date(reminder.scheduledFor).toLocaleString()}</p>
                    {reminder.lastError ? <p className="mt-1 text-sm text-destructive">{reminder.lastError}</p> : null}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Attempts: {reminder.attemptCount}
                    {reminder.sentAt ? <span className="ml-3">Sent: {new Date(reminder.sentAt).toLocaleString()}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
