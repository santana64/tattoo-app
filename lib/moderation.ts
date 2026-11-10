import { supabase } from './supabase';
import type { Database } from './supabase.types';

type Functions = Database['public']['Functions'];
export type ReportRow = Functions['admin_list_reports']['Returns'][number];
export type VerificationRow = Functions['admin_list_verifications']['Returns'][number];
export type ReportStatus = 'pending' | 'actioned' | 'dismissed';

export const REPORT_REASONS: Record<ReportRow['reason'], string> = {
  spam: 'Spam',
  inappropriate: 'Contenu inapproprié',
  fake: 'Faux profil ou contenu',
  harassment: 'Harcèlement',
  other: 'Autre',
};

const ERRORS: Record<string, string> = {
  not_admin: 'Cette action est réservée aux administrateurs.',
  report_not_found: 'Ce signalement n’existe plus.',
  verification_not_pending: 'Cette demande a déjà été traitée.',
  profile_not_found_or_admin: 'Ce compte ne peut pas être modifié.',
  not_an_artist: 'Seul un artiste peut demander la vérification.',
};

/** French message for a moderation RPC error. */
export function moderationError(error: { message?: string } | null): string | null {
  if (!error) return null;
  const known = Object.keys(ERRORS).find((code) => error.message?.includes(code));
  return known ? ERRORS[known] : 'Action impossible. Vérifiez votre connexion puis réessayez.';
}

export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

export async function listReports(status: ReportStatus) {
  const { data, error } = await supabase.rpc('admin_list_reports', { p_status: status });
  return { reports: data ?? [], error: moderationError(error) };
}

export interface ReportDecision {
  status: Exclude<ReportStatus, 'pending'>;
  removeContent?: boolean;
  banOwner?: boolean;
}

export async function resolveReport(reportId: string, decision: ReportDecision) {
  const { error } = await supabase.rpc('admin_resolve_report', {
    p_report_id: reportId,
    p_status: decision.status,
    p_remove_content: decision.removeContent ?? false,
    p_ban_owner: decision.banOwner ?? false,
  });
  return moderationError(error);
}

export async function setBan(profileId: string, banned: boolean) {
  const { error } = await supabase.rpc('admin_set_ban', { p_profile_id: profileId, p_banned: banned });
  return moderationError(error);
}

export async function listVerifications() {
  const { data, error } = await supabase.rpc('admin_list_verifications');
  return { verifications: data ?? [], error: moderationError(error) };
}

export async function reviewVerification(artistId: string, approve: boolean) {
  const { error } = await supabase.rpc('admin_review_verification', { p_artist_id: artistId, p_approve: approve });
  return moderationError(error);
}

/** Artist side: asks the moderators to verify the profile. Returns the new status. */
export async function requestVerification() {
  const { data, error } = await supabase.rpc('request_verification');
  return { status: data ?? null, error: moderationError(error) };
}
