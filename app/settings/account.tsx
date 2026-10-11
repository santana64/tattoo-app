import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TDivider } from '@/components/ui/TDivider';
import { THeader } from '@/components/ui/THeader';
import { useAuthStore } from '@/store/auth-store';


const PROVIDERS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  email:  { label: 'E-mail (lien de connexion)', icon: 'mail-outline' },
  apple:  { label: 'Apple', icon: 'logo-apple' },
  google: { label: 'Google', icon: 'logo-google' },
};

// ── Main screen ─────────────────────────────────────────────────
export default function AccountSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, session, updateProfile } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  // The e-mail is the sign-in identifier: shown read-only, never edited here.
  const email = user?.email ?? '';
  const [city, setCity] = useState(user?.city ?? '');
  const [saved, setSaved] = useState(false);

  const isDirty =
    displayName !== (user?.displayName ?? '') ||
    city !== (user?.city ?? '');

  const handleSave = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateProfile({ displayName, email, city } as any);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.back();
    }, 900);
  };

  // Sign-in methods actually linked to this account (from the Supabase session).
  const providers = useMemo(() => {
    const fromIdentities = (session?.user.identities ?? []).map((i) => i.provider);
    const fromMeta = (session?.user.app_metadata?.providers as string[] | undefined) ?? [];
    return Array.from(new Set([...fromIdentities, ...fromMeta]));
  }, [session]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <THeader title="Informations personnelles" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identity */}
        <View style={styles.identity}>
          <TAvatar uri={user?.avatarUrl} name={displayName || user?.displayName} size="2xl" />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <TText variant="displayS" numberOfLines={1}>{displayName || user?.displayName || 'Votre nom'}</TText>
            <TText variant="caption" color="tertiary">
              {user?.role === 'artist' ? 'Compte artiste' : 'Compte client'}
            </TText>
            <TButton
              title="Changer la photo"
              variant="secondary"
              size="sm"
              fullWidth={false}
              style={{ marginTop: Spacing['2xs'], alignSelf: 'flex-start' }}
              icon={<Ionicons name="camera-outline" size={15} color={Colors.textPrimary} />}
              onPress={() => Alert.alert('Photo de profil', 'Cette fonctionnalité arrive bientôt.')}
            />
          </View>
        </View>

        {/* Form */}
        <View>
          <TText variant="label" color="tertiary" uppercase style={styles.sectionLabel}>Profil</TText>
          <TInput
            label="Nom affiché"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Votre prénom ou pseudonyme"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
          />
          <TInput
            label="Ville"
            value={city}
            onChangeText={setCity}
            placeholder="Paris, Lyon, Bordeaux…"
            autoCapitalize="words"
            textContentType="addressCity"
          />
        </View>

        {/* E-mail, read-only */}
        <View style={styles.block}>
          <TText variant="label" color="tertiary" uppercase style={styles.sectionLabel}>Connexion</TText>
          <View style={styles.list}>
            <View style={styles.row} accessible accessibilityLabel={`Adresse e-mail : ${email || 'non renseignée'}`}>
              <Ionicons name="at-outline" size={19} color={Colors.textSecondary} style={styles.rowIcon} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <TText variant="caption" color="tertiary">Adresse e-mail</TText>
                <TText variant="body" numberOfLines={1} selectable>{email || '—'}</TText>
              </View>
              <Ionicons name="lock-closed-outline" size={15} color={Colors.textTertiary} />
            </View>
            {providers.map((p) => {
              const conf = PROVIDERS[p] ?? { label: p.charAt(0).toUpperCase() + p.slice(1), icon: 'key-outline' as const };
              return (
                <React.Fragment key={p}>
                  <TDivider inset={34} />
                  <View style={styles.row} accessible accessibilityLabel={`${conf.label}, méthode de connexion active`}>
                    <Ionicons name={conf.icon} size={19} color={Colors.textSecondary} style={styles.rowIcon} />
                    <TText variant="body" style={{ flex: 1 }} numberOfLines={1}>{conf.label}</TText>
                    <View style={styles.status}>
                      <View style={styles.dot} />
                      <TText variant="caption" color="secondary">Active</TText>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
          <TText variant="caption" color="tertiary" style={styles.helper}>
            L’adresse e-mail sert à vous connecter. Pour la modifier, écrivez-nous depuis Aide et support.
          </TText>
        </View>

        {/* Save */}
        <View style={styles.save}>
          <TButton
            title={saved ? 'Enregistré' : 'Enregistrer les modifications'}
            onPress={handleSave}
            disabled={!isDirty || saved}
            icon={saved ? <Ionicons name="checkmark" size={18} color={Colors.textInverse} /> : undefined}
          />
          {!isDirty && !saved && (
            <TText variant="caption" color="tertiary" style={{ textAlign: 'center', marginTop: Spacing['2xs'] }}>
              Aucune modification à enregistrer.
            </TText>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    width: '100%', maxWidth: Layout.maxReading + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xl },
  sectionLabel: { marginBottom: Spacing.xs },
  block: { marginTop: Spacing.sm },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  rowIcon: { width: 22 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  helper: { marginTop: Spacing['2xs'] },
  save: { marginTop: Spacing['2xl'] },
});
