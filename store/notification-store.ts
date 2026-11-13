import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

let privateNotificationGeneration = 0;

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  channel: RealtimeChannel | null;

  fetch: (userId: string) => Promise<void>;
  subscribe: (userId: string) => void;
  unsubscribe: () => void;
  markRead: (id: string) => Promise<boolean>;
  markAllRead: (userId: string) => Promise<boolean>;
  resetPrivateNotifications: () => void;
}

function mapNotif(raw: any): AppNotification {
  return {
    id: raw.id,
    userId: raw.user_id,
    type: raw.type,
    title: raw.title,
    body: raw.body,
    data: raw.data,
    isRead: raw.is_read,
    createdAt: raw.created_at,
  };
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  channel: null,

  resetPrivateNotifications: () => {
    privateNotificationGeneration++;
    get().unsubscribe();
    set({ notifications: [], unreadCount: 0, isLoading: false, error: null, channel: null });
  },

  fetch: async (userId) => {
    const generation = privateNotificationGeneration;
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (generation !== privateNotificationGeneration) return;
      if (error) throw error;
      const notifications = (data ?? []).map(mapNotif);
      set({ notifications, unreadCount: notifications.filter((n) => !n.isRead).length, isLoading: false });
    } catch {
      if (generation === privateNotificationGeneration) set({ isLoading: false, error: 'Notifications indisponibles. Vérifiez votre connexion puis réessayez.' });
    }
  },

  subscribe: (userId) => {
    const generation = privateNotificationGeneration;
    get().unsubscribe();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (generation !== privateNotificationGeneration) return;
          const notif = mapNotif(payload.new);
          set((s) => ({
            notifications: [notif, ...s.notifications],
            unreadCount: s.unreadCount + 1,
          }));
        }
      )
      .subscribe();
    set({ channel });
  },

  unsubscribe: () => {
    const { channel } = get();
    if (channel) { supabase.removeChannel(channel); set({ channel: null }); }
  },

  markRead: async (id) => {
    const generation = privateNotificationGeneration;
    try {
      const { data, error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).select('id').maybeSingle();
      if (error || data?.id !== id || generation !== privateNotificationGeneration) return false;
      set((s) => ({
        notifications: s.notifications.map((n) => n.id === id ? { ...n, isRead: true } : n),
        unreadCount: Math.max(0, s.unreadCount - (s.notifications.some((n) => n.id === id && !n.isRead) ? 1 : 0)),
      }));
      return true;
    } catch { return false; }
  },

  markAllRead: async (userId) => {
    const generation = privateNotificationGeneration;
    try {
      const { data, error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false).select('id');
      if (error || generation !== privateNotificationGeneration) return false;
      const confirmedIds = new Set((data ?? []).map((row) => row.id));
      set((s) => {
        const notifications = s.notifications.map((n) => confirmedIds.has(n.id) ? { ...n, isRead: true } : n);
        return { notifications, unreadCount: notifications.filter((n) => !n.isRead).length };
      });
      return true;
    } catch { return false; }
  },
}));
