import type { Booking, CalendarConnection, CalendarResource } from "@shared/schema";

function formatUtcDate(dateLike: Date | string) {
  const date = new Date(dateLike);
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string | null | undefined) {
  return (value || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function normalizeCalendarUrl(calendarUrl: string) {
  return calendarUrl.endsWith("/") ? calendarUrl : `${calendarUrl}/`;
}

function buildEventUrl(calendarUrl: string, bookingId: number, externalEventId?: string | null) {
  if (externalEventId) {
    return externalEventId;
  }
  return `${normalizeCalendarUrl(calendarUrl)}justso-booking-${bookingId}.ics`;
}

function buildCalendarEvent(booking: Booking, resource: CalendarResource) {
  const title = booking.serviceId
    ? `Service booking: ${resource.name}`
    : booking.spaceId
      ? `Space booking: ${resource.name}`
      : `Reservation: ${resource.name}`;
  const description = [
    booking.guestName ? `Guest: ${booking.guestName}` : "",
    booking.guestEmail ? `Email: ${booking.guestEmail}` : "",
    booking.notes ? `Notes: ${booking.notes}` : "",
  ]
    .filter(Boolean)
    .join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JustSo Studios//Studio Manager//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:justso-booking-${booking.id}@justso.studio`,
    `DTSTAMP:${formatUtcDate(new Date())}`,
    `DTSTART:${formatUtcDate(booking.startTime)}`,
    `DTEND:${formatUtcDate(booking.endTime)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function buildAuthorization(connection: CalendarConnection) {
  if (!connection.username || !connection.password) {
    throw new Error("CalDAV calendars require a username and password.");
  }

  const token = Buffer.from(`${connection.username}:${connection.password}`).toString("base64");
  return `Basic ${token}`;
}

export async function syncBookingToCalendar(
  booking: Booking,
  details: { connection: CalendarConnection; resource: CalendarResource },
) {
  if (details.connection.provider !== "caldav" || !details.connection.calendarUrl) {
    return { externalEventId: booking.externalEventId ?? null, syncState: "synced" as const, syncError: null };
  }

  const eventUrl = buildEventUrl(details.connection.calendarUrl, booking.id, booking.externalEventId);
  const response = await fetch(eventUrl, {
    method: "PUT",
    headers: {
      Authorization: buildAuthorization(details.connection),
      "Content-Type": "text/calendar; charset=utf-8",
    },
    body: buildCalendarEvent(booking, details.resource),
  });

  if (!response.ok) {
    throw new Error(`Calendar sync failed with ${response.status} ${response.statusText}`);
  }

  return { externalEventId: eventUrl, syncState: "synced" as const, syncError: null };
}

export async function deleteBookingFromCalendar(
  booking: Booking,
  details: { connection: CalendarConnection; resource: CalendarResource },
) {
  if (details.connection.provider !== "caldav" || !details.connection.calendarUrl || !booking.externalEventId) {
    return;
  }

  const response = await fetch(booking.externalEventId, {
    method: "DELETE",
    headers: {
      Authorization: buildAuthorization(details.connection),
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Calendar delete failed with ${response.status} ${response.statusText}`);
  }
}

export function buildInternalCalendarIcs(resourceName: string, bookings: Booking[]) {
  const events = bookings.map((booking) =>
    [
      "BEGIN:VEVENT",
      `UID:justso-booking-${booking.id}@justso.studio`,
      `DTSTAMP:${formatUtcDate(new Date())}`,
      `DTSTART:${formatUtcDate(booking.startTime)}`,
      `DTEND:${formatUtcDate(booking.endTime)}`,
      `SUMMARY:${escapeIcsText(resourceName)}`,
      `DESCRIPTION:${escapeIcsText(booking.notes || booking.guestName || "JustSo booking")}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ].join("\r\n"),
  );

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JustSo Studios//Studio Manager//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}
