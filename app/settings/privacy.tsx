import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';
import { THeader } from '@/components/ui/THeader';
import { BottomSheet, EASE_OUT, MotionDuration, PressableScale } from '@/components/motion';

const PRIVACY_EMAIL = 'privacy@inkr.app';

// ─── Toggle: 180ms state transition, visual only (the row owns the press) ─────
function Toggle({ value }: { value: boolean }) {
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(value ? 1 : 0, { duration: MotionDuration.state, easing: EASE_OUT }));
  }, [value, p]);
  const onStyle = useAnimatedStyle(() => ({ opacity: p.get() }));
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: p.get() * 18 }] }));
  return (
    <View style={toggleStyles.track} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, toggleStyles.on, onStyle]} />
      <Animated.View style={[toggleStyles.knob, knobStyle]} />
    </View>
  );
}

const toggleStyles = StyleSheet.create({
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

// ─── Rows ─────────────────────────────────────────────────────────────────────
function ToggleRow({ icon, label, description, value, onChange }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value }}
      style={styles.row}
    >
      <Ionicons name={icon} size={19} color={value ? Colors.accentWarm : Colors.textTertiary} style={styles.rowIcon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TText variant="body" weight="medium">{label}</TText>
        <TText variant="caption" color="tertiary" style={{ marginTop: 2 }}>{description}</TText>
      </View>
      <Toggle value={value} />
    </Pressable>
  );
}

function LinkRow({ icon, label, destructive, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  const color = destructive ? Colors.errorLight : Colors.textPrimary;
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.985}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.row}
    >
      <Ionicons name={icon} size={19} color={destructive ? Colors.errorLight : Colors.textSecondary} style={styles.rowIcon} />
      <TText variant="body" weight="medium" style={{ flex: 1, color }}>{label}</TText>
      <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
    </PressableScale>
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

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [publicProfile, setPublicProfile] = useState(true);
  const [shareAnalytics, setShareAnalytics] = useState(true);
  const [contentWarnings, setContentWarnings] = useState(false);
  const [locationData, setLocationData] = useState(false);
  const [sheet, setSheet] = useState<'export' | 'delete' | null>(null);

  const writeToPrivacy = (subject: string) => {
    setSheet(null);
    Linking.openURL(`mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(subject)}`).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <THeader title="Confidentialité" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={17} color={Colors.warning} />
          <TText variant="caption" color="secondary" style={{ flex: 1 }}>
            Ces réglages ne sont pas encore enregistrés sur votre compte : ils reviennent à leur valeur par défaut à la prochaine ouverture.
          </TText>
        </View>

        <Group title="Visibilité">
          <ToggleRow
            icon="globe-outline"
            label="Profil public"
            description="Votre profil est visible par tous les visiteurs de la plateforme."
            value={publicProfile}
            onChange={setPublicProfile}
          />
          <ToggleRow
            icon="location-outline"
            label="Données de localisation"
            description="Utilisées pour afficher les artistes près de chez vous."
            value={locationData}
            onChange={setLocationData}
          />
        </Group>

        <Group title="Données et personnalisation">
          <ToggleRow
            icon="bar-chart-outline"
            label="Mesure d’audience"
            description="Aide à améliorer les recommandations. Données agrégées."
            value={shareAnalytics}
            onChange={setShareAnalytics}
          />
          <ToggleRow
            icon="eye-off-outline"
            label="Avertissements de contenu"
            description="Les tatouages sensibles apparaissent floutés par défaut."
            value={contentWarnings}
            onChange={setContentWarnings}
          />
        </Group>

        <Group title="Mes données">
          <LinkRow icon="download-outline" label="Obtenir une copie de mes données" onPress={() => setSheet('export')} />
          <LinkRow icon="trash-outline" label="Supprimer mes données" destructive onPress={() => setSheet('delete')} />
        </Group>

        <Pressable
          onPress={() => router.push('/legal/privacy-policy')}
          accessibilityRole="link"
          style={styles.footer}
        >
          <Ionicons name="shield-checkmark-outline" size={15} color={Colors.textTertiary} />
          <TText variant="caption" color="tertiary" style={{ flex: 1 }}>
            INKR ne vend pas vos données.{' '}
            <TText variant="caption" color="secondary" style={styles.underline}>Lire la politique de confidentialité</TText>
          </TText>
        </Pressable>
      </ScrollView>

      {/* Data requests: honest about the manual process, no fake success */}
      <BottomSheet
        visible={sheet === 'export'}
        onClose={() => setSheet(null)}
        accessibilityLabel="Obtenir une copie de vos données"
      >
        <TText variant="displayS">Copie de vos données</TText>
        <TText variant="bodySmall" color="secondary" style={styles.sheetBody}>
          L’export automatique n’est pas encore disponible. Écrivez-nous à {PRIVACY_EMAIL} depuis l’adresse de votre compte : nous vous enverrons une copie de vos données.
        </TText>
        <View style={styles.sheetActions}>
          <TButton title="Écrire à l’équipe confidentialité" onPress={() => writeToPrivacy('Demande de copie de mes données')} />
          <TButton title="Fermer" variant="ghost" onPress={() => setSheet(null)} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'delete'}
        onClose={() => setSheet(null)}
        accessibilityLabel="Supprimer vos données"
      >
        <TText variant="displayS">Supprimer vos données</TText>
        <TText variant="bodySmall" color="secondary" style={styles.sheetBody}>
          Vos données personnelles sont rattachées à votre compte. Pour les effacer, supprimez votre compte, ou écrivez-nous à {PRIVACY_EMAIL} pour une demande ciblée.
        </TText>
        <View style={styles.sheetActions}>
          <TButton
            title="Continuer vers la suppression du compte"
            variant="destructive"
            onPress={() => { setSheet(null); router.push('/settings/delete-account'); }}
          />
          <TButton title="Écrire à l’équipe confidentialité" variant="secondary" onPress={() => writeToPrivacy('Demande de suppression de données')} />
          <TButton title="Annuler" variant="ghost" onPress={() => setSheet(null)} />
        </View>
      </BottomSheet>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 12,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  rowIcon: { width: 22 },
  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: Spacing.lg, paddingVertical: 6 },
  underline: { textDecorationLine: 'underline' },
  sheetBody: { marginTop: Spacing['2xs'], marginBottom: Spacing.lg },
  sheetActions: { gap: 10 },
});
