import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { THeader } from '@/components/ui/THeader';
import { Masthead, SettingRow, Toggle } from '@/components/v5';
import { SETTINGS_PANE, SettingsNotice, SettingsSection } from '@/components/v5/SettingsParts';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useAuthStore } from '@/store/auth-store';

// ── Types ────────────────────────────────────────────────────────
interface ToggleState {
  nouvelles_demandes: boolean;
  nouveaux_messages: boolean;
  rendez_vous: boolean;
  promotions: boolean;
  newsletter: boolean;
}

// ── Toggle row: serif title, one line of help, the switch at the right ──
function ToggleRow({ label, subtitle, value, onValueChange }: {
  label: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <SettingRow
      title={label}
      description={subtitle}
      right={(
        <Toggle
          value={value}
          label={label}
          onChange={(next) => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onValueChange(next);
          }}
        />
      )}
    />
  );
}

// ── Main screen ──────────────────────────────────────────────────
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { gutter } = useContentDimensions();
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
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <Masthead
          kicker="Paramètres / Notifications"
          title="Ce qui mérite"
          emphasis="votre attention."
          description="Choisissez ce qui vous parvient par notification et par e-mail."
        />

        <View style={styles.pane}>
          {/* Honest status: these switches are not stored server-side yet */}
          <SettingsNotice label="Non enregistré">
            Ces préférences ne sont pas encore enregistrées sur votre compte : elles reviennent à leur valeur par défaut à la prochaine ouverture.
          </SettingsNotice>

          <SettingsSection number="01" title="Notifications push">
            {isArtist && (
              <ToggleRow
                label="Nouvelles demandes"
                subtitle="Quand un client vous envoie une demande"
                value={push.nouvelles_demandes}
                onValueChange={() => togglePush('nouvelles_demandes')}
              />
            )}
            <ToggleRow
              label="Nouveaux messages"
              subtitle="Messages dans vos conversations"
              value={push.nouveaux_messages}
              onValueChange={() => togglePush('nouveaux_messages')}
            />
            <ToggleRow
              label="Rendez-vous"
              subtitle="Confirmations et rappels de séance"
              value={push.rendez_vous}
              onValueChange={() => togglePush('rendez_vous')}
            />
            <ToggleRow
              label="Offres et nouveautés"
              subtitle="Annonces sur les fonctionnalités d’INKR"
              value={push.promotions}
              onValueChange={() => togglePush('promotions')}
            />
          </SettingsSection>

          <SettingsSection number="02" title="E-mails">
            {isArtist && (
              <ToggleRow
                label="Nouvelles demandes"
                subtitle="Un e-mail à chaque nouvelle demande"
                value={emailNotifs.nouvelles_demandes}
                onValueChange={() => toggleEmail('nouvelles_demandes')}
              />
            )}
            <ToggleRow
              label="Nouveaux messages"
              subtitle="Copie par e-mail de vos conversations"
              value={emailNotifs.nouveaux_messages}
              onValueChange={() => toggleEmail('nouveaux_messages')}
            />
            <ToggleRow
              label="Rendez-vous"
              subtitle="Confirmation et rappel la veille"
              value={emailNotifs.rendez_vous}
              onValueChange={() => toggleEmail('rendez_vous')}
            />
            <ToggleRow
              label="Lettre d’information"
              subtitle="Actualités de la communauté INKR"
              value={emailNotifs.newsletter}
              onValueChange={() => toggleEmail('newsletter')}
            />
          </SettingsSection>

          <SettingsSection number="03" title="Rythme">
            <ToggleRow
              label="Résumé quotidien"
              subtitle="Un récapitulatif chaque soir à 20 h"
              value={digest}
              onValueChange={setDigest}
            />
            <ToggleRow
              label="Heures silencieuses"
              subtitle="Aucune notification push entre 22 h et 8 h"
              value={quietHours}
              onValueChange={setQuietHours}
            />
          </SettingsSection>

          <TText variant="caption" color="secondary" style={styles.footnote}>
            Les messages essentiels (sécurité, facturation) ne peuvent pas être désactivés.
          </TText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  content: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },
  pane: { width: '100%', maxWidth: SETTINGS_PANE },
  footnote: { marginTop: Spacing.lg },
});
