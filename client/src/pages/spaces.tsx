import { useState, useMemo } from "react";
import { useSpaces, useCreateSpace, useUpdateSpace, useDeleteSpace } from "@/hooks/use-spaces";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Plus, Loader2, Pencil, Trash2, ChevronRight, Package, CalendarCheck } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { insertSpaceSchema, type Space } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { TeamVisibilityFields, VisibilityBadge } from "@/components/team-visibility-fields";

const formSchema = insertSpaceSchema.extend({
  capacity: z.coerce.number().optional(),
  isActive: z.boolean().default(true),
  parentId: z.number().nullable().optional(),
  isStorageLocation: z.boolean().default(false),
  isBookable: z.boolean().default(true),
  teamId: z.number().nullable().optional(),
  visibility: z.string().default("all_tenants"),
});

type FormValues = z.infer<typeof formSchema>;

interface SpaceTreeNode {
  space: Space;
  children: SpaceTreeNode[];
  breadcrumb: string;
  depth: number;
}

function buildSpaceTree(spaces: Space[]): SpaceTreeNode[] {
  const spaceMap = new Map<number, Space>();
  spaces.forEach(s => spaceMap.set(s.id, s));

  function getBreadcrumb(space: Space): string {
    const parts: string[] = [space.name];
    let current = space;
    while (current.parentId && spaceMap.has(current.parentId)) {
      current = spaceMap.get(current.parentId)!;
      parts.push(current.name);
    }
    return parts.reverse().join(" > ");
  }

  function buildNodes(parentId: number | null, depth: number): SpaceTreeNode[] {
    return spaces
      .filter(s => (s.parentId ?? null) === parentId)
      .map(s => ({
        space: s,
        children: buildNodes(s.id, depth + 1),
        breadcrumb: getBreadcrumb(s),
        depth,
      }));
  }

  return buildNodes(null, 0);
}

function flattenTree(nodes: SpaceTreeNode[]): SpaceTreeNode[] {
  const result: SpaceTreeNode[] = [];
  function traverse(nodes: SpaceTreeNode[]) {
    for (const node of nodes) {
      result.push(node);
      traverse(node.children);
    }
  }
  traverse(nodes);
  return result;
}

function getDescendantIds(spaceId: number, allSpaces: Space[]): Set<number> {
  const ids = new Set<number>();
  function collect(parentId: number) {
    for (const s of allSpaces) {
      if (s.parentId === parentId && !ids.has(s.id)) {
        ids.add(s.id);
        collect(s.id);
      }
    }
  }
  collect(spaceId);
  return ids;
}

function SpaceFormFields({ form, spaces, editingSpaceId }: { form: ReturnType<typeof useForm<FormValues>>; spaces?: Space[]; editingSpaceId?: number }) {
  const parentOptions = useMemo(() => {
    if (!spaces) return [];
    if (!editingSpaceId) return spaces;
    const excludeIds = getDescendantIds(editingSpaceId, spaces);
    excludeIds.add(editingSpaceId);
    return spaces.filter(s => !excludeIds.has(s.id));
  }, [spaces, editingSpaceId]);

  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Space Name</FormLabel>
            <FormControl>
              <Input className="rounded-xl" placeholder="e.g. The Main Hall" {...field} />
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
              <Textarea className="rounded-xl resize-none" placeholder="Details about the space..." {...field} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="parentId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Parent Space</FormLabel>
            <Select
              value={field.value ? String(field.value) : "none"}
              onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
            >
              <FormControl>
                <SelectTrigger className="rounded-xl" data-testid="select-parent-space">
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">None (top-level)</SelectItem>
                {parentOptions.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="capacity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Capacity (People)</FormLabel>
            <FormControl>
              <Input className="rounded-xl" type="number" placeholder="20" {...field} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="isActive"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                data-testid="checkbox-is-active"
              />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel>Active</FormLabel>
              <p className="text-sm text-muted-foreground">
                Allow this space to be booked.
              </p>
            </div>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="isBookable"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                data-testid="checkbox-is-bookable"
              />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel>Bookable</FormLabel>
              <p className="text-sm text-muted-foreground">
                This space can be reserved through the booking system.
              </p>
            </div>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="isStorageLocation"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                data-testid="checkbox-is-storage-location"
              />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel>Storage Location</FormLabel>
              <p className="text-sm text-muted-foreground">
                This space can be used as a storage location for inventory items.
              </p>
            </div>
          </FormItem>
        )}
      />
      <TeamVisibilityFields form={form} />
    </>
  );
}

