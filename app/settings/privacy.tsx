import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TDivider } from '@/components/ui/TDivider';

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [publicProfile, setPublicProfile] = useState(true);
  const [shareAnalytics, setShareAnalytics] = useState(true);
  const [contentWarnings, setContentWarnings] = useState(false);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Confidentialité</TText>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.section}>
        <PrefRow
          label="Profil public"
          description="Ton profil est visible par tous les visiteurs."
          value={publicProfile}
          onChange={setPublicProfile}
        />
        <PrefRow
          label="Partage des données analytiques"
          description="Aide à améliorer les recommandations du feed. Données agrégées et anonymisées."
          value={shareAnalytics}
          onChange={setShareAnalytics}
        />
        <PrefRow
          label="Masquer les contenus sensibles"
          description="Les tatouages avec avertissement de contenu apparaissent floutés par défaut."
          value={contentWarnings}
          onChange={setContentWarnings}
        />
      </View>

      <TDivider style={{ marginHorizontal: Spacing.sm }} />

      <View style={styles.section}>
        <TouchableOpacity style={styles.linkRow}>
          <TText variant="bodySmall">Historique de recherche</TText>
          <TouchableOpacity>
            <TText variant="caption" color="error">Effacer</TText>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function PrefRow({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={prefStyles.row}>
      <View style={prefStyles.text}>
        <TText variant="bodySmall" weight="semibold">{label}</TText>
        <TText variant="caption" color="tertiary" style={{ marginTop: 2 }}>{description}</TText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.bgSubtle, true: Colors.accent }}
        thumbColor={Colors.accentAction}
      />
    </View>
  );
}

const prefStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
    gap: Spacing.sm,
  },
  text: { flex: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  section: { padding: Spacing.sm },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
});
