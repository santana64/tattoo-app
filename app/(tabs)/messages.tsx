import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PressableScale, enterUp } from '@/components/motion';
import { RequestStatusLine } from '@/components/RequestCard';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { useRequestStore, type TattooRequest } from '@/store/request-store';

// A request becomes a conversation once the artist has accepted it.
const CHAT_STATUSES = new Set(['accepted', 'confirmed', 'completed']);

interface LastMessage { content: string; createdAt: string; mine: boolean; type: string }

const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

function when(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString() ? timeFmt.format(d) : dayFmt.format(d).replace('.', '');
}

function preview(m: LastMessage | undefined, isArtist: boolean): string {
  if (!m) return isArtist ? 'Démarrez l’échange avec votre client.' : 'Présentez votre projet à l’artiste.';
  const body = m.type === 'image' ? 'Photo' : m.content;
  return m.mine ? `Vous : ${body}` : body;
}

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { requests, fetchRequests } = useRequestStore();
  const [last, setLast] = useState<Record<string, LastMessage>>({});
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isArtist = user?.role === 'artist';

  const conversations = useMemo(() => requests.filter((r) => CHAT_STATUSES.has(r.status)), [requests]);
  const ids = useMemo(() => conversations.map((r) => r.id).sort().join(','), [conversations]);

  const loadLastMessages = useCallback(async () => {
    const list = ids ? ids.split(',') : [];
    if (!list.length || !user?.id) { setLast({}); return; }
    const { data } = await supabase
      .from('messages')
      .select('request_id, content, created_at, sender_id, message_type')
      .in('request_id', list)
      .order('created_at', { ascending: false })
      .limit(list.length * 20);
    const map: Record<string, LastMessage> = {};
    for (const m of data ?? []) {
      if (map[m.request_id] || !m.created_at) continue;
      map[m.request_id] = { content: m.content, createdAt: m.created_at, mine: m.sender_id === user.id, type: m.message_type };
    }
    setLast(map);
  }, [ids, user?.id]);

  const loadAll = useCallback(async (silent: boolean) => {
    if (!user?.id) return;
    await fetchRequests(user.id, user.role, { silent });
    setLoaded(true);
  }, [user?.id, user?.role, fetchRequests]);

  useFocusEffect(useCallback(() => { void loadAll(loaded); }, [loadAll, loaded]));
  useEffect(() => { void loadLastMessages(); }, [loadLastMessages]);

  // New messages in any of these conversations bump the list live.
  useEffect(() => {
    if (!ids) return;
    const channel = supabase
      .channel(`inbox-messages:${user?.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `request_id=in.(${ids})` }, () => {
        void loadLastMessages();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [ids, user?.id, loadLastMessages]);

  const sorted = useMemo(() => [...conversations].sort((a, b) => {
    const ta = last[a.id]?.createdAt ?? a.acceptedAt ?? a.submittedAt;
    const tb = last[b.id]?.createdAt ?? b.acceptedAt ?? b.submittedAt;
    return tb.localeCompare(ta);
  }), [conversations, last]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll(true);
    await loadLastMessages();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: TattooRequest }) => {
    const name = (isArtist ? item.clientName : item.artistName) || (isArtist ? 'Client' : 'Artiste');
    const avatar = isArtist ? item.clientAvatarUrl : item.artistAvatarUrl;
    const m = last[item.id];
    return (
      <PressableScale
        onPress={() => router.push(`/conversation/${item.id}`)}
        accessibilityRole="link"
        accessibilityLabel={`Conversation avec ${name}`}
        style={styles.row}
      >
        <TAvatar uri={avatar} name={name} size="lg" />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <TText variant="title2" serif numberOfLines={1} style={styles.name}>{name}</TText>
            {!!m && <TText variant="caption" color="tertiary" tabular>{when(m.createdAt)}</TText>}
          </View>
          <TText variant="bodySmall" color={m && !m.mine ? 'primary' : 'secondary'} numberOfLines={1}>
            {preview(m, isArtist)}
          </TText>
          <View style={styles.rowMeta}>
            <RequestStatusLine status={item.status} viewAs={isArtist ? 'artist' : 'client'} />
            <TText variant="caption" color="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>· {item.bodyZone}</TText>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </PressableScale>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.frame}>
        <Animated.View entering={enterUp(0)} style={styles.header}>
          <TText variant="displayM" accessibilityRole="header">
            Vos <TText variant="displayM" italic color="accentGlow">messages</TText>
          </TText>
          <TText variant="bodySmall" color="tertiary" tabular style={{ marginTop: 4 }}>
            {loaded ? `${conversations.length} conversation${conversations.length > 1 ? 's' : ''}` : 'Chargement…'}
          </TText>
        </Animated.View>
      </View>

      {!loaded ? (
        <View style={[styles.frame, styles.list]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.row}>
              <TSkeleton width={48} height={48} radius={24} />
              <View style={{ flex: 1, gap: 8 }}>
                <TSkeleton width="40%" height={16} />
                <TSkeleton width="75%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.frame, styles.list, { paddingBottom: insets.bottom + 110 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentWarm} />}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="Aucune conversation"
              description={isArtist
                ? 'Acceptez une demande : la conversation avec le client s’ouvrira ici.'
                : 'Quand un artiste accepte votre demande, vous échangez avec lui ici.'}
              ctaLabel={isArtist ? 'Voir les demandes' : 'Explorer les artistes'}
              onCta={() => router.push(isArtist ? '/(tabs)/inbox' : '/(tabs)/explore')}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  frame: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { paddingHorizontal: Layout.gutter, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  list: { paddingHorizontal: Layout.gutter },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderDefault,
  },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1, fontSize: 20 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
});
