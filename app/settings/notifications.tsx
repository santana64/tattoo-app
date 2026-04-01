import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TDivider } from '@/components/ui/TDivider';
import { useAuthStore } from '@/store/auth-store';

interface NotifPref { push: boolean; email: boolean }

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const isArtist = user?.role === 'artist';

  const [prefs, setPrefs] = useState({
    newRequests: { push: true, email: true },
    messages: { push: true, email: false },
    appointments: { push: true, email: true },
    subscription: { push: true, email: true },
    likes: { push: false, email: false },
  });

  const toggle = (key: keyof typeof prefs, type: 'push' | 'email') => {
    setPrefs((p) => ({ ...p, [key]: { ...p[key], [type]: !p[key][type] } }));
  };

  const NotifRow = ({ label, prefKey }: { label: string; prefKey: keyof typeof prefs }) => (
    <View style={styles.notifRow}>
      <TText variant="bodySmall" style={{ flex: 1 }}>{label}</TText>
      <View style={styles.toggles}>
        <View style={styles.toggleItem}>
          <TText variant="caption" color="tertiary">Push</TText>
          <Switch
            value={prefs[prefKey].push}
            onValueChange={() => toggle(prefKey, 'push')}
            trackColor={{ false: Colors.bgSubtle, true: Colors.accent }}
            thumbColor={Colors.accentAction}
          />
        </View>
        <View style={styles.toggleItem}>
          <TText variant="caption" color="tertiary">Email</TText>
          <Switch
            value={prefs[prefKey].email}
            onValueChange={() => toggle(prefKey, 'email')}
            trackColor={{ false: Colors.bgSubtle, true: Colors.accent }}
            thumbColor={Colors.accentAction}
          />
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Notifications</TText>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.section}>
        {isArtist && <NotifRow label="Nouvelles demandes" prefKey="newRequests" />}
        <NotifRow label="Messages" prefKey="messages" />
        <NotifRow label="Rendez-vous" prefKey="appointments" />
        {isArtist && <NotifRow label="Abonnement" prefKey="subscription" />}
        <NotifRow label="Likes (résumé quotidien)" prefKey="likes" />
      </View>

      <TDivider style={{ marginHorizontal: Spacing.sm, marginTop: Spacing.sm }} />

      <View style={styles.silenceSection}>
        <TText variant="bodySmall" weight="semibold" style={{ marginBottom: Spacing['2xs'] }}>
          Mode silencieux
        </TText>
        <TText variant="bodySmall" color="secondary">
          Définis des plages horaires où tu ne veux pas être dérangé.
        </TText>
        <TouchableOpacity style={styles.addSilenceBtn}>
          <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
          <TText variant="bodySmall" color="accent" style={{ marginLeft: 6 }}>
            Ajouter une plage
          </TText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

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
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  toggles: { flexDirection: 'row', gap: Spacing.sm },
  toggleItem: { alignItems: 'center', gap: 2 },
  silenceSection: { padding: Spacing.sm },
  addSilenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
});
