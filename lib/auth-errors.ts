import type { AuthError } from '@supabase/supabase-js';

// Supabase Auth error codes: https://supabase.com/docs/guides/auth/debugging/error-codes
const MESSAGES: Record<string, string> = {
  over_email_send_rate_limit: 'Trop d’e-mails envoyés pour le moment. Réessayez dans une heure, ou utilisez le dernier lien reçu.',
  over_request_rate_limit: 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
  email_address_not_authorized: 'Cette adresse ne peut pas encore recevoir d’e-mail de connexion. L’envoi d’e-mails n’est pas encore ouvert à tous.',
  email_address_invalid: 'Cette adresse e-mail n’est pas valide.',
  signup_disabled: 'Les inscriptions sont fermées pour le moment.',
  provider_disabled: 'Ce mode de connexion n’est pas disponible. Utilisez votre adresse e-mail.',
  otp_expired: 'Ce lien a expiré. Demandez-en un nouveau.',
  flow_state_not_found: 'Ce lien doit être ouvert dans le navigateur où vous l’avez demandé. Demandez un nouveau lien depuis cet appareil.',
  flow_state_expired: 'Ce lien a expiré. Demandez-en un nouveau.',
  bad_code_verifier: 'Ce lien doit être ouvert dans le navigateur où vous l’avez demandé. Demandez un nouveau lien depuis cet appareil.',
  unexpected_failure: 'Le service de connexion a rencontré une erreur. Réessayez dans un instant.',
};

/** Turns a Supabase auth error into a French, actionable message. Never shows raw English to users. */
export function authErrorMessage(error: Pick<AuthError, 'message'> & { code?: string; status?: number } | null | undefined): string | null {
  if (!error) return null;
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  const msg = error.message.toLowerCase();
  if (msg.includes('rate limit')) return MESSAGES.over_email_send_rate_limit;
  if (msg.includes('not authorized')) return MESSAGES.email_address_not_authorized;
  if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) return MESSAGES.provider_disabled;
  if (msg.includes('code verifier') || msg.includes('flow state')) return MESSAGES.flow_state_not_found;
  if (error.status === 0 || msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Connexion au service impossible. Vérifiez votre réseau.';
  }
  return 'La connexion a échoué. Réessayez dans un instant.';
}

/** OAuth providers enabled on the Supabase project (EXPO_PUBLIC_AUTH_PROVIDERS="google,apple"). Hidden by default. */
export function enabledOAuthProviders(): Set<'google' | 'apple'> {
  const raw = process.env.EXPO_PUBLIC_AUTH_PROVIDERS ?? '';
  return new Set(
    raw.split(',').map((p) => p.trim().toLowerCase()).filter((p): p is 'google' | 'apple' => p === 'google' || p === 'apple'),
  );
}
