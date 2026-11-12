import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';
import { useRequestStore } from '@/store/request-store';

type IconName = keyof typeof Ionicons.glyphMap;

interface Item {
  label: string;
  href: Href;
  /** Pathname prefixes that mark this entry as current. */
  match: string[];
  icon: IconName;
  badge?: number;
}

interface Group {
  title: string;
  items: Item[];
}

function isCurrent(pathname: string, match: string[]) {
  return match.some((m) => (m === '/' ? pathname === '/' : pathname === m || pathname.startsWith(`${m}/`)));
}

function Link({ item, current }: { item: Item; current: boolean }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate(item.href)}
      accessibilityRole="link"
      accessibilityLabel={item.badge ? `${item.label}, ${item.badge} en attente` : item.label}
      accessibilityState={{ selected: current }}
      style={(state) => {
        const { hovered, focused } = state as { hovered?: boolean; focused?: boolean };
        return [styles.link, (hovered || current) && styles.linkActive, focused && styles.linkFocused];
      }}
    >
      {(state) => {
        const { hovered } = state as { hovered?: boolean };
        const lit = hovered || current;
        return (
          <>
            {current && <View style={styles.marker} />}
            <Ionicons name={item.icon} size={16} color={lit ? '#FFFFFF' : Colors.onInkMuted} />
            <TText variant="caption" style={[styles.linkLabel, { color: lit ? '#FFFFFF' : Colors.onInkMuted }]} numberOfLines={1}>
              {item.label}
            </TText>
            {!!item.badge && (
              <TText variant="micro" tabular style={styles.badge}>
                {String(item.badge).padStart(2, '0')}
              </TText>
            )}
          </>
        );
      }}
    </Pressable>
  );
}

