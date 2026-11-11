import React, { useEffect, useMemo } from 'react';
import {
  FlatList, StyleSheet, View, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated from 'react-native-reanimated';
import { format } from 'date-fns/format';
import { isToday } from 'date-fns/isToday';
import { isYesterday } from 'date-fns/isYesterday';
import { fr } from 'date-fns/locale/fr';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PressableScale, enterUp } from '@/components/motion';
import { useNotificationStore, AppNotification } from '@/store/notification-store';
import { useAuthStore } from '@/store/auth-store';

// ─── Notification type config ─────────────────────────────────────────────────
type NotifType =
  | 'new_request'
  | 'message'
  | 'accepted'
  | 'declined'
  | 'appointment'
  | 'like'
  | 'new_post'
  | 'new_follower'
  | 'book_reopened'
  | 'system';

const NOTIF_CONFIG: Record<NotifType, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  new_request:   { icon: 'document-text-outline', color: Colors.accentWarm, label: 'Demande' },
  message:       { icon: 'chatbubble-outline', color: Colors.textPrimary, label: 'Message' },
  accepted:      { icon: 'checkmark', color: Colors.success, label: 'Acceptée' },
  declined:      { icon: 'close', color: Colors.error, label: 'Refusée' },
  appointment:   { icon: 'calendar-outline', color: Colors.accentWarm, label: 'Rendez-vous' },
  like:          { icon: 'heart-outline', color: Colors.accentGlow, label: 'J’aime' },
  new_post:      { icon: 'image-outline', color: Colors.accentGlow, label: 'Nouvelle pièce' },
  new_follower:  { icon: 'person-add-outline', color: Colors.accentWarm, label: 'Nouvel abonné' },
  book_reopened: { icon: 'calendar-outline', color: Colors.success, label: 'Réouverture' },
  system:        { icon: 'information-outline', color: Colors.textSecondary, label: 'Information' },
};

/**
 * Written by the database (migration 011) as a name in `title` and a sentence that
 * starts with a verb in `body`: "Léa Ink" + "a publié une nouvelle pièce."
 */
const SENTENCE_TYPES: ReadonlySet<NotifType> = new Set(['new_post', 'new_follower', 'book_reopened']);

function resolveNotifType(n: AppNotification): NotifType {
  const t = n.type ?? '';
  // Exact social types first: none of them may fall into the substring matches below.
  if (t === 'new_post' || t === 'new_follower' || t === 'book_reopened') return t;
  if (t.includes('request')) return 'new_request';
  if (t.includes('message')) return 'message';
  if (t.includes('accept')) return 'accepted';
  if (t.includes('declin')) return 'declined';
  if (t.includes('appointment') || t.includes('agenda')) return 'appointment';
  if (t.includes('like')) return 'like';
  return 'system';
}

function formatGroupDate(date: Date): string {
  if (isToday(date)) return 'Aujourd’hui';
  if (isYesterday(date)) return 'Hier';
  const label = format(date, 'EEEE d MMMM', { locale: fr });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const idOf = (value: unknown) => (typeof value === 'string' && value ? value : null);

/** Where a notification leads, or null. Shared by the press handler and the chevron. */
function notifTarget(n: AppNotification): Href | null {
  const data = n.data as { request_id?: unknown; appointment_id?: unknown; post_id?: unknown; artist_id?: unknown; media_type?: unknown } | null;
  const type = resolveNotifType(n);
  if (type === 'new_post') {
    const postId = idOf(data?.post_id);
    // Videos open in the full-screen player, like everywhere else in the app.
    if (postId) return data?.media_type === 'video' ? `/reels/${postId}` : `/post/${postId}`;
    const artistId = idOf(data?.artist_id);
    return artistId ? `/artist/${artistId}` : null;
  }
  if (type === 'new_follower' || type === 'book_reopened') {
    const artistId = idOf(data?.artist_id);
    return artistId ? `/artist/${artistId}` : null;
  }
  const requestId = idOf(data?.request_id);
  if (n.type === 'new_message' && requestId) return `/conversation/${requestId}`;
  if (requestId) return `/request/${requestId}`;
  const appointmentId = idOf(data?.appointment_id);
  if (appointmentId) return `/appointment/${appointmentId}`;
  return null;
}

// ─── Notification item ────────────────────────────────────────────────────────
// Rendered inside a virtualized list: press feedback only, no entrance animation.
function NotifItem({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: () => void;
}) {
  const type = resolveNotifType(item);
  const conf = NOTIF_CONFIG[type];
  const unread = !item.isRead;
  const navigable = notifTarget(item) !== null;
  // "Léa Ink a publié une nouvelle pièce." reads as one sentence, the name set in medium.
  const sentence = SENTENCE_TYPES.has(type) && !!item.body;

  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.985}
      accessibilityRole="button"
      accessibilityLabel={sentence
        ? `${unread ? 'Non lue. ' : ''}${conf.label}. ${item.title} ${item.body}`
        : `${unread ? 'Non lue. ' : ''}${conf.label}. ${item.title}. ${item.body ?? ''}`}
      style={styles.item}
    >
      <View style={[styles.icon, unread && styles.iconUnread]}>
        <Ionicons name={conf.icon} size={17} color={conf.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          {sentence ? (
            <TText variant="bodySmall" color={unread ? 'primary' : 'secondary'} style={{ flex: 1 }} numberOfLines={3}>
              <TText variant="bodySmall" weight={unread ? 'semibold' : 'medium'} color="primary">{item.title}</TText>
              {` ${item.body}`}
            </TText>
          ) : (
            <TText
              variant="bodySmall"
              weight={unread ? 'semibold' : 'medium'}
              color={unread ? 'primary' : 'secondary'}
              style={{ flex: 1 }}
              numberOfLines={2}
            >
              {item.title}
            </TText>
          )}
          <TText variant="caption" color="tertiary" tabular>
            {format(new Date(item.createdAt), 'HH:mm', { locale: fr })}
          </TText>
        </View>
        {!!item.body && !sentence && (
          <TText variant="caption" color="tertiary" numberOfLines={2} style={styles.body}>
            {item.body}
          </TText>
        )}
      </View>

      <View style={styles.trailing}>
        {unread && <View style={styles.unreadDot} />}
        {navigable && <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />}
      </View>
    </PressableScale>
  );
}

