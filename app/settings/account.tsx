import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { THeader } from '@/components/ui/THeader';
import { Kicker, Masthead, Rule, StatusDot } from '@/components/v5';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useAuthStore } from '@/store/auth-store';

/** Forms on settings pages stay in a 720px pane. */
const PANE = 720;


const PROVIDERS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  email:  { label: 'E-mail (lien de connexion)', icon: 'mail-outline' },
  apple:  { label: 'Apple', icon: 'logo-apple' },
  google: { label: 'Google', icon: 'logo-google' },
};

// ── Main screen ─────────────────────────────────────────────────
export default function AccountSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isWide, gutter } = useContentDimensions();
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
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Masthead
          kicker="Paramètres / Compte"
          title="Informations"
          emphasis="personnelles."
          description="Le nom affiché et la ville de votre compte. L’adresse e-mail sert à vous connecter."
        />

        <View style={styles.pane}>
          {/* Identity */}
          <View style={styles.identity}>
            <TAvatar uri={user?.avatarUrl} name={displayName || user?.displayName} size="2xl" />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <TText variant="displayS" numberOfLines={2}>{displayName || user?.displayName || 'Votre nom'}</TText>
              <Kicker tone="muted">{user?.role === 'artist' ? 'Compte artiste' : 'Compte client'}</Kicker>
              <TButton
                title="Changer la photo"
                variant="secondary"
                size="sm"
                fullWidth={false}
                style={{ marginTop: Spacing.xs, alignSelf: 'flex-start' }}
                onPress={() => Alert.alert('Photo de profil', 'Cette fonctionnalité arrive bientôt.')}
              />
            </View>
          </View>

          {/* Form */}
          <Kicker style={styles.sectionLabel}>01 / Profil</Kicker>
          <Rule tone="ink" style={styles.sectionRule} />
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

          {/* E-mail, read-only */}
          <View style={styles.block}>
            <Kicker style={styles.sectionLabel}>02 / Connexion</Kicker>
            <Rule tone="ink" />
            <View style={styles.row} accessible accessibilityLabel={`Adresse e-mail : ${email || 'non renseignée'}`}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <TText variant="caption" color="secondary">Adresse e-mail</TText>
                <TText variant="body" weight="medium" numberOfLines={1} selectable>{email || '—'}</TText>
              </View>
              <Ionicons name="lock-closed-outline" size={15} color={Colors.textSecondary} />
            </View>
            {providers.map((p) => {
              const conf = PROVIDERS[p] ?? { label: p.charAt(0).toUpperCase() + p.slice(1), icon: 'key-outline' as const };
              return (
                <View key={p} style={styles.row} accessible accessibilityLabel={`${conf.label}, méthode de connexion active`}>
                  <Ionicons name={conf.icon} size={18} color={Colors.ink} style={styles.rowIcon} />
                  <TText variant="body" style={{ flex: 1 }} numberOfLines={1}>{conf.label}</TText>
                  <StatusDot tone="open" label="Active" />
                </View>
              );
            })}
            <TText variant="caption" color="secondary" style={styles.helper}>
              L’adresse e-mail sert à vous connecter. Pour la modifier, écrivez-nous depuis Aide et support.
            </TText>
          </View>

          {/* Save */}
          <View style={styles.save}>
            <TButton
              title={saved ? 'Enregistré' : 'Enregistrer les modifications'}
              onPress={handleSave}
              disabled={!isDirty || saved}
              fullWidth={!isWide}
              style={isWide ? { alignSelf: 'flex-start' } : undefined}
              icon={saved ? <Ionicons name="checkmark" size={18} color={Colors.textInverse} /> : undefined}
            />
            {!isDirty && !saved && (
              <TText variant="caption" color="secondary" style={styles.saveHint}>
                Aucune modification à enregistrer.
              </TText>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  content: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },
  pane: { width: '100%', maxWidth: PANE },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xl },
  sectionLabel: { marginBottom: Spacing.xs },
  sectionRule: { marginBottom: Spacing.md },
  block: { marginTop: Spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  rowIcon: { width: 22 },
  helper: { marginTop: Spacing.xs },
  save: { marginTop: Spacing['2xl'] },
  saveHint: { marginTop: Spacing['2xs'] },
});