function EditSpaceDialog({ space, spaces, onClose }: { space: Space; spaces?: Space[]; onClose: () => void }) {
  const updateMutation = useUpdateSpace();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: space.name,
      description: space.description || "",
      capacity: space.capacity ?? undefined,
      isActive: space.isActive ?? true,
      parentId: space.parentId ?? null,
      isStorageLocation: space.isStorageLocation ?? false,
      isBookable: space.isBookable ?? true,
      teamId: space.teamId ?? null,
      visibility: space.visibility || "all_tenants",
    },
  });

  function onSubmit(values: FormValues) {
    updateMutation.mutate({ id: space.id, ...values }, {
      onSuccess: () => {
        toast({ title: "Space updated", description: `${values.name} has been updated.` });
        onClose();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update space.", variant: "destructive" });
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <SpaceFormFields form={form} spaces={spaces} editingSpaceId={space.id} />
        <Button type="submit" className="w-full rounded-xl mt-2" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
}

function SpaceCard({ node, canManage, onEdit, onDelete }: {
  node: SpaceTreeNode;
  canManage: boolean;
  onEdit: (space: Space) => void;
  onDelete: (space: Space) => void;
}) {
  const space = node.space;

  return (
    <div
      data-testid={`card-space-${space.id}`}
      className="group bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full"
      style={{ marginLeft: `${node.depth * 1.5}rem` }}
    >
      <div className="flex-1">
        <div className="flex justify-between items-start mb-2 gap-2 flex-wrap">
          <h3 className="font-display font-bold text-xl" data-testid={`text-space-name-${space.id}`}>{space.name}</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <VisibilityBadge visibility={space.visibility} />
            {space.isStorageLocation && (
              <Badge variant="secondary" className="text-xs" data-testid={`badge-storage-${space.id}`}>
                <Package className="w-3 h-3 mr-1" />
                Storage
              </Badge>
            )}
            {space.isBookable && (
              <Badge variant="secondary" className="text-xs" data-testid={`badge-bookable-${space.id}`}>
                <CalendarCheck className="w-3 h-3 mr-1" />
                Bookable
              </Badge>
            )}
            {!space.isActive && (
              <span className="text-xs px-2 py-1 bg-destructive/10 text-destructive rounded-full font-medium">Inactive</span>
            )}
          </div>
        </div>
        {node.depth > 0 && (
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1 flex-wrap" data-testid={`text-breadcrumb-${space.id}`}>
            {node.breadcrumb.split(" > ").map((part, i, arr) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3 opacity-50" />}
                <span className={i === arr.length - 1 ? "font-medium" : "opacity-70"}>{part}</span>
              </span>
            ))}
          </p>
        )}
        <p className="text-muted-foreground text-sm mb-6 line-clamp-3">
          {space.description || "No description provided."}
        </p>
      </div>
      <div className="pt-4 border-t border-border/50 flex items-center justify-between gap-2 mt-auto flex-wrap">
        <div className="flex items-center text-sm text-muted-foreground font-medium">
          <Users className="w-4 h-4 mr-1.5 opacity-70" />
          {space.capacity ? `Up to ${space.capacity}` : 'Variable capacity'}
        </div>
        <div className="flex gap-2">
          {canManage && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="rounded-lg"
                onClick={() => onEdit(space)}
                data-testid={`button-edit-space-${space.id}`}
              >
                <Pencil size={16} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-lg text-destructive"
                onClick={() => onDelete(space)}
                data-testid={`button-delete-space-${space.id}`}
              >
                <Trash2 size={16} />
              </Button>
            </>
          )}
          {space.isBookable && (
            <Button variant="outline" size="sm" className="rounded-lg" data-testid={`button-book-space-${space.id}`}>Book</Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Spaces() {
  const { data: spaces, isLoading } = useSpaces();
  const { data: profile } = useProfile();
  const createMutation = useCreateSpace();
  const deleteMutation = useDeleteSpace();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [deletingSpace, setDeletingSpace] = useState<Space | null>(null);

  const canManage = profile?.role === "admin" || profile?.role === "tenant";

  const spaceTree = useMemo(() => {
    if (!spaces) return [];
    return buildSpaceTree(spaces);
  }, [spaces]);

  const flatNodes = useMemo(() => flattenTree(spaceTree), [spaceTree]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      capacity: undefined,
      isActive: true,
      parentId: null,
      isStorageLocation: false,
      isBookable: true,
      teamId: null,
      visibility: "all_tenants",
    },
  });

  function onSubmit(values: FormValues) {
    createMutation.mutate(values, {
      onSuccess: () => {
        toast({ title: "Space created", description: `${values.name} has been added.` });
        setCreateOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create space.", variant: "destructive" });
      },
    });
  }

  function handleDelete() {
    if (!deletingSpace) return;
    deleteMutation.mutate(deletingSpace.id, {
      onSuccess: () => {
        toast({ title: "Space deleted", description: `${deletingSpace.name} has been removed.` });
        setDeletingSpace(null);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete space.", variant: "destructive" });
      },
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight" data-testid="text-spaces-title">Spaces</h1>
          <p className="text-muted-foreground mt-1">Book communal areas and meeting rooms.</p>
        </div>
        
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl" data-testid="button-add-space">
                <Plus className="mr-2 h-4 w-4" /> Add Space
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Add New Space</DialogTitle>
                <DialogDescription>Create a new bookable space in the studio.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <SpaceFormFields form={form} spaces={spaces} />
                  <Button type="submit" className="w-full rounded-xl" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Space"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={!!editingSpace} onOpenChange={(open) => { if (!open) setEditingSpace(null); }}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Space</DialogTitle>
            <DialogDescription>Update the details for this space.</DialogDescription>
          </DialogHeader>
          {editingSpace && <EditSpaceDialog space={editingSpace} spaces={spaces} onClose={() => setEditingSpace(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingSpace} onOpenChange={(open) => { if (!open) setDeletingSpace(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Space</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingSpace?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground" onClick={handleDelete} data-testid="button-confirm-delete-space">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-64 bg-muted/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : spaces?.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border/50">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-display text-lg font-medium">No spaces found</h3>
          <p className="text-muted-foreground">Spaces added by admins will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {flatNodes.map(node => (
            <SpaceCard
              key={node.space.id}
              node={node}
              canManage={canManage}
              onEdit={setEditingSpace}
              onDelete={setDeletingSpace}
            />
          ))}
        </div>
      )}
    </div>
  );
}
