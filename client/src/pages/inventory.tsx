import { useState } from "react";
import { useInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem, useStorageLocations } from "@/hooks/use-inventory";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, Loader2, Tag, Pencil, Trash2, MapPin } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { insertInventoryItemSchema, type InventoryItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { TeamVisibilityFields, VisibilityBadge } from "@/components/team-visibility-fields";

const formSchema = insertInventoryItemSchema.extend({
  isAvailableForHire: z.boolean().default(false),
  storageLocationId: z.number().nullable().optional(),
  teamId: z.number().nullable().optional(),
  visibility: z.string().default("team"),
});

type FormValues = z.infer<typeof formSchema>;

function InventoryFormFields({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  const { data: storageLocations } = useStorageLocations();

  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Item Name</FormLabel>
            <FormControl>
              <Input className="rounded-xl" placeholder="e.g. Sony A7IV Camera" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="category"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Category</FormLabel>
            <FormControl>
              <Input className="rounded-xl" placeholder="e.g. Cameras, Audio, Furniture" {...field} value={field.value || ''} />
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
              <Textarea className="rounded-xl resize-none" placeholder="Item specifics..." {...field} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="condition"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Condition</FormLabel>
            <FormControl>
              <Input className="rounded-xl" placeholder="e.g. excellent, good, fair" {...field} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="storageLocationId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Storage Location</FormLabel>
            <Select
              value={field.value ? String(field.value) : "none"}
              onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
            >
              <FormControl>
                <SelectTrigger className="rounded-xl" data-testid="select-storage-location">
                  <SelectValue placeholder="No storage location" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">No storage location</SelectItem>
                {storageLocations?.map(loc => (
                  <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="isAvailableForHire"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel>Available for Hire</FormLabel>
              <p className="text-sm text-muted-foreground">
                Allow others in the studio to borrow this item.
              </p>
            </div>
          </FormItem>
        )}
      />
      <TeamVisibilityFields form={form} />
    </>
  );
}

function EditInventoryDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const updateMutation = useUpdateInventoryItem();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: item.name,
      description: item.description || "",
      category: item.category || "",
      condition: item.condition || "good",
      isAvailableForHire: item.isAvailableForHire ?? false,
      storageLocationId: item.storageLocationId ?? null,
      teamId: item.teamId ?? null,
      visibility: item.visibility || "team",
    },
  });

  function onSubmit(values: FormValues) {
    updateMutation.mutate({ id: item.id, ...values }, {
      onSuccess: () => {
        toast({ title: "Item updated", description: `${values.name} has been updated.` });
        onClose();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update item.", variant: "destructive" });
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <InventoryFormFields form={form} />
        <Button type="submit" className="w-full rounded-xl mt-2" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
}

export default function Inventory() {
  const { data: inventory, isLoading } = useInventory();
  const { data: profile } = useProfile();
  const { data: storageLocations } = useStorageLocations();
  const createMutation = useCreateInventoryItem();
  const deleteMutation = useDeleteInventoryItem();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);

  const canManage = profile?.role === "admin" || profile?.role === "tenant";

  const createForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      condition: "good",
      isAvailableForHire: false,
      storageLocationId: null,
      teamId: null,
      visibility: "team",
    },
  });

  function onCreateSubmit(values: FormValues) {
    createMutation.mutate(values, {
      onSuccess: () => {
        toast({ title: "Item created", description: `${values.name} has been added.` });
        setCreateOpen(false);
        createForm.reset();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create item.", variant: "destructive" });
      },
    });
  }

  function handleDelete() {
    if (!deletingItem) return;
    deleteMutation.mutate(deletingItem.id, {
      onSuccess: () => {
        toast({ title: "Item deleted", description: `${deletingItem.name} has been removed.` });
        setDeletingItem(null);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete item.", variant: "destructive" });
      },
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight" data-testid="text-inventory-title">Inventory</h1>
          <p className="text-muted-foreground mt-1">Browse equipment available for hire or track your property.</p>
        </div>
        
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl hover-elevate" data-testid="button-add-inventory">
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Register New Item</DialogTitle>
                <DialogDescription>Add a new item to the studio inventory.</DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 pt-4">
                  <InventoryFormFields form={createForm} />
                  <Button type="submit" className="w-full rounded-xl mt-2" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Item"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Item</DialogTitle>
            <DialogDescription>Update the details for this inventory item.</DialogDescription>
          </DialogHeader>
          {editingItem && <EditInventoryDialog item={editingItem} onClose={() => setEditingItem(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingItem} onOpenChange={(open) => { if (!open) setDeletingItem(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingItem?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete} data-testid="button-confirm-delete-inventory">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-48 bg-muted/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : inventory?.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border/50">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-display text-lg font-medium">Empty Inventory</h3>
          <p className="text-muted-foreground">Items added will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {inventory?.map(item => (
            <div key={item.id} data-testid={`card-inventory-${item.id}`} className="group bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full">
              <div className="flex-1">
                <div className="flex justify-between items-start mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0">
                    <Package size={20} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <VisibilityBadge visibility={item.visibility} />
                    {item.condition && (
                      <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full font-medium capitalize">
                        {item.condition}
                      </span>
                    )}
                    {item.isAvailableForHire && (
                      <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full font-medium">For Hire</span>
                    )}
                  </div>
                </div>
                <h3 className="font-display font-bold text-lg leading-tight mb-1" data-testid={`text-inventory-name-${item.id}`}>{item.name}</h3>
                <div className="flex items-center text-xs text-muted-foreground mb-1">
                  <Tag className="w-3 h-3 mr-1" />
                  {item.category || "Uncategorized"}
                </div>
                {item.storageLocationId && (
                  <div className="flex items-center text-xs text-muted-foreground mb-3" data-testid={`text-storage-location-${item.id}`}>
                    <MapPin className="w-3 h-3 mr-1" />
                    {storageLocations?.find(loc => loc.id === item.storageLocationId)?.name || "Unknown location"}
                  </div>
                )}
                {!item.storageLocationId && <div className="mb-2" />}
                <p className="text-muted-foreground text-sm line-clamp-2">
                  {item.description || "No description."}
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-border/50 flex gap-2">
                <Button variant="secondary" className="flex-1 rounded-lg text-sm" disabled={!item.isAvailableForHire} data-testid={`button-hire-${item.id}`}>
                  {item.isAvailableForHire ? 'Request Hire' : 'Not Available'}
                </Button>
                {canManage && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-lg shrink-0"
                      onClick={() => setEditingItem(item)}
                      data-testid={`button-edit-inventory-${item.id}`}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-lg shrink-0 text-destructive hover:bg-destructive/10"
                      onClick={() => setDeletingItem(item)}
                      data-testid={`button-delete-inventory-${item.id}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
