import React, { useEffect } from 'react';
import { FlatList, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNotificationStore, AppNotification } from '@/store/notification-store';
import { useAuthStore } from '@/store/auth-store';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const NOTIF_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  request_received: 'document-text-outline',
  request_accepted: 'checkmark-circle-outline',
  request_declined: 'close-circle-outline',
  request_clarification: 'help-circle-outline',
  appointment_confirmed: 'calendar-outline',
  new_message: 'chatbubble-outline',
  subscription_renewed: 'card-outline',
  new_review: 'star-outline',
};

const NOTIF_COLORS: Record<string, string> = {
  request_accepted: Colors.success,
  request_declined: Colors.error,
  appointment_confirmed: Colors.accent,
  new_message: '#5B8BF5',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { notifications, fetch, markRead, markAllRead, subscribe, unsubscribe } = useNotificationStore();

  useEffect(() => {
    if (!user?.id) return;
    fetch(user.id);
    subscribe(user.id);
    return () => unsubscribe();
  }, [user?.id]);

  const handlePress = (notif: AppNotification) => {
    markRead(notif.id);
    const data = notif.data as any;
    if (notif.type === 'new_message' && data?.request_id) {
      router.push(`/conversation/${data.request_id}`);
    } else if (data?.request_id) {
      router.push(`/request/${data.request_id}`);
    } else if (data?.appointment_id) {
      router.push(`/appointment/${data.appointment_id}`);
    }
  };

  const renderItem = ({ item, index }: { item: AppNotification; index: number }) => {
    const icon = NOTIF_ICONS[item.type] ?? 'notifications-outline';
    const color = NOTIF_COLORS[item.type] ?? Colors.textSecondary;
    return (
      <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
        <TouchableOpacity
          style={[styles.item, !item.isRead && styles.itemUnread]}
          onPress={() => handlePress(item)}
          activeOpacity={0.75}
        >
          <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <View style={styles.itemContent}>
            <TText variant="bodySmall" weight={item.isRead ? 'regular' : 'semibold'}>{item.title}</TText>
            <TText variant="caption" color="secondary" style={{ marginTop: 2, lineHeight: 16 }}>{item.body}</TText>
            <TText variant="caption" color="tertiary" style={{ marginTop: 4 }}>
              {format(new Date(item.createdAt), "d MMM 'à' HH:mm", { locale: fr })}
            </TText>
          </View>
          {!item.isRead && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Notifications</TText>
        <TouchableOpacity onPress={() => user?.id && markAllRead(user.id)} style={styles.backBtn}>
          <TText variant="caption" color="accent">Tout lire</TText>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 4 }}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="Aucune notification"
            description="Tu es à jour !"
            style={{ marginTop: 80 }}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'],
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  itemUnread: { backgroundColor: 'rgba(232,224,208,0.04)' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemContent: { flex: 1 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginTop: 6,
    flexShrink: 0,
  },
});
