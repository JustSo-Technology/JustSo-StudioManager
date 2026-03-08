import { useState, useRef, useCallback } from "react";
import { useServices, useCreateService, useUpdateService, useDeleteService } from "@/hooks/use-services";
import { useSpaces } from "@/hooks/use-spaces";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Plus, Loader2, Clock, Pencil, Trash2, MapPin, Building2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertServiceSchema, type Service, type Space } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { TeamVisibilityFields, VisibilityBadge } from "@/components/team-visibility-fields";
import { Autocomplete, useLoadScript } from "@react-google-maps/api";
import { useQuery } from "@tanstack/react-query";

const libraries: ("places")[] = ["places"];

function useGoogleMapsKey() {
  return useQuery({
    queryKey: ["/api/config/google-maps-key"],
    queryFn: async () => {
      const res = await fetch("/api/config/google-maps-key", { credentials: "include" });
      if (!res.ok) return { apiKey: "" };
      return res.json() as Promise<{ apiKey: string }>;
    },
    staleTime: Infinity,
  });
}

const formSchema = insertServiceSchema.extend({
  price: z.coerce.number().min(0, "Price must be positive"),
  durationMinutes: z.coerce.number().min(15, "Duration must be at least 15m"),
  teamId: z.number().nullable().optional(),
  visibility: z.string().default("public"),
  locationType: z.string().nullable().optional(),
  locationSpaceId: z.number().nullable().optional(),
  locationAddress: z.string().nullable().optional(),
  locationLat: z.string().nullable().optional(),
  locationLng: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function GooglePlacesField({ value, onChange, onPlaceSelect, apiKey }: {
  value: string;
  onChange: (val: string) => void;
  onPlaceSelect: (address: string, lat: string, lng: string) => void;
  apiKey: string;
}) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries,
  });

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.formatted_address && place.geometry?.location) {
        const lat = place.geometry.location.lat().toString();
        const lng = place.geometry.location.lng().toString();
        onPlaceSelect(place.formatted_address, lat, lng);
      }
    }
  }, [onPlaceSelect]);

  if (!apiKey) {
    return (
      <Input
        className="rounded-xl"
        placeholder="Enter address manually"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        data-testid="input-location-address"
      />
    );
  }

  if (!isLoaded) {
    return <Input className="rounded-xl" placeholder="Loading..." disabled />;
  }

  return (
    <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
      <Input
        className="rounded-xl"
        placeholder="Search for an address..."
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        data-testid="input-location-address"
      />
    </Autocomplete>
  );
}

