// iCalendar (RFC 5545) export of sessions, readable by Google Agenda, Apple
// Calendar and Outlook. Times are written in UTC so no time-zone table is
// needed; the calendar shows them in the reader's own zone.

export interface CalendarEvent {
  id: string;
  start: Date | string;
  end: Date | string;
  title: string;
  description?: string | null;
  location?: string | null;
  /** Sessions still awaiting the client's answer are exported as tentative. */
  tentative?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function icsDate(value: Date | string): string {
  const d = new Date(value);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Escapes text as RFC 5545 requires: backslash, semicolon, comma, newline. */
export function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Folds a content line at 75 octets, continuation lines starting with a space. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Continuation lines carry a leading space, which counts in the 75.
    const limit = out.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  if (current) out.push(current);
  return out.join('\r\n ');
}

export function buildCalendar(events: CalendarEvent[], now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Inkr//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Inkr',
  ];
  for (const event of events) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) continue;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsText(event.id)}@inkr`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsText(event.title)}`,
    );
    if (event.description?.trim()) lines.push(`DESCRIPTION:${icsText(event.description.trim())}`);
    if (event.location?.trim()) lines.push(`LOCATION:${icsText(event.location.trim())}`);
    lines.push(`STATUS:${event.tentative ? 'TENTATIVE' : 'CONFIRMED'}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** A link that adds one session to Google Agenda. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${icsDate(event.start)}/${icsDate(event.end)}`,
  });
  if (event.description?.trim()) params.set('details', event.description.trim());
  if (event.location?.trim()) params.set('location', event.location.trim());
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
