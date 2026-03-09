import { format } from "date-fns";
import { CalendarDays, Loader2, MailCheck, RefreshCcw, XCircle } from "lucide-react";
import { useBookings, useUpdateBooking } from "@/hooks/use-bookings";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function SyncBadge({ syncState }: { syncState?: string | null }) {
  const styles =
    syncState === "synced"
      ? "bg-emerald-100 text-emerald-700"
      : syncState === "sync_failed"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>{syncState || "pending"}</span>;
}

export default function Bookings() {
  const { data: bookings, isLoading } = useBookings();
  const updateBooking = useUpdateBooking();
  const { toast } = useToast();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Bookings</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Reservations and sync health.</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          If you were the tenant, this is where you would check that a guest really verified, the reservation really landed, and the assigned calendar did not quietly fail.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : bookings?.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-border/60 bg-muted/20 px-5 py-20 text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-display text-xl font-bold">No reservations yet</h3>
          <p className="mt-2 text-muted-foreground">Once guests request a booking from your public page, they’ll appear here with verification and sync state.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Reservation</th>
                  <th className="px-6 py-4">Guest</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Calendar</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(bookings || []).map((booking) => (
                  <tr key={booking.id} className="align-top hover:bg-muted/20">
                    <td className="px-6 py-5">
                      <p className="font-medium text-foreground">{booking.serviceId ? `Service #${booking.serviceId}` : booking.spaceId ? `Space #${booking.spaceId}` : `Item #${booking.inventoryItemId}`}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Booking #{booking.id}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-foreground">
                        <MailCheck className="h-4 w-4 text-primary" />
                        <span>{booking.guestName || "Tenant-created booking"}</span>
                      </div>
                      {booking.guestEmail && <p className="mt-1 text-xs text-muted-foreground">{booking.guestEmail}</p>}
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-medium text-foreground">{format(new Date(booking.startTime), "MMM d, yyyy")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(booking.startTime), "h:mm a")} - {format(new Date(booking.endTime), "h:mm a")}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        booking.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-700"
                          : booking.status === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <SyncBadge syncState={booking.syncState} />
                      {booking.syncError && <p className="mt-2 max-w-xs text-xs text-red-600">{booking.syncError}</p>}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        {booking.status === "confirmed" && (
                          <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={() =>
                              updateBooking.mutate(
                                { id: booking.id, status: "confirmed" },
                                {
                                  onSuccess: () => toast({ title: "Sync retried", description: "We attempted to push the reservation back into the assigned calendar." }),
                                },
                              )
                            }
                          >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Retry sync
                          </Button>
                        )}
                        {booking.status !== "cancelled" && (
                          <Button
                            variant="outline"
                            className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              updateBooking.mutate(
                                { id: booking.id, status: "cancelled" },
                                {
                                  onSuccess: () => toast({ title: "Booking cancelled", description: "The reservation has been cancelled." }),
                                },
                              )
                            }
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                        )}
                      </div>
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
