import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User as UserIcon } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect } from "react";

const formSchema = z.object({
  role: z.enum(['admin', 'tenant', 'user']),
  tenantName: z.string().optional(),
  bio: z.string().optional(),
});

export default function Profile() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateMutation = useUpdateProfile();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: 'user',
      tenantName: "",
      bio: "",
    },
  });

  // Populate form when profile data loads
  useEffect(() => {
    if (profile) {
      form.reset({
        role: (profile.role as any) || 'user',
        tenantName: profile.tenantName || "",
        bio: profile.bio || "",
      });
    }
  }, [profile, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    updateMutation.mutate(values);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Your Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings and role.</p>
      </div>

      <div className="bg-card rounded-3xl border border-border shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-6 mb-8 pb-8 border-b border-border/50">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shrink-0">
            {user?.firstName?.[0] || <UserIcon size={32} />}
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">{user?.firstName} {user?.lastName}</h2>
            <p className="text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl h-12" data-testid="select-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">External User</SelectItem>
                      <SelectItem value="tenant">Studio Tenant</SelectItem>
                      <SelectItem value="admin">JustSo. Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Change your role to test different access levels in the application.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("role") === "tenant" && (
              <FormField
                control={form.control}
                name="tenantName"
                render={({ field }) => (
                  <FormItem className="animate-in fade-in slide-in-from-top-2">
                    <FormLabel>Business / Tenant Name</FormLabel>
                    <FormControl>
                      <Input className="rounded-xl h-12" placeholder="Your business name" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea 
                      className="rounded-xl resize-none min-h-[120px]" 
                      placeholder="Tell us a bit about yourself..." 
                      {...field} 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full md:w-auto px-8 h-12 rounded-xl hover-elevate" 
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
