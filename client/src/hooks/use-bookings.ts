import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useBookings() {
  return useQuery({
    queryKey: [api.bookings.list.path],
    queryFn: async () => {
      const res = await fetch(api.bookings.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const bookings = api.bookings.list.responses[200].parse(await res.json());
      return bookings.map((booking) => ({
        ...booking,
        startTime: new Date(booking.startTime),
        endTime: new Date(booking.endTime),
      }));
    },
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const validated = api.bookings.create.input.parse(data);
      const res = await fetch(api.bookings.create.path, {
        method: api.bookings.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create booking");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.bookings.list.path] }),
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Record<string, any>) => {
      const validated = api.bookings.update.input.parse(updates);
      const url = buildUrl(api.bookings.update.path, { id });
      const res = await fetch(url, {
        method: api.bookings.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update booking");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.bookings.list.path] }),
  });
}
