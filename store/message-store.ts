import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Message {
  id: string;
  requestId: string;
  senderId: string | null;
  content: string;
  messageType: 'text' | 'system' | 'slot_proposal' | 'appointment_confirmed' | 'image';
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  // Optimistic
  pending?: boolean;
  failed?: boolean;
}

interface MessageState {
  messagesByRequest: Record<string, Message[]>;
  isLoading: boolean;
  activeChannel: RealtimeChannel | null;

  fetchMessages: (requestId: string) => Promise<void>;
  subscribeToRequest: (requestId: string) => void;
  unsubscribeFromRequest: () => void;
  sendMessage: (requestId: string, senderId: string, content: string, type?: Message['messageType']) => Promise<void>;
  markAsRead: (requestId: string, userId: string) => Promise<void>;
  getUnreadCount: (userId: string) => Promise<number>;
}

function mapMessage(raw: any): Message {
  return {
    id: raw.id,
    requestId: raw.request_id,
    senderId: raw.sender_id,
    content: raw.content,
    messageType: raw.message_type,
    metadata: raw.metadata,
    isRead: raw.is_read,
    createdAt: raw.created_at,
  };
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messagesByRequest: {},
  isLoading: false,
  activeChannel: null,

  fetchMessages: async (requestId) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    if (!error) {
      set((s) => ({
        isLoading: false,
        messagesByRequest: { ...s.messagesByRequest, [requestId]: (data ?? []).map(mapMessage) },
      }));
    } else {
      set({ isLoading: false });
    }
  },

  subscribeToRequest: (requestId) => {
    // Unsubscribe from previous channel
    get().unsubscribeFromRequest();
    const channel = supabase
      .channel(`messages:${requestId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `request_id=eq.${requestId}` },
        (payload) => {
          const newMsg = mapMessage(payload.new);
          set((s) => {
            const existing = s.messagesByRequest[requestId] ?? [];
            // Deduplicate
            if (existing.some((m) => m.id === newMsg.id)) return s;
            return {
              messagesByRequest: {
                ...s.messagesByRequest,
                [requestId]: [...existing, newMsg],
              },
            };
          });
        }
      )
      .subscribe();
    set({ activeChannel: channel });
  },

  unsubscribeFromRequest: () => {
    const { activeChannel } = get();
    if (activeChannel) {
      supabase.removeChannel(activeChannel);
      set({ activeChannel: null });
    }
  },

  sendMessage: async (requestId, senderId, content, type = 'text') => {
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      requestId,
      senderId,
      content,
      messageType: type,
      metadata: null,
      isRead: false,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    // Optimistic insert
    set((s) => ({
      messagesByRequest: {
        ...s.messagesByRequest,
        [requestId]: [...(s.messagesByRequest[requestId] ?? []), optimistic],
      },
    }));
    const { data, error } = await supabase
      .from('messages')
      .insert({ request_id: requestId, sender_id: senderId, content, message_type: type })
      .select()
      .single();
    // Replace optimistic with real
    set((s) => ({
      messagesByRequest: {
        ...s.messagesByRequest,
        [requestId]: (s.messagesByRequest[requestId] ?? []).map((m) =>
          m.id === optimisticId
            ? error ? { ...m, pending: false, failed: true } : mapMessage(data)
            : m
        ),
      },
    }));
  },

  markAsRead: async (requestId, userId) => {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('request_id', requestId)
      .neq('sender_id', userId)
      .eq('is_read', false);
    set((s) => ({
      messagesByRequest: {
        ...s.messagesByRequest,
        [requestId]: (s.messagesByRequest[requestId] ?? []).map((m) => ({ ...m, isRead: true })),
      },
    }));
  },

  getUnreadCount: async (userId) => {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .neq('sender_id', userId);
    return count ?? 0;
  },
}));
