import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TDivider } from '@/components/ui/TDivider';
import { THeader } from '@/components/ui/THeader';
import { EASE_OUT, MotionDuration } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';

// ── Types ────────────────────────────────────────────────────────
interface ToggleState {
  nouvelles_demandes: boolean;
  nouveaux_messages: boolean;
  rendez_vous: boolean;
  promotions: boolean;
  newsletter: boolean;
}

// ── Toggle: 180ms state transition, visual only (the row owns the press) ──
function Toggle({ value }: { value: boolean }) {
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(value ? 1 : 0, { duration: MotionDuration.state, easing: EASE_OUT }));
  }, [value, p]);
  const onStyle = useAnimatedStyle(() => ({ opacity: p.get() }));
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: p.get() * 18 }] }));
  return (
    <View style={toggle.track} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, toggle.on, onStyle]} />
      <Animated.View style={[toggle.knob, knobStyle]} />
    </View>
  );
}

const toggle = StyleSheet.create({
  track: {
    width: 46, height: 28, borderRadius: 14,
    backgroundColor: Colors.bgSubtle,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  on: { backgroundColor: Colors.accentWarm, borderRadius: 14 },
  knob: {
    position: 'absolute', top: 2.5, left: 2.5,
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.textPrimary,
  },
});

// ── Toggle row ───────────────────────────────────────────────────
function ToggleRow({ icon, label, subtitle, value, onValueChange }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onValueChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={subtitle}
      accessibilityState={{ checked: value }}
      style={styles.row}
    >
      <Ionicons name={icon} size={19} color={value ? Colors.accentWarm : Colors.textTertiary} style={styles.rowIcon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TText variant="body" weight="medium">{label}</TText>
        <TText variant="caption" color="tertiary" style={{ marginTop: 1 }}>{subtitle}</TText>
      </View>
      <Toggle value={value} />
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <View style={styles.group}>
      <TText variant="label" color="tertiary" uppercase style={styles.groupTitle}>{title}</TText>
      <View style={styles.groupBody}>
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {i > 0 && <TDivider inset={34} />}
            {child}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const isArtist = user?.role === 'artist';

  // Push notifications
  const [push, setPush] = useState<ToggleState>({
    nouvelles_demandes: true,
    nouveaux_messages: true,
    rendez_vous: true,
    promotions: false,
    newsletter: false,
  });

  // Email notifications
  const [emailNotifs, setEmailNotifs] = useState<ToggleState>({
    nouvelles_demandes: true,
    nouveaux_messages: false,
    rendez_vous: true,
    promotions: false,
    newsletter: true,
  });

  // Frequency
  const [digest, setDigest] = useState(false);
  const [quietHours, setQuietHours] = useState(true);

  const togglePush = (key: keyof ToggleState) =>
    setPush((p) => ({ ...p, [key]: !p[key] }));

  const toggleEmail = (key: keyof ToggleState) =>
    setEmailNotifs((e) => ({ ...e, [key]: !e[key] }));

  return (
    <View style={styles.container}>
      <THeader title="Notifications" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Honest status: these switches are not stored server-side yet */}
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={17} color={Colors.warning} />
          <TText variant="caption" color="secondary" style={{ flex: 1 }}>
            Ces préférences ne sont pas encore enregistrées sur votre compte : elles reviennent à leur valeur par défaut à la prochaine ouverture.
          </TText>
        </View>

        <Group title="Notifications push">
          {isArtist && (
            <ToggleRow
              icon="document-text-outline"
              label="Nouvelles demandes"
              subtitle="Quand un client vous envoie une demande"
              value={push.nouvelles_demandes}
              onValueChange={() => togglePush('nouvelles_demandes')}
            />
          )}
          <ToggleRow
            icon="chatbubble-outline"
            label="Nouveaux messages"
            subtitle="Messages dans vos conversations"
            value={push.nouveaux_messages}
            onValueChange={() => togglePush('nouveaux_messages')}
          />
          <ToggleRow
            icon="calendar-outline"
            label="Rendez-vous"
            subtitle="Confirmations et rappels de séance"
            value={push.rendez_vous}
            onValueChange={() => togglePush('rendez_vous')}
          />
          <ToggleRow
            icon="pricetag-outline"
            label="Offres et nouveautés"
            subtitle="Annonces sur les fonctionnalités d’INKR"
            value={push.promotions}
            onValueChange={() => togglePush('promotions')}
          />
        </Group>

        <Group title="E-mails">
          {isArtist && (
            <ToggleRow
              icon="mail-outline"
              label="Nouvelles demandes"
              subtitle="Un e-mail à chaque nouvelle demande"
              value={emailNotifs.nouvelles_demandes}
              onValueChange={() => toggleEmail('nouvelles_demandes')}
            />
          )}
          <ToggleRow
            icon="chatbubbles-outline"
            label="Nouveaux messages"
            subtitle="Copie par e-mail de vos conversations"
            value={emailNotifs.nouveaux_messages}
            onValueChange={() => toggleEmail('nouveaux_messages')}
          />
          <ToggleRow
            icon="calendar-clear-outline"
            label="Rendez-vous"
            subtitle="Confirmation et rappel la veille"
            value={emailNotifs.rendez_vous}
            onValueChange={() => toggleEmail('rendez_vous')}
          />
          <ToggleRow
            icon="newspaper-outline"
            label="Lettre d’information"
            subtitle="Actualités de la communauté INKR"
            value={emailNotifs.newsletter}
            onValueChange={() => toggleEmail('newsletter')}
          />
        </Group>

        <Group title="Rythme">
          <ToggleRow
            icon="time-outline"
            label="Résumé quotidien"
            subtitle="Un récapitulatif chaque soir à 20 h"
            value={digest}
            onValueChange={setDigest}
          />
          <ToggleRow
            icon="moon-outline"
            label="Heures silencieuses"
            subtitle="Aucune notification push entre 22 h et 8 h"
            value={quietHours}
            onValueChange={setQuietHours}
          />
        </Group>

        <TText variant="caption" color="tertiary" style={styles.footnote}>
          Les messages essentiels (sécurité, facturation) ne peuvent pas être désactivés.
        </TText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    width: '100%', maxWidth: Layout.maxReading + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg,
  },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,165,91,0.35)',
    backgroundColor: 'rgba(217,165,91,0.06)',
  },
  group: { marginTop: Spacing.xl },
  groupTitle: { marginBottom: Spacing['2xs'] },
  groupBody: {
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 12,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  rowIcon: { width: 22 },
  footnote: { marginTop: Spacing.lg },
});