function ServiceFormFields({ form, googleMapsApiKey }: { form: ReturnType<typeof useForm<FormValues>>; googleMapsApiKey?: string }) {
  const { data: spaces } = useSpaces();
  const locationType = form.watch("locationType");

  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Service Name</FormLabel>
            <FormControl>
              <Input className="rounded-xl" placeholder="e.g. Portrait Photography" {...field} />
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
              <Textarea className="rounded-xl resize-none" placeholder="What does this service include?" {...field} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price ($)</FormLabel>
              <FormControl>
                <Input className="rounded-xl" type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="durationMinutes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Duration (mins)</FormLabel>
              <FormControl>
                <Input className="rounded-xl" type="number" step="15" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="locationType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Location</FormLabel>
            <Select
              value={field.value || "none"}
              onValueChange={(v) => {
                const val = v === "none" ? null : v;
                field.onChange(val);
                if (val !== "internal") {
                  form.setValue("locationSpaceId", null);
                }
                if (val !== "external") {
                  form.setValue("locationAddress", null);
                  form.setValue("locationLat", null);
                  form.setValue("locationLng", null);
                }
              }}
            >
              <FormControl>
                <SelectTrigger className="rounded-xl" data-testid="select-location-type">
                  <SelectValue placeholder="No location set" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">No location set</SelectItem>
                <SelectItem value="internal">Internal (Studio Space)</SelectItem>
                <SelectItem value="external">External (Address)</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {locationType === "internal" && (
        <FormField
          control={form.control}
          name="locationSpaceId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Space</FormLabel>
              <Select
                value={field.value ? String(field.value) : "none"}
                onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
              >
                <FormControl>
                  <SelectTrigger className="rounded-xl" data-testid="select-location-space">
                    <SelectValue placeholder="Select a space" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Select a space</SelectItem>
                  {spaces?.map(space => (
                    <SelectItem key={space.id} value={String(space.id)}>{space.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {locationType === "external" && (
        <FormField
          control={form.control}
          name="locationAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <GooglePlacesField
                  value={field.value || ""}
                  onChange={(val) => field.onChange(val)}
                  onPlaceSelect={(address, lat, lng) => {
                    field.onChange(address);
                    form.setValue("locationLat", lat);
                    form.setValue("locationLng", lng);
                  }}
                  apiKey={googleMapsApiKey || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <TeamVisibilityFields form={form} />
    </>
  );
}

function getLocationDisplay(service: Service, spaces: Space[] | undefined) {
  if (!service.locationType) return null;
  if (service.locationType === "internal" && service.locationSpaceId) {
    const space = spaces?.find(s => s.id === service.locationSpaceId);
    return { icon: Building2, text: space?.name || "Unknown space" };
  }
  if (service.locationType === "external" && service.locationAddress) {
    return { icon: MapPin, text: service.locationAddress };
  }
  return null;
}

function EditServiceDialog({ service, onClose, googleMapsApiKey }: { service: Service; onClose: () => void; googleMapsApiKey?: string }) {
  const updateMutation = useUpdateService();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: service.name,
      description: service.description || "",
      price: service.price,
      durationMinutes: service.durationMinutes,
      teamId: service.teamId ?? null,
      visibility: service.visibility || "public",
      locationType: service.locationType || null,
      locationSpaceId: service.locationSpaceId ?? null,
      locationAddress: service.locationAddress || null,
      locationLat: service.locationLat || null,
      locationLng: service.locationLng || null,
    },
  });

  function onSubmit(values: FormValues) {
    updateMutation.mutate({ id: service.id, ...values }, {
      onSuccess: () => {
        toast({ title: "Service updated", description: `${values.name} has been updated.` });
        onClose();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update service.", variant: "destructive" });
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <ServiceFormFields form={form} googleMapsApiKey={googleMapsApiKey} />
        <Button type="submit" className="w-full rounded-xl mt-2" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
}

export default function Services() {
  const { data: services, isLoading } = useServices();
  const { data: spaces } = useSpaces();
  const { data: profile } = useProfile();
  const { data: mapsConfig } = useGoogleMapsKey();
  const googleMapsApiKey = mapsConfig?.apiKey || "";
  const createMutation = useCreateService();
  const deleteMutation = useDeleteService();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState<Service | null>(null);

  const canManage = profile?.role === "admin" || profile?.role === "tenant";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      durationMinutes: 60,
      teamId: null,
      visibility: "public",
      locationType: null,
      locationSpaceId: null,
      locationAddress: null,
      locationLat: null,
      locationLng: null,
    },
  });

  function onSubmit(values: FormValues) {
    createMutation.mutate(values, {
      onSuccess: () => {
        toast({ title: "Service created", description: `${values.name} has been published.` });
        setCreateOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create service.", variant: "destructive" });
      },
    });
  }

  function handleDelete() {
    if (!deletingService) return;
    deleteMutation.mutate(deletingService.id, {
      onSuccess: () => {
        toast({ title: "Service deleted", description: `${deletingService.name} has been removed.` });
        setDeletingService(null);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete service.", variant: "destructive" });
      },
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight" data-testid="text-services-title">Services</h1>
          <p className="text-muted-foreground mt-1">Book professional services from our resident creatives.</p>
        </div>
        
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl hover-elevate" data-testid="button-add-service">
                <Plus className="mr-2 h-4 w-4" /> Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Add New Service</DialogTitle>
                <DialogDescription>Create a new service offering for the studio.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <ServiceFormFields form={form} googleMapsApiKey={googleMapsApiKey} />
                  <Button type="submit" className="w-full rounded-xl mt-2" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Publish Service"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={!!editingService} onOpenChange={(open) => { if (!open) setEditingService(null); }}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Service</DialogTitle>
            <DialogDescription>Update the details for this service.</DialogDescription>
          </DialogHeader>
          {editingService && <EditServiceDialog service={editingService} onClose={() => setEditingService(null)} googleMapsApiKey={googleMapsApiKey} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingService} onOpenChange={(open) => { if (!open) setDeletingService(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingService?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete} data-testid="button-confirm-delete-service">
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
      ) : services?.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border/50">
          <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-display text-lg font-medium">No services listed</h3>
          <p className="text-muted-foreground">Check back later for offerings from our tenants.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services?.map(service => {
            const location = getLocationDisplay(service, spaces);
            return (
              <div key={service.id} data-testid={`card-service-${service.id}`} className="group bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full">
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-display font-bold text-xl" data-testid={`text-service-name-${service.id}`}>{service.name}</h3>
                    <div className="flex items-center gap-2">
                      <VisibilityBadge visibility={service.visibility} />
                      <div className="bg-primary/5 text-primary font-bold px-3 py-1 rounded-full text-sm">
                        ${service.price}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-4">
                    Provider ID: {service.tenantId.substring(0,6)}...
                  </p>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                    {service.description || "No description provided."}
                  </p>
                  {location && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2" data-testid={`text-service-location-${service.id}`}>
                      <location.icon className="w-4 h-4 opacity-70 shrink-0" />
                      <span className="truncate">{location.text}</span>
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t border-border/50 flex items-center justify-between gap-2 mt-auto">
                  <div className="flex items-center text-sm text-muted-foreground font-medium">
                    <Clock className="w-4 h-4 mr-1.5 opacity-70" />
                    {service.durationMinutes} mins
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {canManage && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-lg"
                          onClick={() => setEditingService(service)}
                          data-testid={`button-edit-service-${service.id}`}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-lg text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingService(service)}
                          data-testid={`button-delete-service-${service.id}`}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </>
                    )}
                    <Button className="rounded-lg hover-elevate" data-testid={`button-book-service-${service.id}`}>Book Service</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
