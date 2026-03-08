import { useState } from "react";
import { useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam, useTeamMembers, useAddTeamMember, useRemoveTeamMember } from "@/hooks/use-teams";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Users, Plus, Loader2, Pencil, Trash2, UserPlus, UserMinus, ChevronRight } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Team } from "@shared/schema";

const teamFormSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  description: z.string().optional(),
});

type TeamFormValues = z.infer<typeof teamFormSchema>;

const memberFormSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.string().default("member"),
});

type MemberFormValues = z.infer<typeof memberFormSchema>;

function TeamMembersPanel({ team, onClose }: { team: Team; onClose: () => void }) {
  const { data: members, isLoading } = useTeamMembers(team.id);
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();
  const { toast } = useToast();

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: { userId: "", role: "member" },
  });

  function onAddMember(values: MemberFormValues) {
    addMember.mutate({ teamId: team.id, userId: values.userId, role: values.role }, {
      onSuccess: () => {
        toast({ title: "Member added", description: `User has been added to ${team.name}.` });
        form.reset();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to add member.", variant: "destructive" });
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-bold text-lg mb-1">{team.name}</h3>
        <p className="text-sm text-muted-foreground">{team.description || "No description"}</p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Members</h4>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : members?.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {members?.map(member => (
              <div key={member.id} data-testid={`row-member-${member.id}`} className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
                <div>
                  <span className="font-medium text-sm" data-testid={`text-member-userId-${member.id}`}>{member.userId}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full capitalize">{member.role}</span>
                </div>
                {member.userId !== team.ownerId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => removeMember.mutate({ teamId: team.id, userId: member.userId }, {
                      onSuccess: () => toast({ title: "Member removed" }),
                    })}
                    data-testid={`button-remove-member-${member.id}`}
                  >
                    <UserMinus size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onAddMember)} className="space-y-3 pt-2 border-t border-border/50">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Add Member</h4>
          <FormField
            control={form.control}
            name="userId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>User ID</FormLabel>
                <FormControl>
                  <Input className="rounded-xl" placeholder="Enter user ID" {...field} data-testid="input-add-member-userId" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="sm" className="rounded-xl" disabled={addMember.isPending} data-testid="button-add-member-submit">
            {addMember.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Add Member
          </Button>
        </form>
      </Form>
    </div>
  );
}

function EditTeamDialog({ team, onClose }: { team: Team; onClose: () => void }) {
  const updateMutation = useUpdateTeam();
  const { toast } = useToast();

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { name: team.name, description: team.description || "" },
  });

  function onSubmit(values: TeamFormValues) {
    updateMutation.mutate({ id: team.id, ...values }, {
      onSuccess: () => {
        toast({ title: "Team updated", description: `${values.name} has been updated.` });
        onClose();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update team.", variant: "destructive" });
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Name</FormLabel>
              <FormControl>
                <Input className="rounded-xl" {...field} data-testid="input-edit-team-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea className="rounded-xl resize-none" {...field} value={field.value || ''} data-testid="input-edit-team-description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full rounded-xl mt-2" disabled={updateMutation.isPending} data-testid="button-edit-team-submit">
          {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
}

export default function Teams() {
  const { data: teams, isLoading } = useTeams();
  const { data: profile } = useProfile();
  const createMutation = useCreateTeam();
  const deleteMutation = useDeleteTeam();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);

  const canManage = profile?.role === "admin" || profile?.role === "tenant";

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { name: "", description: "" },
  });

  function onCreateSubmit(values: TeamFormValues) {
    createMutation.mutate(values, {
      onSuccess: () => {
        toast({ title: "Team created", description: `${values.name} has been created.` });
        setCreateOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create team.", variant: "destructive" });
      },
    });
  }

  function handleDelete() {
    if (!deletingTeam) return;
    deleteMutation.mutate(deletingTeam.id, {
      onSuccess: () => {
        toast({ title: "Team deleted", description: `${deletingTeam.name} has been removed.` });
        setDeletingTeam(null);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete team.", variant: "destructive" });
      },
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight" data-testid="text-teams-title">Teams</h1>
          <p className="text-muted-foreground mt-1">Create and manage your studio teams.</p>
        </div>

        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl hover-elevate" data-testid="button-add-team">
                <Plus className="mr-2 h-4 w-4" /> New Team
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Create New Team</DialogTitle>
                <DialogDescription>Set up a new team to organize your members and resources.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Name</FormLabel>
                        <FormControl>
                          <Input className="rounded-xl" placeholder="e.g. Photography Crew" {...field} data-testid="input-create-team-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea className="rounded-xl resize-none" placeholder="What is this team about?" {...field} value={field.value || ''} data-testid="input-create-team-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full rounded-xl mt-2" disabled={createMutation.isPending} data-testid="button-create-team-submit">
                    {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Team"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={!!editingTeam} onOpenChange={(open) => { if (!open) setEditingTeam(null); }}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Team</DialogTitle>
            <DialogDescription>Update team details.</DialogDescription>
          </DialogHeader>
          {editingTeam && <EditTeamDialog team={editingTeam} onClose={() => setEditingTeam(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingTeam} onOpenChange={(open) => { if (!open) setViewingTeam(null); }}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Team Members</DialogTitle>
            <DialogDescription>View and manage members of this team.</DialogDescription>
          </DialogHeader>
          {viewingTeam && <TeamMembersPanel team={viewingTeam} onClose={() => setViewingTeam(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingTeam} onOpenChange={(open) => { if (!open) setDeletingTeam(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTeam?.name}"? This will remove all team members. Resources assigned to this team will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" data-testid="button-cancel-delete-team">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete} data-testid="button-confirm-delete-team">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-48 bg-muted/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : teams?.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border/50">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-display text-lg font-medium">No teams yet</h3>
          <p className="text-muted-foreground">Create a team to start organizing your members and resources.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams?.map(team => (
            <div key={team.id} data-testid={`card-team-${team.id}`} className="group bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full">
              <div className="flex-1">
                <div className="flex justify-between items-start mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0">
                    <Users size={20} />
                  </div>
                </div>
                <h3 className="font-display font-bold text-xl mb-1" data-testid={`text-team-name-${team.id}`}>{team.name}</h3>
                <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                  {team.description || "No description."}
                </p>
              </div>
              <div className="pt-4 border-t border-border/50 flex items-center gap-2 mt-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg flex-1"
                  onClick={() => setViewingTeam(team)}
                  data-testid={`button-view-members-${team.id}`}
                >
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  Members
                  <ChevronRight className="ml-auto h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-lg shrink-0"
                  onClick={() => setEditingTeam(team)}
                  data-testid={`button-edit-team-${team.id}`}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-lg shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => setDeletingTeam(team)}
                  data-testid={`button-delete-team-${team.id}`}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
