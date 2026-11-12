import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Masthead, Rule } from '@/components/v5';
import { INQUIRY_LABEL, RequestStatusLine } from '@/components/RequestCard';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { useRequestStore, type TattooRequest } from '@/store/request-store';
import { useContentDimensions, useShell } from '@/hooks/useContentDimensions';

// A request becomes a conversation once the artist has accepted it; a question
// (written without a project) is a conversation from its first message.
const CHAT_STATUSES = new Set(['accepted', 'confirmed', 'completed']);
const CLOSED_STATUSES = new Set(['declined', 'archived']);
const isConversation = (r: TattooRequest) =>
  r.isInquiry ? !CLOSED_STATUSES.has(r.status) : CHAT_STATUSES.has(r.status);

interface LastMessage { content: string; createdAt: string; mine: boolean; type: string }

const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

/** The thread column never stretches across a wide page. */
const LIST_MAX = 760;

type Hover = { pressed: boolean; hovered?: boolean };
const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '180ms' } as object)
  : null;

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
  const { gutter } = useContentDimensions();
  const { hasSidebar } = useShell();
  const { user } = useAuthStore();
  const { requests, fetchRequests } = useRequestStore();
  const [last, setLast] = useState<Record<string, LastMessage>>({});
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isArtist = user?.role === 'artist';

  const conversations = useMemo(() => requests.filter(isConversation), [requests]);
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
      <Pressable
        onPress={() => router.push(`/conversation/${item.id}`)}
        accessibilityRole="link"
        accessibilityLabel={`Conversation avec ${name}`}
        style={(state) => [styles.row, webPointer, ((state as Hover).hovered || state.pressed) && styles.rowActive]}
      >
        {(state) => {
          const lit = (state as Hover).hovered || state.pressed;
          return (
            <>
              <TAvatar uri={avatar} name={name} size="lg" />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <TText variant="bodySmall" weight="semibold" numberOfLines={1} style={[styles.name, lit && { color: Colors.flameText }]}>
                    {name}
                  </TText>
                  {!!m && <TText variant="caption" color="tertiary" tabular>{when(m.createdAt)}</TText>}
                </View>
                <TText variant="bodySmall" color={m && !m.mine ? 'primary' : 'secondary'} numberOfLines={1}>
                  {preview(m, isArtist)}
                </TText>
                <View style={styles.rowMeta}>
                  {item.isInquiry ? (
                    <TText variant="micro" weight="bold" uppercase color="accentWarm" style={{ letterSpacing: 0.6 }}>{INQUIRY_LABEL}</TText>
                  ) : (
                    <>
                      <RequestStatusLine status={item.status} viewAs={isArtist ? 'artist' : 'client'} />
                      {!!item.bodyZone && (
                        <TText variant="caption" color="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>· {item.bodyZone}</TText>
                      )}
                    </>
                  )}
                </View>
              </View>
              <Ionicons name="arrow-forward" size={15} color={lit ? Colors.flameText : Colors.textTertiary} />
            </>
          );
        }}
      </Pressable>
    );
  };

  const count = loaded ? `${conversations.length} conversation${conversations.length > 1 ? 's' : ''}` : 'Chargement…';

  const header = (
    <View>
      <Masthead
        kicker="Correspondance"
        title="Vos"
        emphasis="messages."
        description="Un fil par projet : chaque échange reste relié à sa demande et à ses rendez-vous."
        style={styles.masthead}
      />
      <View style={styles.column}>
        <TText variant="label" weight="bold" uppercase tabular color="tertiary" style={styles.count}>{count}</TText>
        <Rule tone="ink" />
      </View>
    </View>
  );

  const contentStyle = [
    styles.list,
    { paddingHorizontal: gutter, paddingBottom: insets.bottom + (hasSidebar ? Spacing['2xl'] : 110) },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {!loaded ? (
        <View style={contentStyle}>
          {header}
          <View style={styles.column} accessibilityLabel="Chargement des conversations">
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.row}>
                <TSkeleton width={48} height={48} />
                <View style={{ flex: 1, gap: 8 }}>
                  <TSkeleton width="40%" height={14} />
                  <TSkeleton width="75%" height={12} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          contentContainerStyle={[contentStyle, sorted.length === 0 && { flexGrow: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentWarm} />}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="Aucune conversation"
              description={isArtist
                ? 'Acceptez une demande, ou répondez à une question : la conversation avec le client s’ouvrira ici.'
                : 'Quand un artiste accepte votre demande, ou quand vous lui posez une question, vous échangez avec lui ici.'}
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
  list: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },
  masthead: { marginBottom: Spacing.lg },
  column: { width: '100%', maxWidth: LIST_MAX },
  count: { marginBottom: Spacing.xs },
  // Rows sit in a reading column under the full-width masthead.
  row: {
    width: '100%', maxWidth: LIST_MAX,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: Spacing['2xs'],
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  rowActive: { backgroundColor: Colors.wash },
  rowBody: { flex: 1, gap: 3, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1, fontSize: 15 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
});
