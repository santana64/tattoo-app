import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { useAuthStore } from '@/store/auth-store';

// ── Types ────────────────────────────────────────────────────────
interface ToggleState {
  nouvelles_demandes: boolean;
  nouveaux_messages: boolean;
  rendez_vous: boolean;
  promotions: boolean;
  newsletter: boolean;
}

// ── Toggle row ───────────────────────────────────────────────────
function ToggleRow({
  icon,
  label,
  subtitle,
  value,
  onValueChange,
  delay,
  tintColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  delay?: number;
  tintColor?: string;
}) {
  const handleChange = (v: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(v);
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay ?? 0).springify()} style={row.container}>
      <View style={[row.iconWrap, { backgroundColor: value ? Colors.accentMuted : Colors.bgSubtle }]}>
        <Ionicons
          name={icon}
          size={18}
          color={value ? Colors.accentWarm : Colors.textTertiary}
        />
      </View>
      <View style={row.text}>
        <TText variant="bodySmall" weight="medium">{label}</TText>
        <TText variant="caption" color="tertiary" style={{ marginTop: 1 }}>{subtitle}</TText>
      </View>
      <Switch
        value={value}
        onValueChange={handleChange}
        trackColor={{
          false: Colors.bgSubtle,
          true: Platform.OS === 'ios' ? (tintColor ?? Colors.accentWarm) : Colors.accentWarm,
        }}
        thumbColor={Platform.OS === 'ios' ? undefined : value ? Colors.accentGlow : Colors.textTertiary}
        ios_backgroundColor={Colors.bgSubtle}
      />
    </Animated.View>
  );
}

const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
});

// ── Section header ───────────────────────────────────────────────
function SectionHeader({ label, delay }: { label: string; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={section.header}>
      <TText variant="micro" uppercase color="tertiary" style={section.label}>
        {label}
      </TText>
    </Animated.View>
  );
}

const section = StyleSheet.create({
  header: { paddingTop: Spacing.lg, paddingBottom: Spacing.xs },
  label: { letterSpacing: 1.8, fontSize: 9 },
});

// ── Main screen ──────────────────────────────────────────────────
export default function NotificationsScreen() {
  const router = useRouter();
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
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="bold">Notifications</TText>
        <View style={{ width: 44 }} />
      </Animated.View>

      <View style={styles.body}>

        {/* ── PUSH section ── */}
        <SectionHeader label="Push" delay={80} />
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.card}>
          {isArtist && (
            <>
              <ToggleRow
                icon="document-text-outline"
                label="Nouvelles demandes"
                subtitle="Quand un client t'envoie une demande"
                value={push.nouvelles_demandes}
                onValueChange={() => togglePush('nouvelles_demandes')}
                delay={120}
              />
              <View style={styles.divider} />
            </>
          )}
          <ToggleRow
            icon="chatbubble-outline"
            label="Nouveaux messages"
            subtitle="Messages dans tes conversations"
            value={push.nouveaux_messages}
            onValueChange={() => togglePush('nouveaux_messages')}
            delay={160}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="calendar-outline"
            label="Rendez-vous"
            subtitle="Confirmations et rappels de séance"
            value={push.rendez_vous}
            onValueChange={() => togglePush('rendez_vous')}
            delay={200}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="pricetag-outline"
            label="Promotions"
            subtitle="Offres exclusives et mises à jour"
            value={push.promotions}
            onValueChange={() => togglePush('promotions')}
            delay={240}
          />
        </Animated.View>

        {/* ── EMAIL section ── */}
        <SectionHeader label="Email" delay={280} />
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.card}>
          {isArtist && (
            <>
              <ToggleRow
                icon="mail-outline"
                label="Nouvelles demandes"
                subtitle="Reçois un email à chaque nouvelle demande"
                value={emailNotifs.nouvelles_demandes}
                onValueChange={() => toggleEmail('nouvelles_demandes')}
                delay={320}
              />
              <View style={styles.divider} />
            </>
          )}
          <ToggleRow
            icon="chatbubbles-outline"
            label="Nouveaux messages"
            subtitle="Copie email de tes conversations"
            value={emailNotifs.nouveaux_messages}
            onValueChange={() => toggleEmail('nouveaux_messages')}
            delay={360}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="calendar-clear-outline"
            label="Rendez-vous"
            subtitle="Confirmation et rappel 24h avant"
            value={emailNotifs.rendez_vous}
            onValueChange={() => toggleEmail('rendez_vous')}
            delay={400}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="newspaper-outline"
            label="Newsletter"
            subtitle="Actualités de la communauté INKR"
            value={emailNotifs.newsletter}
            onValueChange={() => toggleEmail('newsletter')}
            delay={440}
          />
        </Animated.View>

        {/* ── FREQUENCY section ── */}
        <SectionHeader label="Fréquence" delay={480} />
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.card}>
          <ToggleRow
            icon="time-outline"
            label="Résumé quotidien"
            subtitle="Reçois un récap chaque soir à 20h"
            value={digest}
            onValueChange={(v) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDigest(v);
            }}
            delay={520}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="moon-outline"
            label="Heures silencieuses"
            subtitle="Pas de push entre 22h et 8h"
            value={quietHours}
            onValueChange={(v) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setQuietHours(v);
            }}
            delay={560}
          />
        </Animated.View>

        {/* Info note */}
        <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.note}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textTertiary} />
          <TText variant="caption" color="tertiary" style={{ flex: 1, marginLeft: 6, lineHeight: 18 }}>
            Les notifications essentielles (sécurité, facturation) ne peuvent pas être désactivées.
          </TText>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSubtle,
    marginLeft: 52,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.md,
  },
});
