import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { Kicker } from '@/components/v5';
import {
  approvedExternalDepositUrl, eurosToCents, fetchDeposit,
  finalizeDeposit, formatDeposit, isUnchangedDepositRequest, requestDeposit,
  type DepositMethod, type DepositRequest, type FinalDepositStatus,
} from '@/lib/deposits';

type Props = {
  appointmentId: string;
  appointmentStatus: 'proposed' | 'confirmed' | 'completed' | 'canceled';
  upcoming: boolean;
  isArtist: boolean;
};

export function DepositSection({ appointmentId, appointmentStatus, upcoming, isArtist }: Props) {
  const [row, setRow] = useState<DepositRequest | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [method, setMethod] = useState<DepositMethod>('manual');
  const [amount, setAmount] = useState('50');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    setError(null);
    void fetchDeposit(appointmentId).then((result) => {
      if (!active) return;
      if (result.error) {
        setLoadState('error');
        setError(result.error);
        return;
      }
      setRow(result.data);
      if (result.data) {
        setMethod(result.data.method);
        setAmount(String(result.data.amount_cents / 100).replace('.', ','));
        setLink(result.data.external_url ?? '');
      }
      setLoadState('ready');
    });
    return () => { active = false; };
  }, [appointmentId, appointmentStatus, attempt]);

  const open = appointmentStatus === 'confirmed' && upcoming;
  const canConfigure = isArtist && open && (!row || row.status === 'requested');
  if (loadState === 'loading') {
    return open && isArtist
      ? <View style={styles.section}><Kicker tone="flame">Acompte facultatif</Kicker><TText variant="caption" color="secondary">Chargement des acomptes…</TText></View>
      : null;
  }

  if (loadState === 'error') {
    return (
      <View style={styles.section}>
        <Kicker tone="flame">Acompte facultatif</Kicker>
        <TText variant="bodySmall" color="error" accessibilityRole="alert">{error}</TText>
        <TButton title="Réessayer" variant="secondary" size="md" fullWidth={false} onPress={() => setAttempt((n) => n + 1)} />
      </View>
    );
  }
  if (!row && !canConfigure && !open) return null;

  const amountCents = eurosToCents(amount);
  const safeLink = approvedExternalDepositUrl(link.trim());
  const validation = !amountCents
    ? 'Indiquez un montant entre 1 et 10 000 €.'
    : method === 'external' && !safeLink
      ? 'Utilisez un lien HTTPS Stripe, PayPal, SumUp ou Revolut.'
      : null;
  const unchanged = isUnchangedDepositRequest(
    row, amountCents, method, method === 'external' ? safeLink : null,
  );

  const save = async () => {
    if (busy || validation || !amountCents || !canConfigure) return;
    setBusy(true); setError(null);
    const result = await requestDeposit(appointmentId, amountCents, method, method === 'external' ? safeLink : null);
    setBusy(false);
    if (result.error || !result.data) { setError(result.error ?? 'Demande non confirmée par le serveur.'); return; }
    setRow(result.data);
  };

  const finish = async (status: FinalDepositStatus) => {
    if (busy || !isArtist || row?.status !== 'requested') return;
    setBusy(true); setError(null);
    const result = await finalizeDeposit(appointmentId, status);
    setBusy(false);
    if (result.error || !result.data) { setError(result.error ?? 'Modification non confirmée par le serveur.'); return; }
    setRow(result.data);
  };

  const payUrl = row?.status === 'requested' && open && row.external_url
    ? approvedExternalDepositUrl(row.external_url)
    : null;
  const openPayment = async () => {
    if (!payUrl) return;
    try {
      await Linking.openURL(payUrl);
    } catch {
      setError('Le site de paiement externe n’a pas pu être ouvert.');
    }
  };

  return (
    <View style={styles.section}>
      <Kicker tone="flame">Acompte · paiement direct à l’artiste</Kicker>
      <TText variant="bodySmall" color="secondary">
        Facultatif. INKR ne prélève, ne détient et ne vérifie aucun acompte. Les conditions de paiement et de remboursement sont définies directement avec le tatoueur.
      </TText>

      {!row && open && !isArtist && (
        <TText variant="caption" color="secondary">Aucun acompte demandé pour ce rendez-vous.</TText>
      )}
      {row && (
        <View style={styles.summary} accessibilityLiveRegion="polite">
          <TText variant="displayS">{formatDeposit(row.amount_cents)}</TText>
          <TText variant="bodySmall" weight="semibold">
            {row.status === 'requested' ? 'Acompte demandé'
              : row.status === 'declared_received' ? 'Réception déclarée par le tatoueur'
                : row.status === 'waived' ? 'Acompte annulé par le tatoueur'
                  : 'Demande annulée avec le rendez-vous'}
          </TText>
          {row.status === 'declared_received' && (
            <TText variant="caption" color="secondary">
              Statut déclaré par l’artiste. INKR n’a pas vérifié la transaction.
            </TText>
          )}
          {row.status === 'requested' && row.method === 'manual' && (
            <TText variant="caption" color="secondary">Paiement à organiser directement avec l’artiste, hors application.</TText>
          )}
          {row.status === 'requested' && row.method === 'external' && (
            <TText variant="caption" color="secondary">Paiement sur le site du prestataire de l’artiste. Vérifiez le montant et les conditions avant de payer : INKR ne peut pas vérifier le contenu de ce lien.</TText>
          )}
          {!!payUrl && !isArtist && (
            <TButton title="Ouvrir le paiement externe" variant="secondary" size="md" onPress={() => { void openPayment(); }} />
          )}
        </View>
      )}

      {canConfigure && (
        <View style={styles.form}>
          <TText variant="bodySmall" weight="semibold">Méthode choisie par le tatoueur</TText>
          <View style={styles.actions}>
            <TButton title="Hors application" variant={method === 'manual' ? 'primary' : 'secondary'} size="sm"
              fullWidth={false} disabled={busy} onPress={() => setMethod('manual')} />
            <TButton title="Lien externe" variant={method === 'external' ? 'primary' : 'secondary'} size="sm"
              fullWidth={false} disabled={busy} onPress={() => setMethod('external')} />
          </View>
          <TInput label="Montant de l’acompte (€)" value={amount} onChangeText={setAmount}
            keyboardType="decimal-pad" maxLength={9} editable={!busy} placeholder="50" />
          {method === 'external' && (
            <TInput label="Lien de votre prestataire de paiement" value={link} onChangeText={setLink}
              autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={1600}
              editable={!busy} placeholder="https://buy.stripe.com/…" />
          )}
          {!!validation && <TText variant="caption" color="error" accessibilityRole="alert">{validation}</TText>}
          <TButton title={row ? 'Modifier la demande' : 'Demander un acompte'} size="md"
            disabled={busy || !!validation || unchanged} loading={busy} onPress={() => { void save(); }} />
          {row?.status === 'requested' && (
            <View style={styles.actions}>
              <TButton title="Déclarer reçu" variant="secondary" size="sm" fullWidth={false}
                disabled={busy} onPress={() => { void finish('declared_received'); }} />
              <TButton title="Renoncer à l’acompte" variant="secondary" size="sm" fullWidth={false}
                disabled={busy} onPress={() => { void finish('waived'); }} />
            </View>
          )}
        </View>
      )}
      <TButton title="Actualiser l’acompte" variant="ghost" size="sm" fullWidth={false}
        disabled={busy} onPress={() => setAttempt((n) => n + 1)} />
      {!!error && <TText variant="caption" color="error" accessibilityRole="alert">{error}</TText>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.line },
  summary: { backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.line, padding: Spacing.md, gap: Spacing.xs },
  form: { gap: Spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
});
