// Platform glue for calendar export: a file download on the web, the share
// sheet on native (no file-system module needed), and external links.
import { Linking, Platform, Share } from 'react-native';
import { buildCalendar, googleCalendarUrl, type CalendarEvent } from '@/lib/ics';

/** Saves the events as an .ics file (web) or hands the text to the share sheet (native). */
export async function exportCalendar(events: CalendarEvent[], filename: string): Promise<boolean> {
  const text = buildCalendar(events);
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return false;
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser time to start the download before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 2_000);
    return true;
  }
  try {
    const result = await Share.share({ message: text, title: filename });
    return result.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}

/** Opens a link outside the app: a new tab on the web, the system handler on native. */
export async function openExternal(url: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false;
    // With "noopener" browsers return null even on success: there is nothing to check.
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export const openInGoogleCalendar = (event: CalendarEvent) => openExternal(googleCalendarUrl(event));
