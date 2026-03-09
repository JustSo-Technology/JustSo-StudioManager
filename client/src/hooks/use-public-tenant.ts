import { useMutation, useQuery } from "@tanstack/react-query";

export function usePublicTenant(slug: string) {
  return useQuery({
    queryKey: ["/api/public/tenant", slug],
    enabled: !!slug,
    queryFn: async () => {
      const res = await fetch(`/api/public/tenant/${slug}`);
      if (!res.ok) {
        throw new Error("Failed to fetch tenant page");
      }
      return res.json();
    },
  });
}

export function useStartGuestBooking() {
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/public/bookings/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    },
  });
}

export function useSendGuestVerification() {
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/public/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    },
  });
}

export function useVerifyGuestBooking() {
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/public/bookings/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    },
  });
}