/**
 * Fixed ink navigation rail for wide web screens. Phones and tablets keep the
 * bottom tab bar; this never renders on native.
 */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const requests = useRequestStore((s) => s.requests);

  const isArtist = user?.role === 'artist';
  const signedIn = isAuthenticated && !!user;
  const pending = isArtist ? requests.filter((r) => r.status === 'submitted').length : 0;

  const groups: Group[] = [
    {
      title: 'La galerie',
      items: [
        { label: 'Découvrir', href: '/(tabs)', match: ['/'], icon: 'home-outline' },
        { label: 'Rechercher un artiste', href: '/(tabs)/explore', match: ['/explore'], icon: 'search-outline' },
        ...(signedIn ? [{ label: 'Favoris', href: '/saved' as Href, match: ['/saved'], icon: 'heart-outline' as IconName }] : []),
      ],
    },
  ];

  if (signedIn) {
    groups.push({
      title: isArtist ? 'Vos clients' : 'Votre parcours',
      items: [
        {
          label: isArtist ? 'Demandes' : 'Mes projets',
          href: '/(tabs)/inbox', match: ['/inbox', '/request'], icon: 'bookmark-outline', badge: pending,
        },
        { label: 'Messages', href: '/(tabs)/messages', match: ['/messages', '/conversation'], icon: 'chatbubble-outline' },
        ...(isArtist
          ? [{ label: 'Agenda', href: '/(tabs)/agenda' as Href, match: ['/agenda', '/appointment'], icon: 'calendar-outline' as IconName }]
          : []),
      ],
    });
  }

  if (isArtist) {
    groups.push({
      title: 'L’atelier',
      items: [
        { label: 'Studio', href: '/(tabs)/profile', match: ['/profile'], icon: 'grid-outline' },
        { label: 'Horaires et disponibilités', href: '/availability', match: ['/availability'], icon: 'time-outline' },
        { label: 'Statistiques', href: '/analytics', match: ['/analytics'], icon: 'stats-chart-outline' },
        { label: 'Publier une œuvre', href: '/create', match: ['/create'], icon: 'add-outline' },
      ],
    });
  }

  if (signedIn) {
    groups.push({
      title: 'Le compte',
      items: [
        ...(isArtist ? [] : [{ label: 'Profil', href: '/(tabs)/profile' as Href, match: ['/profile'], icon: 'person-outline' as IconName }]),
        { label: 'Notifications', href: '/notifications', match: ['/notifications'], icon: 'notifications-outline' },
        { label: 'Réglages', href: '/settings', match: ['/settings'], icon: 'options-outline' },
        ...(user?.isAdmin ? [{ label: 'Modération', href: '/admin' as Href, match: ['/admin'], icon: 'shield-outline' as IconName }] : []),
      ],
    });
  }

  return (
    <View style={styles.rail} accessibilityRole={Platform.OS === 'web' ? ('navigation' as never) : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => router.navigate('/(tabs)')}
          accessibilityRole="link"
          accessibilityLabel="Inkr, retour à l’accueil"
          style={styles.head}
        >
          <Logo variant="wordmark" size="md" color={Colors.onInk} />
          <TText variant="micro" uppercase style={styles.edition}>The human canvas</TText>
        </Pressable>

        {groups.map((group) => (
          <View key={group.title}>
            <TText variant="micro" weight="bold" uppercase style={styles.groupTitle}>{group.title}</TText>
            {group.items.map((item) => (
              <Link key={item.label} item={item} current={isCurrent(pathname, item.match)} />
            ))}
          </View>
        ))}

        <View style={styles.foot}>
          {signedIn ? (
            <TText variant="micro" style={styles.footText} numberOfLines={2}>
              Connecté en tant que{'\n'}
              <TText variant="micro" weight="semibold" style={{ color: Colors.onInk, letterSpacing: 0 }}>
                {(isArtist && user?.artistBlaze) || user?.displayName || (isArtist ? 'Artiste' : 'Client')}
              </TText>
            </TText>
          ) : !isLoading ? (
            <Pressable
              onPress={() => router.navigate('/(auth)/sign-in')}
              accessibilityRole="link"
              style={(state) => [styles.signIn, (state as { hovered?: boolean }).hovered && styles.signInHover]}
            >
              <TText variant="caption" weight="semibold" style={{ color: Colors.onInk }}>Se connecter</TText>
              <TText variant="micro" style={styles.signInHint}>Suivre des artistes, envoyer un projet</TText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: Layout.sidebar,
    backgroundColor: Colors.inkPanel,
    ...(Platform.OS === 'web' ? ({ position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 40 } as object) : null),
  },
  scroll: { flexGrow: 1, paddingTop: 28, paddingHorizontal: 18, paddingBottom: 18 },
  head: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 22 },
  edition: { color: Colors.onInkMuted, letterSpacing: 1.3, fontSize: 9, marginTop: 6 },
  groupTitle: { color: Colors.onInkFaint, letterSpacing: 1.6, fontSize: 9, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 6 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 40,
    paddingHorizontal: 14,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '180ms' } as object)
      : null),
  },
  linkActive: { backgroundColor: Colors.inkRaised },
  linkFocused: { backgroundColor: Colors.inkRaised },
  marker: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: Colors.flame },
  linkLabel: { flex: 1, fontSize: 12.5, letterSpacing: 0.15 },
  badge: { color: Colors.flameOnInk, letterSpacing: 0.4 },
  foot: { marginTop: 'auto', paddingTop: 22 },
  footText: { color: Colors.onInkFaint, letterSpacing: 0, lineHeight: 17, borderTopWidth: 1, borderTopColor: Colors.onInkLine, paddingTop: 16, paddingHorizontal: 10 },
  signIn: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#574032',
    backgroundColor: '#2A241F',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '180ms' } as object) : null),
  },
  signInHover: { backgroundColor: Colors.flame, borderColor: Colors.flame },
  signInHint: { color: Colors.onInkMuted, letterSpacing: 0, marginTop: 3 },
});
