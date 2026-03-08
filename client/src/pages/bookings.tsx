import { useBookings, useUpdateBooking } from "@/hooks/use-bookings";
import { useProfile } from "@/hooks/use-profile";
import { format } from "date-fns";
import { CalendarDays, MapPin, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Bookings() {
  const { data: bookings, isLoading } = useBookings();
  const { data: profile } = useProfile();
  const cancelMutation = useUpdateBooking();
  const { toast } = useToast();

  const canManage = profile?.role === "admin" || profile?.role === "tenant";

  function handleCancel(bookingId: number) {
    cancelMutation.mutate({ id: bookingId, status: "cancelled" }, {
      onSuccess: () => {
        toast({ title: "Booking cancelled", description: "The booking has been cancelled." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to cancel booking.", variant: "destructive" });
      },
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight" data-testid="text-bookings-title">
          {canManage ? "All Bookings" : "Your Bookings"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {canManage ? "View and manage all studio bookings." : "Manage your upcoming space and service reservations."}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : bookings?.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border/50">
          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-display text-lg font-medium">No active bookings</h3>
          <p className="text-muted-foreground">When you book a space or service, it will appear here.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Type</th>
                  {canManage && <th className="px-6 py-4 font-medium">Customer</th>}
                  <th className="px-6 py-4 font-medium">Date & Time</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {bookings?.map((booking) => (
                  <tr key={booking.id} data-testid={`row-booking-${booking.id}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                          {booking.spaceId ? <MapPin size={16} /> : <CalendarDays size={16} />}
                        </div>
                        <div>
                          <div className="font-medium text-foreground" data-testid={`text-booking-type-${booking.id}`}>
                            {booking.spaceId ? `Space #${booking.spaceId}` : `Service #${booking.serviceId}`}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            ID: {booking.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    {canManage && (
                      <td className="px-6 py-4">
                        <div className="text-foreground text-sm">
                          {booking.guestName || (booking.userId ? `User ${booking.userId.substring(0,8)}...` : "—")}
                        </div>
                        {booking.guestEmail && (
                          <div className="text-muted-foreground text-xs">{booking.guestEmail}</div>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-foreground">
                        {format(new Date(booking.startTime), "MMM d, yyyy")}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {format(new Date(booking.startTime), "h:mm a")} - {format(new Date(booking.endTime), "h:mm a")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span data-testid={`text-booking-status-${booking.id}`} className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        booking.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        booking.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        <span className="capitalize">{booking.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {booking.status !== "cancelled" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          onClick={() => handleCancel(booking.id)}
                          disabled={cancelMutation.isPending}
                          data-testid={`button-cancel-booking-${booking.id}`}
                        >
                          <XCircle size={14} className="mr-1" />
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
