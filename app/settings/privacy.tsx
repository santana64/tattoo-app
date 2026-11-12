import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { BottomSheet } from '@/components/motion';
import { Masthead, SettingRow, TextLink, Toggle } from '@/components/v5';
import { SETTINGS_PANE, SettingsNotice, SettingsSection } from '@/components/v5/SettingsParts';
import { useContentDimensions } from '@/hooks/useContentDimensions';

const PRIVACY_EMAIL = 'privacy@inkr.app';

// ─── Rows ─────────────────────────────────────────────────────────────────────
function ToggleRow({ label, description, value, onChange }: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <SettingRow
      title={label}
      description={description}
      right={(
        <Toggle
          value={value}
          label={label}
          onChange={(next) => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(next);
          }}
        />
      )}
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gutter } = useContentDimensions();

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
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <Masthead
          kicker="Paramètres / Confidentialité"
          title="Vos données,"
          emphasis="avec respect."
          description="Ce qui est visible de vous, ce qui est mesuré, et comment obtenir ou effacer vos données."
        />

        <View style={styles.pane}>
          <SettingsNotice label="Non enregistré">
            Ces réglages ne sont pas encore enregistrés sur votre compte : ils reviennent à leur valeur par défaut à la prochaine ouverture.
          </SettingsNotice>

          <SettingsSection number="01" title="Visibilité">
            <ToggleRow
              label="Profil public"
              description="Votre profil est visible par tous les visiteurs de la plateforme."
              value={publicProfile}
              onChange={setPublicProfile}
            />
            <ToggleRow
              label="Données de localisation"
              description="Utilisées pour afficher les artistes près de chez vous."
              value={locationData}
              onChange={setLocationData}
            />
          </SettingsSection>

          <SettingsSection number="02" title="Données et personnalisation">
            <ToggleRow
              label="Mesure d’audience"
              description="Aide à améliorer les recommandations. Données agrégées."
              value={shareAnalytics}
              onChange={setShareAnalytics}
            />
            <ToggleRow
              label="Avertissements de contenu"
              description="Les tatouages sensibles apparaissent floutés par défaut."
              value={contentWarnings}
              onChange={setContentWarnings}
            />
          </SettingsSection>

          <SettingsSection number="03" title="Mes données">
            <SettingRow title="Obtenir une copie de mes données" onPress={() => setSheet('export')} />
            <SettingRow title="Supprimer mes données" destructive onPress={() => setSheet('delete')} />
          </SettingsSection>

          <View style={styles.footer}>
            <TText variant="caption" color="secondary">INKR ne vend pas vos données.</TText>
            <TextLink label="Lire la politique de confidentialité" onPress={() => router.push('/legal/privacy-policy')} />
          </View>
        </View>
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
  container: { flex: 1, backgroundColor: Colors.paper },
  content: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },
  pane: { width: '100%', maxWidth: SETTINGS_PANE },
  footer: { marginTop: Spacing.xl, gap: 6, alignItems: 'flex-start' },
  sheetBody: { marginTop: Spacing['2xs'], marginBottom: Spacing.lg },
  sheetActions: { gap: 10 },
});
