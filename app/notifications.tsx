import React, { useEffect } from 'react';
import {
  FlatList, StyleSheet, View, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn, FadeInDown,
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { EmptyState } from '@/components/ui/EmptyState';
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
  | 'system';

const NOTIF_CONFIG: Record<NotifType, { icon: string; color: string; bg: string; border: string }> = {
  new_request: {
    icon: 'document-text',
    color: Colors.infoLight,
    bg: Colors.glassViolet,
    border: Colors.borderViolet,
  },
  message: {
    icon: 'chatbubble',
    color: Colors.accentWarm,
    bg: Colors.glassAmber,
    border: Colors.borderGlow,
  },
  accepted: {
    icon: 'checkmark-circle',
    color: Colors.successLight,
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(52,211,153,0.25)',
  },
  declined: {
    icon: 'close-circle',
    color: Colors.errorLight,
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.25)',
  },
  appointment: {
    icon: 'calendar',
    color: Colors.violetLight,
    bg: Colors.glassViolet,
    border: Colors.borderViolet,
  },
  like: {
    icon: 'heart',
    color: '#F87171',
    bg: 'rgba(248,113,113,0.10)',
    border: 'rgba(248,113,113,0.25)',
  },
  system: {
    icon: 'information-circle',
    color: Colors.textSecondary,
    bg: Colors.bgSurface,
    border: Colors.borderDefault,
  },
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
  if (isToday(date)) return "Aujourd'hui";
  if (isYesterday(date)) return 'Hier';
  return format(date, 'EEEE d MMMM', { locale: fr });
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
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const notifType = resolveNotifType(item);
  const conf = NOTIF_CONFIG[notifType];

  const handlePress = () => {
    scale.value = withSpring(0.97, { damping: 15 }, () => {
      scale.value = withSpring(1, { damping: 14 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 45).springify()} style={animStyle}>
      <TouchableOpacity
        style={[styles.notifItem, !item.isRead && styles.notifItemUnread]}
        onPress={handlePress}
        activeOpacity={1}
      >
        {/* Unread accent bar */}
        {!item.isRead && <View style={styles.unreadBar} />}

        {/* Icon */}
        <View style={[styles.notifIcon, { backgroundColor: conf.bg, borderColor: conf.border }]}>
          <Ionicons name={conf.icon as any} size={18} color={conf.color} />
        </View>

        {/* Content */}
        <View style={styles.notifContent}>
          <TText
            variant="bodySmall"
            weight={item.isRead ? 'regular' : 'semibold'}
            style={{ lineHeight: 20 }}
          >
            {item.title}
          </TText>
          <TText
            variant="caption"
            color="tertiary"
            numberOfLines={2}
            style={{ marginTop: 2, lineHeight: 17 }}
          >
            {item.body}
          </TText>
          <TText variant="micro" color="tertiary" style={{ marginTop: 5 }}>
            {format(new Date(item.createdAt), 'HH:mm', { locale: fr })}
          </TText>
        </View>

        <Ionicons
          name="chevron-forward"
          size={14}
          color={Colors.textTertiary}
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>
    </Animated.View>
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
  }, [user?.id]);

  // Group by date label
  const grouped = React.useMemo(() => {
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(350)} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title1" weight="bold" style={{ letterSpacing: -0.5 }}>
          Notifications
        </TText>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (user?.id) markAllRead(user.id);
            }}
          >
            <TText variant="caption" style={{ color: Colors.accentWarm }}>Tout lire</TText>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={styles.headerSpacer} />}
      </Animated.View>

      {/* ── Unread summary pill ── */}
      {unreadCount > 0 && (
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.unreadSummary}>
          <LinearGradient
            colors={['rgba(212,168,100,0.12)', 'rgba(212,168,100,0.03)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.unreadDot} />
          <TText variant="caption" style={{ color: Colors.accentWarm, fontWeight: '600' }}>
            {unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}
          </TText>
        </Animated.View>
      )}

      {/* ── List ── */}
      <FlatList
        data={grouped}
        keyExtractor={([key]) => key}
        renderItem={({ item: [groupDate, items], index: gIndex }) => (
          <Animated.View entering={FadeInDown.delay(gIndex * 55).springify()}>
            {/* Date group header */}
            <View style={styles.groupHeader}>
              <TText variant="label" color="tertiary" uppercase style={{ letterSpacing: 1.5 }}>
                {groupDate}
              </TText>
              <View style={styles.groupLine} />
            </View>
            {/* Items in this group */}
            {items.map((notif, i) => (
              <NotifItem
                key={notif.id}
                item={notif}
                index={i}
                onPress={() => handleNotifPress(notif)}
              />
            ))}
          </Animated.View>
        )}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => { if (user?.id) fetch(user.id); }}
            tintColor={Colors.accentWarm}
            colors={[Colors.accentWarm]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="Aucune notification"
            description="Tes notifications apparaîtront ici."
            style={{ marginTop: 80 }}
          />
        }
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xs'],
    paddingBottom: Spacing['2xs'],
    paddingTop: Spacing['2xs'],
    gap: Spacing['2xs'],
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    flex: 1,
  },
  markAllBtn: {
    marginLeft: 'auto',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    backgroundColor: Colors.glassAmber,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },

  // Unread summary
  unreadSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentGlow,
  },

  // List
  list: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
  },

  // Group header
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing['2xs'],
    marginTop: Spacing.sm,
  },
  groupLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSubtle,
  },

  // Notification item
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing['2xs'],
    borderRadius: Radius.lg,
    marginBottom: 4,
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSubtle,
    position: 'relative',
    overflow: 'hidden',
  },
  notifItemUnread: {
    borderColor: Colors.borderDefault,
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.accentWarm,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
  },
});
