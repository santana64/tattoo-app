import React, { useEffect, useMemo } from 'react';
import {
  FlatList, StyleSheet, View, RefreshControl, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns/format';
import { isToday } from 'date-fns/isToday';
import { isYesterday } from 'date-fns/isYesterday';
import { fr } from 'date-fns/locale/fr';
import { Colors, Spacing, Layout, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { TButton } from '@/components/ui/TButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { Kicker, Masthead, Rule } from '@/components/v5';
import { useContentDimensions } from '@/hooks/useContentDimensions';
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
  | 'appointment_reminder'
  | 'appointment_reschedule'
  | 'appointment_canceled'
  | 'healed_photo'
  | 'healed_photo_reminder'
  | 'system';

const NOTIF_CONFIG: Record<NotifType, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  new_request:   { icon: 'document-text-outline', color: Colors.flameText, label: 'Demande' },
  message:       { icon: 'chatbubble-outline', color: Colors.ink, label: 'Message' },
  accepted:      { icon: 'checkmark', color: Colors.success, label: 'Acceptée' },
  declined:      { icon: 'close', color: Colors.error, label: 'Refusée' },
  appointment:   { icon: 'calendar-outline', color: Colors.flameText, label: 'Rendez-vous' },
  like:          { icon: 'heart-outline', color: Colors.flameText, label: 'J’aime' },
  new_post:      { icon: 'image-outline', color: Colors.flameText, label: 'Nouvelle pièce' },
  new_follower:  { icon: 'person-add-outline', color: Colors.flameText, label: 'Nouvel abonné' },
  book_reopened: { icon: 'calendar-outline', color: Colors.success, label: 'Réouverture' },
  appointment_reminder:   { icon: 'alarm-outline', color: Colors.flameText, label: 'Rappel' },
  appointment_reschedule: { icon: 'swap-horizontal-outline', color: Colors.warning, label: 'Report demandé' },
  appointment_canceled:   { icon: 'calendar-clear-outline', color: Colors.error, label: 'Annulation' },
  healed_photo:           { icon: 'sparkles-outline', color: Colors.flameText, label: 'Photo cicatrisée' },
  healed_photo_reminder:  { icon: 'camera-outline', color: Colors.flameText, label: 'Photo cicatrisée' },
  system:        { icon: 'information-outline', color: Colors.textSecondary, label: 'Information' },
};

/**
 * Written by the database (migrations 011, 012) as a name in `title` and a sentence that
 * starts with a verb in `body`: "Léa Ink" + "a publié une nouvelle pièce."
 */
const SENTENCE_TYPES: ReadonlySet<NotifType> = new Set(['new_post', 'new_follower', 'book_reopened', 'healed_photo']);

/** Types matched by their exact name: none of them may fall into the substring matches below. */
const EXACT_TYPES: ReadonlySet<NotifType> = new Set([
  'new_post', 'new_follower', 'book_reopened',
  'appointment_reminder', 'appointment_reschedule', 'appointment_canceled',
  'healed_photo', 'healed_photo_reminder',
]);

/** Booking-care types that always lead to the session page. */
const APPOINTMENT_TYPES: ReadonlySet<NotifType> = new Set([
  'appointment_reminder', 'appointment_canceled', 'healed_photo', 'healed_photo_reminder',
]);

function resolveNotifType(n: AppNotification): NotifType {
  const t = n.type ?? '';
  if (EXACT_TYPES.has(t as NotifType)) return t as NotifType;
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
  if (APPOINTMENT_TYPES.has(type)) {
    const appointmentId = idOf(data?.appointment_id);
    return appointmentId ? `/appointment/${appointmentId}` : null;
  }
  if (type === 'appointment_reschedule') {
    // The new slots the client suggests are answered from the request.
    const requestId = idOf(data?.request_id);
    if (requestId) return `/request/${requestId}`;
    const appointmentId = idOf(data?.appointment_id);
    return appointmentId ? `/appointment/${appointmentId}` : null;
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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sentence
        ? `${unread ? 'Non lue. ' : ''}${conf.label}. ${item.title} ${item.body}`
        : `${unread ? 'Non lue. ' : ''}${conf.label}. ${item.title}. ${item.body ?? ''}`}
      style={(state) => [styles.item, ((state as { hovered?: boolean }).hovered || state.pressed) && styles.itemActive]}
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
        {navigable && <Ionicons name="arrow-forward" size={14} color={Colors.textTertiary} />}
      </View>
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <View accessibilityLabel="Chargement des notifications">
      <TSkeleton width={80} height={11} style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <TSkeleton width={40} height={40} />
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
  const { gutter } = useContentDimensions();
  const { user } = useAuthStore();
  const { notifications, isLoading, error, fetch, markRead, markAllRead, subscribe, unsubscribe } =
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
    void markRead(notif.id);
    const target = notifTarget(notif);
    if (target) router.push(target);
  };

  const handleMarkAll = async () => {
    if (user?.id && !await markAllRead(user.id)) {
      Toast.error('Notifications non mises à jour. Vérifiez votre connexion puis réessayez.');
    }
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
    <View>
      <Masthead
        kicker="Le signal"
        title="Les nouvelles"
        emphasis="qui comptent."
        description="Vos demandes, messages et rendez-vous, et les nouvelles des artistes que vous suivez."
        style={styles.masthead}
      />
      <View style={styles.summaryRow}>
        <TText variant="label" weight="bold" uppercase tabular color="tertiary" accessibilityLiveRegion="polite" style={{ flex: 1 }}>
          {unreadCount > 0
            ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
            : notifications.length > 0 ? 'Tout est lu' : 'Demandes, messages et rendez-vous'}
        </TText>
        {unreadCount > 0 && (
          <TButton
            title="Tout marquer comme lu"
            variant="secondary"
            size="md"
            fullWidth={false}
            onPress={handleMarkAll}
            accessibilityLabel="Tout marquer comme lu"
            icon={<Ionicons name="checkmark-done-outline" size={15} color={Colors.ink} />}
          />
        )}
      </View>
      {!!error && notifications.length > 0 && (
        <View accessibilityRole="alert" style={{ paddingVertical: Spacing.sm, gap: Spacing.xs }}>
          <TText variant="bodySmall" color="error">{error}</TText>
          <TButton title="Réessayer" variant="secondary" size="md" fullWidth={false} onPress={() => { void fetch(user.id); }} />
        </View>
      )}
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
              <Kicker>{groupDate}</Kicker>
            </View>
            <Rule tone="ink" />
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
        contentContainerStyle={[styles.frame, { paddingHorizontal: gutter, paddingBottom: insets.bottom + 40 }]}
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
          isLoading ? <ListSkeleton /> : error ? (
            <EmptyState icon="cloud-offline-outline" title="Chargement impossible" description={error}
              ctaLabel="Réessayer" onCta={() => { void fetch(user.id); }} style={styles.empty} />
          ) : (
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
  frame: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },

  masthead: { marginBottom: Spacing.sm, borderBottomWidth: 0 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, minHeight: 46, maxWidth: 820 },

  groupHeader: { paddingTop: Spacing.xl, paddingBottom: Spacing.xs, maxWidth: 820 },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    maxWidth: 820,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing['2xs'],
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '180ms' } as object)
      : null),
  },
  itemActive: { backgroundColor: Colors.wash },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.white,
  },
  iconUnread: { borderColor: Colors.ink },
  content: { flex: 1, minWidth: 0, paddingTop: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  body: { marginTop: 3 },
  trailing: { width: 14, alignSelf: 'center', alignItems: 'center', gap: 6 },
  unreadDot: { width: 6, height: 6, borderRadius: Radius.full, backgroundColor: Colors.flame },

  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: Spacing.sm },

  empty: { paddingTop: Spacing['2xl'] },
});
