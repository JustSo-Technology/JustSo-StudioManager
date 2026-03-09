import { sendBookingReminderEmail } from "./booking-email";
import { storage } from "./storage";

const POLL_INTERVAL_MS = 30_000;
const MAX_ATTEMPTS = 3;

async function processDueReminders() {
  const dueReminders = await storage.getPendingDueBookingReminders(new Date());

  for (const reminder of dueReminders) {
    const claimed = await storage.updateBookingReminder(reminder.id, {
      status: "processing",
      processingStartedAt: new Date(),
      attemptCount: (reminder.attemptCount || 0) + 1,
    });

    const booking = await storage.getBooking(claimed.bookingId);
    if (!booking || booking.status !== "confirmed" || !booking.guestEmail) {
      await storage.updateBookingReminder(claimed.id, {
        status: "cancelled",
        lastError: booking ? "Booking no longer qualifies for reminders." : "Booking not found.",
      });
      continue;
    }

    try {
      await sendBookingReminderEmail(booking);
      await storage.updateBookingReminder(claimed.id, {
        status: "sent",
        sentAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reminder delivery failed.";
      await storage.updateBookingReminder(claimed.id, {
        status: claimed.attemptCount >= MAX_ATTEMPTS ? "failed" : "pending",
        lastError: message,
      });
    }
  }
}

export function startEmailReminderPoller() {
  const tick = async () => {
    try {
      await processDueReminders();
    } catch (error) {
      console.error("Email reminder poller error:", error);
    }
  };

  void tick();
  const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);
  return () => clearInterval(interval);
}
