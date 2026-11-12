import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { Kicker, Masthead, PageWrap } from '@/components/v5';
import { StageTitle, useStage } from '@/components/v5/Stage';
import { haptic } from '@/components/OnboardingProgress';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';

type Role = 'user' | 'artist';
type Hover = { pressed: boolean; hovered?: boolean };
const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color, opacity', transitionDuration: '180ms' } as object)
  : null;

// ── Role panel: a large selectable cell, numbered like a cartel ─────────────
function RolePanel({
  number,
  audience,
  label,
  title,
  emphasis,
  description,
  cta,
  state,
  disabled,
  wide,
  onPress,
}: {
  number: string;
  audience: string;
  /** Spoken title, unchanged from the plain-text version. */
  label: string;
  title: string;
  emphasis: string;
  description: string;
  cta: string;
  /** idle: nothing chosen · selected: this one is saving · dimmed: the other one was chosen */
  state: 'idle' | 'selected' | 'dimmed';
  disabled: boolean;
  wide: boolean;
  onPress: () => void;
}) {
  const selected = state === 'selected';
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${description}`}
      accessibilityState={{ disabled, busy: selected, selected }}
      style={(s) => {
        const { hovered, pressed } = s as Hover;
        return [
          styles.panel,
          wide && styles.panelWide,
          webPointer,
          ((hovered || pressed) && !disabled) || selected ? styles.panelActive : null,
          state === 'dimmed' && styles.panelDimmed,
        ];
      }}
    >
      {selected ? <View style={styles.panelMark} /> : null}
      <Kicker tone="flame">{`${number} / ${audience}`}</Kicker>
      <StageTitle size={wide ? 58 : 40} emphasis={emphasis} style={styles.panelTitle}>{title}</StageTitle>
      <TText variant="bodySmall" color="secondary" style={styles.panelCopy}>{description}</TText>
      <View style={styles.panelSpacer} />
      <View style={styles.panelFoot}>
        <TText variant="label" weight="bold" uppercase style={styles.panelCta} numberOfLines={1}>{cta}</TText>
        {selected ? (
          <ActivityIndicator color={Colors.ink} size="small" />
        ) : (
          <Ionicons name="arrow-forward" size={16} color={Colors.ink} />
        )}
      </View>
    </Pressable>
  );
}

export default function RoleSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wide } = useStage();
  const { setRole, saveArtist, session, refreshProfile } = useAuthStore();
  const [loading, setLoading] = useState<'user' | 'artist' | null>(null);

  const selectRole = async (role: 'user' | 'artist') => {
    setLoading(role);
    try {
      if (session?.user) {
        await setRole(role);
        if (role === 'artist') {
          // Creates the artist row (idempotent); real name and city are set in onboarding step 1.
          const { error } = await saveArtist({});
          if (error) throw new Error(error);
          await refreshProfile();
        }
      } else {
        router.replace('/(auth)/sign-in');
        return;
      }
      router.replace(role === 'user' ? '/(onboarding)/client/step1' : '/(onboarding)/artist/step1');
    } catch (e: any) {
      Toast.error(e.message ?? 'Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(null);
    }
  };

  const stateFor = (role: Role): 'idle' | 'selected' | 'dimmed' =>
    loading === null ? 'idle' : loading === role ? 'selected' : 'dimmed';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 10, paddingBottom: insets.bottom + Spacing['2xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <PageWrap>
          <View style={styles.topBar}>
            <Logo size="sm" variant="wordmark" />
            <Kicker tone="muted">Inkr / Votre profil</Kicker>
          </View>

          <Masthead
            kicker="Bienvenue"
            title="Comment utiliserez-vous"
            emphasis="Inkr ?"
            description="Choisissez votre profil : nous adaptons l’expérience à votre usage."
          />

          <View style={[styles.panels, wide && styles.panelsWide]}>
            <RolePanel
              number="01"
              audience="Client"
              label="Je cherche un artiste"
              title="Je cherche"
              emphasis="un artiste."
              description="Explorez les portfolios, enregistrez vos artistes et envoyez des demandes détaillées."
              cta="Continuer comme client"
              state={stateFor('user')}
              disabled={!!loading}
              wide={wide}
              onPress={() => selectRole('user')}
            />
            <RolePanel
              number="02"
              audience="Artiste"
              label="Je suis tatoueur·se"
              title="Je suis"
              emphasis="tatoueur·se."
              description="Présentez votre travail, recevez des demandes qualifiées et organisez vos rendez-vous."
              cta="Continuer comme artiste"
              state={stateFor('artist')}
              disabled={!!loading}
              wide={wide}
              onPress={() => selectRole('artist')}
            />
          </View>
        </PageWrap>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    minHeight: 44,
  },

  panels: { gap: Spacing.xs },
  panelsWide: { flexDirection: 'row', gap: Spacing.sm },

  panel: {
    minHeight: 260,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.white,
  },
  panelWide: { flex: 1, minWidth: 0, minHeight: 380, padding: Spacing['2xl'] },
  panelActive: { borderColor: Colors.flame, backgroundColor: Colors.flameSoft },
  panelDimmed: { opacity: 0.45 },
  panelMark: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, backgroundColor: Colors.flame },

  panelTitle: { marginTop: Spacing.lg },
  panelCopy: { marginTop: Spacing.sm, maxWidth: 380, lineHeight: 22 },
  panelSpacer: { flexGrow: 1, minHeight: Spacing.lg },
  panelFoot: {
    paddingTop: Spacing.md,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.ink,
  },
  panelCta: { color: Colors.ink, letterSpacing: 1, flexShrink: 1 },
});
