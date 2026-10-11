import React, { useEffect, useMemo } from 'react';
import {
  FlatList, StyleSheet, View, Pressable, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNotificationStore, AppNotification } from '@/store/notification-store';
import { useAuthStore } from '@/store/auth-store';

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

// ─── Notification type config ─────────────────────────────────────────────────
type NotifType =
  | 'new_request'
  | 'message'
  | 'accepted'
  | 'declined'
  | 'appointment'
  | 'like'
  | 'system';

const NOTIF_CONFIG: Record<NotifType, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  new_request: { icon: 'document-text-outline', color: Colors.accentWarm, label: 'Demande' },
  message:     { icon: 'chatbubble-outline', color: Colors.textPrimary, label: 'Message' },
  accepted:    { icon: 'checkmark', color: Colors.success, label: 'Acceptée' },
  declined:    { icon: 'close', color: Colors.error, label: 'Refusée' },
  appointment: { icon: 'calendar-outline', color: Colors.accentWarm, label: 'Rendez-vous' },
  like:        { icon: 'heart-outline', color: Colors.accentGlow, label: 'J’aime' },
  system:      { icon: 'information-outline', color: Colors.textSecondary, label: 'Information' },
};

function resolveNotifType(n: AppNotification): NotifType {
  const t = n.type ?? '';
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

/** Mirrors the routing in handleNotifPress, only to decide whether to show a chevron. */
function isNavigable(n: AppNotification) {
  const data = n.data as { request_id?: unknown; appointment_id?: unknown } | null;
  return !!(data?.request_id || data?.appointment_id);
}

// ─── Notification item ────────────────────────────────────────────────────────
function NotifItem({
  item,
  index,
  onPress,
}: {
  item: AppNotification;
  index: number;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const conf = NOTIF_CONFIG[resolveNotifType(item)];
  const unread = !item.isRead;
  const navigable = isNavigable(item);

  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View entering={reduced || index > 9 ? undefined : FadeInDown.delay(index * 40).duration(500).easing(EASE)}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${unread ? 'Non lue. ' : ''}${conf.label}. ${item.title}. ${item.body ?? ''}`}
        style={(state) => {
          const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
          return [styles.item, (pressed || hovered) && styles.itemPressed];
        }}
      >
        <View style={[styles.icon, unread && styles.iconUnread]}>
          <Ionicons name={conf.icon} size={17} color={conf.color} />
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <TText
              variant="bodySmall"
              weight={unread ? 'semibold' : 'medium'}
              color={unread ? 'primary' : 'secondary'}
              style={{ flex: 1 }}
              numberOfLines={2}
            >
              {item.title}
            </TText>
            <TText variant="caption" color="tertiary" tabular>
              {format(new Date(item.createdAt), 'HH:mm', { locale: fr })}
            </TText>
          </View>
          {!!item.body && (
            <TText variant="caption" color="tertiary" numberOfLines={2} style={styles.body}>
              {item.body}
            </TText>
          )}
        </View>

        <View style={styles.trailing}>
          {unread && <View style={styles.unreadDot} />}
          {navigable && <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />}
        </View>
      </Pressable>
    </Animated.View>
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
  const reduced = useReducedMotion();
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
    const data = notif.data as any;
    const t = notif.type ?? '';
    if (t === 'new_message' && data?.request_id) {
      router.push(`/conversation/${data.request_id}`);
    } else if (data?.request_id) {
      router.push(`/request/${data.request_id}`);
    } else if (data?.appointment_id) {
      router.push(`/appointment/${data.appointment_id}`);
    }
  };

  const handleMarkAll = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(600).easing(EASE)} style={styles.masthead}>
      <TText variant="displayM" accessibilityRole="header">
        Vos <TText variant="displayM" italic color="accentGlow">notifications</TText>
      </TText>
      <View style={styles.summaryRow}>
        <TText variant="bodySmall" color="tertiary" tabular accessibilityLiveRegion="polite" style={{ flex: 1 }}>
          {unreadCount > 0
            ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
            : notifications.length > 0 ? 'Tout est lu' : 'Demandes, messages et rendez-vous'}
        </TText>
        {unreadCount > 0 && (
          <Pressable
            onPress={handleMarkAll}
            accessibilityRole="button"
            accessibilityLabel="Tout marquer comme lu"
            hitSlop={8}
            style={({ pressed }) => [styles.markAll, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="checkmark-done-outline" size={16} color={Colors.textSecondary} />
            <TText variant="caption" weight="medium" color="secondary">Tout marquer comme lu</TText>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <THeader showBack />
      <FlatList
        data={grouped}
        keyExtractor={([key]) => key}
        renderItem={({ item: [groupDate, items], index: gIndex }) => (
          <View>
            <View style={styles.groupHeader}>
              <TText variant="label" color="tertiary" uppercase>{groupDate}</TText>
            </View>
            {items.map((notif, i) => (
              <NotifItem
                key={notif.id}
                item={notif}
                index={gIndex === 0 ? i : 99}
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
              title="Rien de nouveau"
              description="Les réponses des artistes, vos messages et vos rendez-vous apparaîtront ici."
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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  itemPressed: { backgroundColor: Colors.glassBg },
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
