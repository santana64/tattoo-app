import { supabase, type Tables } from './supabase';

export type DepositRequest = Tables<'appointment_deposit_requests'>;
export type DepositMethod = 'manual' | 'external';
export type FinalDepositStatus = 'declared_received' | 'waived';

export const APPROVED_DEPOSIT_HOSTS = [
  'buy.stripe.com', 'paypal.me', 'www.paypal.com',
  'pay.sumup.com', 'my.sumup.com', 'revolut.me',
] as const;

export function eurosToCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^(?:[1-9]\d{0,4})(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents >= 100 && cents <= 1_000_000 ? cents : null;
}

export function formatDeposit(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/** No generic arbitrary artist-controlled URLs; only known payment providers. */
export function approvedExternalDepositUrl(value: string): string | null {
  if (value.length > 1600 || /[\s<>"@\\]/.test(value) || !value.startsWith('https://')) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password) return null;
    if (!APPROVED_DEPOSIT_HOSTS.includes(parsed.hostname.toLowerCase() as typeof APPROVED_DEPOSIT_HOSTS[number])) return null;
    if (parsed.pathname === '/' || !parsed.pathname) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  deposit_appointment_not_found: 'Ce rendez-vous est introuvable.',
  deposit_not_artist: 'Seul le tatoueur de ce rendez-vous peut gérer cet acompte.',
  deposit_account_banned: 'Ce compte artiste est suspendu et ne peut pas gérer les acomptes.',
  deposit_appointment_not_open: 'L’acompte peut être demandé uniquement avant une séance confirmée à venir.',
  deposit_invalid_details: 'Indiquez un acompte compris entre 1 et 10 000 €.',
  deposit_manual_has_link: 'Un acompte manuel ne doit pas contenir de lien.',
  deposit_invalid_payment_link: 'Le lien doit être une URL HTTPS valide.',
  deposit_unapproved_payment_provider: 'Utilisez un lien Stripe, PayPal, SumUp ou Revolut pris en charge.',
  deposit_already_finalized: 'Cet acompte est déjà clôturé.',
  deposit_invalid_status: 'Statut d’acompte invalide.',
  deposit_not_requested: 'Aucun acompte n’a été demandé pour ce rendez-vous.',
};

export function depositError(error: { message?: string; code?: string } | null): string | null {
  if (!error) return null;
  const recognized = Object.keys(ERROR_MESSAGES).find((key) => error.message?.includes(key));
  if (recognized) return ERROR_MESSAGES[recognized];
  if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42P01') {
    return 'La gestion des acomptes n’est pas encore disponible sur cet environnement.';
  }
  return 'Impossible de vérifier cet acompte. Réessayez.';
}

export async function fetchDeposit(appointmentId: string) {
  const { data, error } = await supabase
    .from('appointment_deposit_requests')
    .select('*')
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  return { data: data as DepositRequest | null, error: depositError(error) };
}

export async function requestDeposit(appointmentId: string, amountCents: number, method: DepositMethod, externalUrl: string | null) {
  const { data, error } = await supabase.rpc('set_appointment_deposit_request', {
    p_appointment_id: appointmentId,
    p_amount_cents: amountCents,
    p_method: method,
    p_external_url: externalUrl,
  });
  return { data: data as DepositRequest | null, error: depositError(error) };
}

export async function finalizeDeposit(appointmentId: string, status: FinalDepositStatus) {
  const { data, error } = await supabase.rpc('finalize_appointment_deposit_request', {
    p_appointment_id: appointmentId,
    p_status: status,
  });
  return { data: data as DepositRequest | null, error: depositError(error) };
}
