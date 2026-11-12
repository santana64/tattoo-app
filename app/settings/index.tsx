import React from 'react';
import { ScrollView, StyleSheet, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { Toast } from '@/components/ui/TToast';
import {
  InkPanel, Kicker, Masthead, Rule, SettingRow, StatusDot, type StatusTone,
} from '@/components/v5';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useAuthStore } from '@/store/auth-store';
import { requestVerification } from '@/lib/moderation';

const APP_VERSION = Constants.expoConfig?.version;

/** Ruled list: numbered kicker, ink rule, then the rows. */
function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Kicker style={styles.sectionKicker}>{`${number} / ${title}`}</Kicker>
      <Rule tone="ink" />
      {children}
    </View>
  );
}

/** Trailing detail of a row (plan, verification state) followed by the arrow. */
function Detail({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.detail}>
      {children}
      <Ionicons name="arrow-forward" size={16} color={Colors.ink} />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isWide, gutter } = useContentDimensions();
  const { user, signOut, refreshProfile } = useAuthStore();
  const isArtist = user?.role === 'artist';
  const isPremium = isArtist && user?.artistTier === 'premium';
  const name = (isArtist ? user?.artistBlaze : undefined) ?? user?.displayName ?? 'Votre compte';

  const verification: { detail: string; subtitle: string; tone: StatusTone } = user?.artistIsVerified
    ? { detail: 'Vérifié', subtitle: 'Votre profil affiche le badge vérifié', tone: 'open' }
    : user?.artistVerificationStatus === 'submitted'
      ? { detail: 'En cours', subtitle: 'Votre demande est en cours d’examen', tone: 'wait' }
      : user?.artistVerificationStatus === 'rejected'
        ? { detail: 'Refusée', subtitle: 'Complétez votre profil puis renouvelez la demande', tone: 'alert' }
        : { detail: 'Demander', subtitle: 'Obtenez le badge vérifié', tone: 'closed' };
  const canRequestVerification = isArtist && !user?.artistIsVerified && user?.artistVerificationStatus !== 'submitted';

  const handleVerification = async () => {
    if (!canRequestVerification) return;
    const { error } = await requestVerification();
    if (error) {
      Toast.error(error);
      return;
    }
    Toast.success('Demande de vérification envoyée');
    await refreshProfile();
  };

  const handleSignOut = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    signOut().catch(() => Toast.error('Déconnexion impossible. Réessayez.'));
  };

  const contact = [user?.email, user?.city].filter(Boolean).join(' · ') || '—';

  // ── Identity: ink panel (right column on wide screens, top on phones) ──
  const identity = (
    <InkPanel style={isWide ? styles.identityWide : styles.identity}>
      <Kicker tone="flameOnInk">Inkr / Compte</Kicker>
      <View style={styles.identityRow}>
        <TAvatar uri={user?.avatarUrl} name={name} size="xl" isPremium={isPremium} showBadge />
        <View style={{ flex: 1, minWidth: 0 }}>
          <TText variant="displayS" numberOfLines={2} style={styles.identityName}>{name}</TText>
          <TText variant="caption" color="onInkMuted" numberOfLines={2}>{contact}</TText>
        </View>
      </View>
      {isArtist ? (
        <StatusDot
          onInk
          tone={isPremium ? 'open' : 'closed'}
          label={isPremium ? 'Formule Premium' : 'Formule gratuite'}
          style={styles.identityStatus}
        />
      ) : null}

      {/* Premium upsell — artists on the free plan only */}
      {isArtist && !isPremium ? (
        <View style={styles.upsell}>
          <Rule tone="onInk" />
          <TText variant="displayS" style={styles.upsellTitle}>
            Un profil{' '}
            <TText variant="displayS" italic color="flameOnInk" style={styles.upsellTitle}>mis en avant.</TText>
          </TText>
          <TText variant="bodySmall" color="onInkMuted" style={styles.upsellCopy}>
            Statistiques détaillées, publications illimitées et personnalisation du profil.
          </TText>
          <TButton
            title="Découvrir Premium"
            variant="glow"
            size="md"
            fullWidth={!isWide}
            onPress={() => router.push('/settings/subscription')}
          />
        </View>
      ) : null}

      {!!APP_VERSION && (
        <Kicker tone="onInkMuted" style={styles.version}>{`Inkr ${APP_VERSION}`}</Kicker>
      )}
    </InkPanel>
  );

  const lists = (
    <View style={isWide ? styles.listsWide : undefined}>
      <Section number="01" title="Compte">
        <SettingRow title="Informations personnelles" description="Nom, e-mail, ville" accessibilityLabel="Informations personnelles, Nom, e-mail, ville" onPress={() => router.push('/settings/account')} />
        <SettingRow title="Notifications" description="Push et e-mails" accessibilityLabel="Notifications, Push et e-mails" onPress={() => router.push('/settings/notifications')} />
        <SettingRow title="Confidentialité" description="Visibilité et données" accessibilityLabel="Confidentialité, Visibilité et données" onPress={() => router.push('/settings/privacy')} />
      </Section>

      {isArtist && (
        <Section number="02" title="Espace artiste">
          <SettingRow
            title="Abonnement"
            accessibilityLabel={`Abonnement, ${isPremium ? 'Premium' : 'Gratuit'}`}
            right={(
              <Detail>
                <TText variant="label" weight="bold" uppercase style={{ color: isPremium ? Colors.ink : Colors.flameText, letterSpacing: 1 }}>
                  {isPremium ? 'Premium' : 'Gratuit'}
                </TText>
              </Detail>
            )}
            onPress={() => router.push('/settings/subscription')}
          />
          <SettingRow title="Personnalisation" description="Sections et informations du profil" accessibilityLabel="Personnalisation, Sections et informations du profil" onPress={() => router.push('/customization')} />
          <SettingRow title="Statistiques" description="Vues, demandes, acceptation" accessibilityLabel="Statistiques, Vues, demandes, acceptation" onPress={() => router.push('/analytics')} />
          <SettingRow
            title="Vérification du profil"
            description={verification.subtitle}
            accessibilityLabel={`Vérification du profil, ${verification.subtitle}, ${verification.detail}`}
            right={<Detail><StatusDot tone={verification.tone} label={verification.detail} /></Detail>}
            onPress={() => { void handleVerification(); }}
          />
        </Section>
      )}

      {user?.isAdmin && (
        <Section number={isArtist ? '03' : '02'} title="Équipe">
          <SettingRow title="Modération" description="Signalements et vérifications" accessibilityLabel="Modération, Signalements et vérifications" onPress={() => router.push('/admin')} />
        </Section>
      )}

      <Section number={String(2 + (isArtist ? 1 : 0) + (user?.isAdmin ? 1 : 0)).padStart(2, '0')} title="Assistance">
        <SettingRow title="Aide et support" onPress={() => router.push('/settings/support')} />
        <SettingRow title="Conditions d’utilisation" onPress={() => router.push('/legal/terms')} />
        <SettingRow title="Politique de confidentialité" onPress={() => router.push('/legal/privacy-policy')} />
      </Section>

      {/* Session and destructive actions, kept apart from everyday settings */}
      <View style={styles.dangerZone}>
        <Kicker tone="muted" style={styles.sectionKicker}>Session</Kicker>
        <View style={[styles.dangerActions, isWide && styles.dangerActionsWide]}>
          <TButton
            title="Se déconnecter"
            variant="secondary"
            size="md"
            fullWidth={!isWide}
            onPress={handleSignOut}
          />
          <TButton
            title="Supprimer mon compte"
            variant="destructive"
            size="md"
            fullWidth={!isWide}
            onPress={() => router.push('/settings/delete-account')}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <THeader title="Paramètres" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <Masthead
          kicker="Votre compte / Réglages"
          title="Tout sous"
          emphasis="votre contrôle."
          description="Les réglages du quotidien d’un côté, les actions sensibles de l’autre, toujours explicites."
        />
        {isWide ? (
          <View style={styles.board}>
            {lists}
            <View style={styles.aside}>{identity}</View>
          </View>
        ) : (
          <>
            {identity}
            {lists}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  content: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },

  board: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xl'] },
  listsWide: { flex: 1.6, minWidth: 0 },
  aside: { flex: 1, minWidth: 0, maxWidth: 420 },

  identity: { marginBottom: Spacing.md },
  identityWide: {},
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  identityName: { color: Colors.onInk, marginBottom: 4 },
  identityStatus: { marginTop: Spacing.md },

  upsell: { marginTop: Spacing.lg },
  upsellTitle: { color: Colors.onInk, fontSize: 30, lineHeight: 32, marginTop: Spacing.md },
  upsellCopy: { marginTop: Spacing.xs, marginBottom: Spacing.md, lineHeight: 21 },
  version: { marginTop: Spacing.lg },

  section: { marginTop: Spacing.xl },
  sectionKicker: { marginBottom: Spacing.xs },

  detail: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },

  dangerZone: { marginTop: Spacing['2xl'] },
  dangerActions: { gap: 10, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.line },
  dangerActionsWide: { flexDirection: 'row', flexWrap: 'wrap' },
});
