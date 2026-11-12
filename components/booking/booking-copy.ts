// Shared wording for booking screens.
import { noticeLabel } from '@/lib/care';

/** "Annulation ou report possible jusqu’à 48 h avant la séance." */
export function cancellationNotice(hours: number): string {
  return hours > 0
    ? `Annulation ou report possible jusqu’à ${noticeLabel(hours)} avant la séance.`
    : 'Annulation ou report possible jusqu’au début de la séance.';
}

/** "48 h avant la séance", "sans délai" — the moment a confirmed session becomes binding. */
export function noticeDeadline(hours: number): string {
  return hours > 0 ? `${noticeLabel(hours)} avant la séance` : 'le début de la séance';
}
