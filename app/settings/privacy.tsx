import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { GlassCard } from '@/components/ui/GlassCard';

// ─── ToggleRow ────────────────────────────────────────────────────────────────

function ToggleRow({
  icon,
  label,
  description,
  value,
  onChange,
  isLast,
}: {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  const handleChange = (next: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(next);
  };

  return (
    <View style={[toggleStyles.row, !isLast && toggleStyles.rowDivider]}>
      <View style={[toggleStyles.iconWrap, { backgroundColor: value ? Colors.glassAmber : Colors.bgSubtle }]}>
        <Ionicons
          name={icon as any}
          size={16}
          color={value ? Colors.accentWarm : Colors.textTertiary}
        />
      </View>
      <View style={toggleStyles.text}>
        <TText variant="bodySmall" weight="semibold">
          {label}
        </TText>
        <TText
          variant="caption"
          color="tertiary"
          style={{ marginTop: 3, lineHeight: 17 }}
        >
          {description}
        </TText>
      </View>
      <Switch
        value={value}
        onValueChange={handleChange}
        trackColor={{
          false: Colors.bgSubtle,
          true: Colors.accentWarm,
        }}
        thumbColor={value ? Colors.accentGlow : Colors.textSecondary}
        ios_backgroundColor={Colors.bgSubtle}
      />
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
});

// ─── LinkRow ──────────────────────────────────────────────────────────────────

function LinkRow({
  icon,
  label,
  destructive,
  onPress,
  isLast,
}: {
  icon: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
  isLast?: boolean;
}) {
  const color = destructive ? Colors.errorLight : Colors.textPrimary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[linkStyles.row, !isLast && linkStyles.rowDivider]}
    >
      <View
        style={[
          linkStyles.iconWrap,
          {
            backgroundColor: destructive
              ? 'rgba(239,68,68,0.08)'
              : Colors.bgSubtle,
          },
        ]}
      >
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <TText
        variant="bodySmall"
        style={{ flex: 1, color }}
      >
        {label}
      </TText>
      <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

const linkStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [publicProfile, setPublicProfile] = useState(true);
  const [shareAnalytics, setShareAnalytics] = useState(true);
  const [contentWarnings, setContentWarnings] = useState(false);
  const [locationData, setLocationData] = useState(false);

  const handleDeleteData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Supprimer mes données',
      'Cette action est irréversible. Toutes tes données personnelles seront effacées définitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () =>
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
        },
      ],
    );
  };

  const handleExportData = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Exporter mes données',
      'Tu recevras un email avec l\'archive de tes données sous 48h.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () =>
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="bold">
          Confidentialité
        </TText>
        <View style={{ width: 44 }} />
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* ── Visibility section ── */}
        <Animated.View
          entering={FadeInDown.delay(80).springify()}
          style={styles.section}
        >
          <TText
            variant="label"
            color="tertiary"
            uppercase
            style={styles.sectionLabel}
          >
            Visibilité
          </TText>
          <GlassCard variant="default" style={styles.card}>
            <ToggleRow
              icon="globe-outline"
              label="Profil public"
              description="Ton profil est visible par tous les visiteurs de la plateforme."
              value={publicProfile}
              onChange={setPublicProfile}
            />
            <ToggleRow
              icon="location-outline"
              label="Données de localisation"
              description="Utilisées pour afficher les artistes près de chez toi."
              value={locationData}
              onChange={setLocationData}
              isLast
            />
          </GlassCard>
        </Animated.View>

        {/* ── Data section ── */}
        <Animated.View
          entering={FadeInDown.delay(160).springify()}
          style={styles.section}
        >
          <TText
            variant="label"
            color="tertiary"
            uppercase
            style={styles.sectionLabel}
          >
            Données & personnalisation
          </TText>
          <GlassCard variant="default" style={styles.card}>
            <ToggleRow
              icon="bar-chart-outline"
              label="Partage des données analytiques"
              description="Aide à améliorer les recommandations du feed. Données agrégées et anonymisées."
              value={shareAnalytics}
              onChange={setShareAnalytics}
            />
            <ToggleRow
              icon="eye-off-outline"
              label="Avertissements de contenu"
              description="Les tatouages sensibles apparaissent floutés par défaut dans le feed."
              value={contentWarnings}
              onChange={setContentWarnings}
              isLast
            />
          </GlassCard>
        </Animated.View>

        {/* ── My data section ── */}
        <Animated.View
          entering={FadeInDown.delay(240).springify()}
          style={styles.section}
        >
          <TText
            variant="label"
            color="tertiary"
            uppercase
            style={styles.sectionLabel}
          >
            Mes données
          </TText>
          <GlassCard variant="default" style={styles.card}>
            <LinkRow
              icon="download-outline"
              label="Exporter mes données"
              onPress={handleExportData}
            />
            <LinkRow
              icon="trash-outline"
              label="Supprimer mes données"
              destructive
              onPress={handleDeleteData}
              isLast
            />
          </GlassCard>
        </Animated.View>

        {/* ── Footer note ── */}
        <Animated.View
          entering={FadeInDown.delay(320).springify()}
          style={styles.footerNote}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={14}
            color={Colors.textTertiary}
            style={{ marginRight: 6 }}
          />
          <TText variant="micro" color="tertiary" style={{ flex: 1, lineHeight: 16 }}>
            INKR ne vend jamais tes données à des tiers. Conformité RGPD assurée.
          </TText>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'],
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  section: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  sectionLabel: {
    letterSpacing: 2,
    marginBottom: Spacing['2xs'],
    paddingHorizontal: Spacing['2xs'],
  },
  card: { padding: Spacing.sm },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
});
