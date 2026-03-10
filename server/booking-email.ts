import type { Booking } from "@shared/schema";
import { emailService } from "./email";
import { storage } from "./storage";

export async function getBookingEmailContext(booking: Booking) {
  const profile = booking.organisationId ? await storage.getProfile(booking.organisationId) : undefined;

  let resourceLabel = "Reservation";
  if (booking.serviceId) {
    const service = await storage.getService(booking.serviceId);
    resourceLabel = service?.name || `Service #${booking.serviceId}`;
  } else if (booking.spaceId) {
    const space = await storage.getSpace(booking.spaceId);
    resourceLabel = space?.name || `Space #${booking.spaceId}`;
  } else if (booking.inventoryItemId) {
    const item = await storage.getInventoryItem(booking.inventoryItemId);
    resourceLabel = item?.name || `Item #${booking.inventoryItemId}`;
  }

  return {
    tenantDisplayName: profile?.displayName || profile?.name || "JustSo. Studio",
    resourceLabel,
    booking,
  };
}

export async function sendBookingConfirmationEmail(booking: Booking) {
  if (!booking.guestEmail) {
    return;
  }
  const context = await getBookingEmailContext(booking);
  await emailService.sendBookingConfirmation(booking.guestEmail, context);
}

export async function sendBookingCancellationEmail(booking: Booking) {
  if (!booking.guestEmail) {
    return;
  }
  const context = await getBookingEmailContext(booking);
  await emailService.sendBookingCancellation(booking.guestEmail, context);
}

export async function sendBookingReminderEmail(booking: Booking) {
  if (!booking.guestEmail) {
    return;
  }
  const context = await getBookingEmailContext(booking);
  await emailService.sendBookingReminder(booking.guestEmail, context);
}

export async function scheduleBookingReminder(booking: Booking) {
  const existingReminders = await storage.getBookingRemindersByBooking(booking.id);
  if (existingReminders.some((reminder) => reminder.reminderType === "booking_reminder_24h" && reminder.status !== "cancelled")) {
    return null;
  }

  const reminderTime = new Date(new Date(booking.startTime).getTime() - 24 * 60 * 60 * 1000);
  if (reminderTime <= new Date()) {
    return null;
  }

  return storage.createBookingReminder({
    bookingId: booking.id,
    reminderType: "booking_reminder_24h",
    scheduledFor: reminderTime,
    status: "pending",
    attemptCount: 0,
    lastError: null,
  });
}
