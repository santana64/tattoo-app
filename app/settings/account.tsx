import React, { useState, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { useAuthStore } from '@/store/auth-store';

// ── Avatar initials helper ──────────────────────────────────────
function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ── Glass input field ───────────────────────────────────────────
function GlassField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  multiline,
  delay = 0,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
  delay?: number;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <View style={[field.wrap, focused && field.focused]}>
        {focused && (
          <LinearGradient
            colors={['rgba(212,168,100,0.07)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={field.row}>
          <Ionicons
            name={icon}
            size={16}
            color={focused ? Colors.accentWarm : Colors.textTertiary}
            style={field.icon}
          />
          <View style={{ flex: 1 }}>
            <TText
              variant="micro"
              uppercase
              style={[
                field.label,
                { color: focused ? Colors.accentWarm : Colors.textTertiary },
              ]}
            >
              {label}
            </TText>
            <TextInput
              style={[field.input, multiline && { height: 64, textAlignVertical: 'top' }]}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={Colors.textTertiary}
              keyboardType={keyboardType ?? 'default'}
              autoCapitalize={autoCapitalize ?? 'sentences'}
              autoCorrect={false}
              multiline={multiline}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const field = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    overflow: 'hidden',
    marginBottom: Spacing['2xs'],
  },
  focused: { borderColor: Colors.accentWarm },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: { marginRight: Spacing['2xs'], marginTop: 18 },
  label: { fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  input: {
    color: Colors.textPrimary,
    fontSize: FontSize.body,
    fontWeight: '500',
    paddingTop: 2,
    paddingBottom: 0,
  },
});

// ── Main screen ─────────────────────────────────────────────────
export default function AccountSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [city, setCity] = useState((user as any)?.city ?? '');
  const [saved, setSaved] = useState(false);

  const isDirty =
    displayName !== (user?.displayName ?? '') ||
    email !== (user?.email ?? '') ||
    city !== ((user as any)?.city ?? '');

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateProfile({ displayName, email, city } as any);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.back();
    }, 900);
  };

  const initials = getInitials(displayName || user?.displayName || 'U');

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="bold">Mon compte</TText>
        <View style={{ width: 44 }} />
      </Animated.View>

      {/* Avatar section */}
      <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.avatarSection}>
        <View style={styles.avatarOuter}>
          <LinearGradient
            colors={[Colors.accentGlow, Colors.accentWarm, '#A06030']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.avatarInner}>
            <TText
              variant="title1"
              weight="black"
              style={{ color: Colors.bgPrimary, letterSpacing: -0.5 }}
            >
              {initials}
            </TText>
          </View>
        </View>
        <TouchableOpacity
          style={styles.avatarEditBtn}
          activeOpacity={0.7}
          onPress={() =>
            Alert.alert('Photo de profil', 'Cette fonctionnalité arrive bientôt.')
          }
        >
          <Ionicons name="camera" size={13} color={Colors.bgPrimary} />
        </TouchableOpacity>
        <TText variant="bodySmall" color="secondary" style={{ marginTop: Spacing['2xs'] }}>
          {user?.displayName ?? 'Ton nom'}
        </TText>
        {(user as any)?.role === 'artist' && (
          <View style={styles.roleBadge}>
            <TText variant="micro" uppercase style={{ color: Colors.accentWarm, letterSpacing: 1.2 }}>
              Artiste
            </TText>
          </View>
        )}
      </Animated.View>

      {/* Form */}
      <View style={styles.form}>
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <TText
            variant="micro"
            uppercase
            color="tertiary"
            style={styles.sectionLabel}
          >
            Informations personnelles
          </TText>
        </Animated.View>

        <GlassField
          label="Nom affiché"
          icon="person-outline"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Ton prénom ou pseudonyme"
          autoCapitalize="words"
          delay={240}
        />
        <GlassField
          label="Email"
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          placeholder="ton@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          delay={300}
        />
        <GlassField
          label="Ville"
          icon="location-outline"
          value={city}
          onChangeText={setCity}
          placeholder="Paris, Lyon, Bordeaux…"
          delay={360}
        />

        {/* Auth methods */}
        <Animated.View entering={FadeInDown.delay(420).springify()}>
          <TText
            variant="micro"
            uppercase
            color="tertiary"
            style={[styles.sectionLabel, { marginTop: Spacing.lg }]}
          >
            Méthodes de connexion
          </TText>
          <View style={styles.authCard}>
            <View style={styles.authRow}>
              <View style={styles.authIcon}>
                <Ionicons name="logo-apple" size={18} color={Colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <TText variant="bodySmall" weight="medium">Apple</TText>
                <TText variant="caption" color="tertiary">Connecté</TText>
              </View>
              <View style={styles.connectedBadge}>
                <TText variant="micro" style={{ color: Colors.success }}>Actif</TText>
              </View>
            </View>
            <View style={styles.authDivider} />
            <View style={styles.authRow}>
              <View style={[styles.authIcon, { backgroundColor: Colors.bgSubtle }]}>
                <Ionicons name="logo-google" size={18} color={Colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <TText variant="bodySmall" weight="medium" color="secondary">Google</TText>
                <TText variant="caption" color="tertiary">Non lié</TText>
              </View>
              <TouchableOpacity style={styles.linkBtn}>
                <TText variant="caption" style={{ color: Colors.accentWarm }}>Lier</TText>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Active sessions */}
        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <TText
            variant="micro"
            uppercase
            color="tertiary"
            style={[styles.sectionLabel, { marginTop: Spacing.lg }]}
          >
            Session active
          </TText>
          <View style={styles.sessionCard}>
            <Ionicons name="phone-portrait-outline" size={20} color={Colors.accentWarm} />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <TText variant="bodySmall" weight="medium">iPhone · Paris</TText>
              <TText variant="caption" color="tertiary">Actif maintenant · Session actuelle</TText>
            </View>
            <View style={styles.activeDot} />
          </View>
          <TouchableOpacity style={{ marginTop: Spacing['2xs'] }}>
            <TText variant="caption" color="error" style={{ paddingHorizontal: Spacing.xs }}>
              Déconnecter toutes les autres sessions
            </TText>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Save button */}
      <Animated.View
        entering={FadeInDown.delay(560).springify()}
        style={[styles.saveSection, { paddingBottom: 0 }]}
      >
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.85}
          style={[styles.saveBtn, !isDirty && styles.saveBtnDisabled]}
          disabled={!isDirty && !saved}
        >
          <LinearGradient
            colors={
              saved
                ? [Colors.success, Colors.successLight]
                : isDirty
                ? [Colors.accentGlow, Colors.accentWarm, '#A06030']
                : [Colors.bgSubtle, Colors.bgElevated]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <TText
            variant="body"
            weight="bold"
            style={{
              color: isDirty || saved ? Colors.bgPrimary : Colors.textTertiary,
            }}
          >
            {saved ? '✓ Sauvegardé' : 'Sauvegarder'}
          </TText>
        </TouchableOpacity>
      </Animated.View>
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
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  avatarOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...GlowShadow.amber,
  },
  avatarInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 52,
    right: '50%',
    transform: [{ translateX: 28 }],
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.accentWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },
  roleBadge: {
    marginTop: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentMuted,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  form: {
    paddingHorizontal: Spacing.lg,
  },
  sectionLabel: {
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
  },
  authCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
    marginBottom: Spacing['2xs'],
  },
  authRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
  },
  authIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  authDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSubtle,
    marginHorizontal: Spacing.sm,
  },
  connectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  linkBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    padding: Spacing.sm,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  saveSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  saveBtn: {
    height: 56,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...GlowShadow.amber,
  },
  saveBtnDisabled: {
    opacity: 0.5,
    ...GlowShadow.none,
  },
});
