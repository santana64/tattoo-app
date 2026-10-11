import { supabase, type Tables } from './supabase';

export type Appointment = Tables<'appointments'>;

// ── Slot building (local time of the device; stored as UTC instants) ─────────

export const DURATIONS_MIN = [60, 120, 180, 240, 360, 480] as const;

/** The next `count` calendar days starting today, at local midnight. */
export function upcomingDays(count = 21, from = new Date()): Date[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Array.from({ length: count }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** Start times between `firstHour` and `lastHour` (inclusive) every `stepMin` minutes, as "HH:MM". */
export function dayTimes(firstHour = 9, lastHour = 20, stepMin = 30): string[] {
  const out: string[] = [];
  for (let m = firstHour * 60; m <= lastHour * 60; m += stepMin) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

/** Combines a local day and "HH:MM" into a start/end pair. Returns null for a slot in the past. */
export function buildSlot(day: Date, time: string, durationMin: number, now = new Date()): { start: Date; end: Date } | null {
  const [h, m] = time.split(':').map(Number);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
  if (Number.isNaN(start.getTime()) || start <= now || durationMin <= 0) return null;
  return { start, end: new Date(start.getTime() + durationMin * 60_000) };
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** "samedi 18 octobre · 14:00 – 17:00" */
export function formatSlot(startsAt: string | Date, endsAt: string | Date): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  return `${dateFmt.format(s)} · ${timeFmt.format(s)} – ${timeFmt.format(e)}`;
}

// ── Server transitions (all enforced by SECURITY DEFINER functions) ──────────

const ERRORS: Record<string, string> = {
  not_request_artist: 'Seul l’artiste de cette demande peut proposer un créneau.',
  request_not_accepted: 'La demande doit d’abord être acceptée.',
  invalid_slot: 'Ce créneau n’est plus valable. Choisissez une date à venir.',
  slot_taken: 'Ce créneau chevauche un rendez-vous déjà confirmé.',
  not_appointment_client: 'Seul le client peut répondre à cette proposition.',
  not_pending: 'Cette proposition a déjà reçu une réponse.',
  not_appointment_artist: 'Seul l’artiste peut clôturer ce rendez-vous.',
  not_confirmed: 'Le rendez-vous doit d’abord être confirmé.',
  not_started: 'La séance n’a pas encore commencé.',
};

export function appointmentErrorMessage(error: { message?: string; code?: string } | null): string | null {
  if (!error) return null;
  const msg = error.message ?? '';
  const known = Object.keys(ERRORS).find((k) => msg.includes(k));
  if (known) return ERRORS[known];
  if (error.code === '23P01' || msg.includes('appointments_no_overlap')) return ERRORS.slot_taken;
  if (error.code === 'PGRST202' || msg.includes('Could not find the function')) {
    return 'La prise de rendez-vous n’est pas encore activée sur le serveur.';
  }
  return 'Action impossible pour le moment. Réessayez.';
}

export async function fetchRequestAppointments(requestId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('request_id', requestId)
    .neq('status', 'canceled')
    .order('starts_at', { ascending: false });
  return { data: (data ?? []) as Appointment[], error: error ? appointmentErrorMessage(error) : null };
}

export async function proposeAppointment(requestId: string, start: Date, end: Date, notes?: string) {
  const { data, error } = await supabase.rpc('propose_appointment', {
    p_request_id: requestId,
    p_starts_at: start.toISOString(),
    p_ends_at: end.toISOString(),
    p_notes: notes?.trim() || null,
  });
  return { data: data as Appointment | null, error: appointmentErrorMessage(error) };
}

export async function respondToAppointment(appointmentId: string, accept: boolean) {
  const { data, error } = await supabase.rpc('respond_to_appointment', { p_appointment_id: appointmentId, p_accept: accept });
  return { data: data as Appointment | null, error: appointmentErrorMessage(error) };
}

export async function completeAppointment(appointmentId: string) {
  const { data, error } = await supabase.rpc('complete_appointment', { p_appointment_id: appointmentId });
  return { data: data as Appointment | null, error: appointmentErrorMessage(error) };
}