function ListSkeleton() {
  return (
    <View accessibilityLabel="Chargement des notifications">
      <TSkeleton width={80} height={11} style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <TSkeleton width={40} height={40} radius={20} />
          <View style={{ flex: 1, gap: 8 }}>
            <TSkeleton width="65%" height={13} />
            <TSkeleton width="90%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { notifications, isLoading, fetch, markRead, markAllRead, subscribe, unsubscribe } =
    useNotificationStore();

  useEffect(() => {
    if (!user?.id) return;
    fetch(user.id);
    subscribe(user.id);
    return () => unsubscribe();
  }, [user?.id, fetch, subscribe, unsubscribe]);

  // Group by date label
  const grouped = useMemo(() => {
    const map: Map<string, AppNotification[]> = new Map();
    [...notifications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .forEach((n) => {
        const key = formatGroupDate(new Date(n.createdAt));
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(n);
      });
    return Array.from(map.entries());
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleNotifPress = (notif: AppNotification) => {
    markRead(notif.id);
    const target = notifTarget(notif);
    if (target) router.push(target);
  };

  const handleMarkAll = () => {
    if (user?.id) markAllRead(user.id);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <THeader showBack />
        <EmptyState
          icon="notifications-outline"
          title="Restez informé"
          description="Connectez-vous pour suivre vos demandes, messages et rendez-vous."
          ctaLabel="Se connecter"
          onCta={() => router.push('/(auth)/sign-in')}
        />
      </View>
    );
  }

  const header = (
    <View style={styles.masthead}>
      <Animated.View entering={enterUp(0)}>
        <TText variant="displayM" accessibilityRole="header">
          Vos <TText variant="displayM" italic color="accentGlow">notifications</TText>
        </TText>
      </Animated.View>
      <Animated.View entering={enterUp(1)} style={styles.summaryRow}>
        <TText variant="bodySmall" color="tertiary" tabular accessibilityLiveRegion="polite" style={{ flex: 1 }}>
          {unreadCount > 0
            ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
            : notifications.length > 0 ? 'Tout est lu' : 'Demandes, messages et rendez-vous'}
        </TText>
        {unreadCount > 0 && (
          <PressableScale
            onPress={handleMarkAll}
            haptic
            accessibilityRole="button"
            accessibilityLabel="Tout marquer comme lu"
            hitSlop={8}
            style={styles.markAll}
          >
            <Ionicons name="checkmark-done-outline" size={16} color={Colors.textSecondary} />
            <TText variant="caption" weight="medium" color="secondary">Tout marquer comme lu</TText>
          </PressableScale>
        )}
      </Animated.View>
    </View>
  );

  return (
    <View style={styles.container}>
      <THeader showBack />
      <FlatList
        data={grouped}
        keyExtractor={([key]) => key}
        renderItem={({ item: [groupDate, items] }) => (
          <View>
            <View style={styles.groupHeader}>
              <TText variant="label" color="tertiary" uppercase>{groupDate}</TText>
            </View>
            {items.map((notif) => (
              <NotifItem
                key={notif.id}
                item={notif}
                onPress={() => handleNotifPress(notif)}
              />
            ))}
          </View>
        )}
        style={styles.list}
        contentContainerStyle={[styles.frame, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && notifications.length > 0}
            onRefresh={() => { if (user?.id) fetch(user.id); }}
            tintColor={Colors.accentWarm}
            colors={[Colors.accentWarm]}
          />
        }
        ListEmptyComponent={
          isLoading ? <ListSkeleton /> : (
            <EmptyState
              icon="notifications-outline"
              title="Rien de nouveau pour l’instant"
              description="Les réponses des artistes, vos messages et vos rendez-vous apparaîtront ici. Commencez par trouver un artiste qui vous inspire."
              ctaLabel="Explorer les artistes"
              onCta={() => router.push('/(tabs)/explore')}
              style={styles.empty}
            />
          )
        }
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  list: { flex: 1 },
  frame: { width: '100%', maxWidth: Layout.maxReading + Layout.gutter * 2, alignSelf: 'center', paddingHorizontal: Layout.gutter },

  masthead: { paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 6, minHeight: 40 },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 },

  groupHeader: {
    paddingTop: Spacing.lg, paddingBottom: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderDefault,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  iconUnread: { borderColor: Colors.borderGlow, backgroundColor: Colors.glassAmber },
  content: { flex: 1, paddingTop: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  body: { marginTop: 3 },
  trailing: { width: 14, alignSelf: 'center', alignItems: 'center', gap: 6 },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accentWarm },

  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: Spacing.sm },

  empty: { paddingTop: Spacing['2xl'] },
});
