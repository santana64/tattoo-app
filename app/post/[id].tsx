import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView, Dimensions,
  Share, ActionSheetIOS, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring, FadeIn, FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { useFeedStore } from '@/store/feed-store';
import { useAuthStore } from '@/store/auth-store';
import { supabase, type Tables } from '@/lib/supabase';
import { fetchArtist, isUuid } from '@/lib/catalog';
import type { Artist } from '@/constants/mock-data';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';

const { width: SCREEN_W } = Dimensions.get('window');
const STATUS_CONFIG = {
  open:   { dot: '#34D399', label: 'Disponible' },
  paused: { dot: '#FBBF24', label: 'En pause' },
  closed: { dot: '#F87171', label: 'Fermé' },
};

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [resource, setResource] = useState<{ post: Tables<'posts'>; artist: Artist | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
  useEffect(() => {
    let active = true;
    setResource(null); setLoading(true); setError(false);
    async function load() {
      try {
        if (!isUuid(id)) return;
        const { data, error: failure } = await supabase.from('posts').select('*').eq('id', id).eq('is_published', true).maybeSingle();
        if (failure) throw failure;
        if (!data) return;
        const artist = await fetchArtist(data.artist_id);
        if (active) setResource({ post: data, artist });
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id, attempt]);
  if (loading) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={Colors.accentWarm} accessibilityLabel="Chargement de la publication" /></View>;
  if (!resource) return <View style={styles.container}><EmptyState title={error ? 'Publication inaccessible' : 'Publication introuvable'} description={error ? 'La connexion a échoué. Tu peux réessayer.' : 'Cette publication a été retirée ou ce lien est invalide.'} ctaLabel={error ? 'Réessayer' : 'Explorer'} onCta={() => error ? setAttempt((n) => n + 1) : router.replace('/(tabs)/explore')} /></View>;
  return <PostContent key={id} row={resource.post} artist={resource.artist} />;
}

function PostContent({ row, artist }: { row: Tables<'posts'>; artist: Artist | null }) {
  const id = row.id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [isLiked, setLiked] = useState(false);
  const [isSaved, setSaved] = useState(false);
  const [likes, setLikes] = useState(row.likes_count ?? 0);
  const [busy, setBusy] = useState(false);
  const [membershipReady, setMembershipReady] = useState(false);
  const post = { id, mediaUrl: row.media_url, caption: row.caption, styles: row.styles ?? [], likes };
  const status = artist ? STATUS_CONFIG[artist.bookingStatus] : null;
  useEffect(() => {
    let active = true;
    setMembershipReady(false); setLiked(false); setSaved(false);
    if (!user?.id) return;
    Promise.all([
      supabase.from('post_likes').select('post_id').eq('post_id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('saved_posts').select('post_id').eq('post_id', id).eq('user_id', user.id).maybeSingle(),
    ]).then(([like, save]) => {
      if (!active) return;
      if (like.error || save.error) { Toast.error('Impossible de charger tes favoris.'); return; }
      setLiked(!!like.data); setSaved(!!save.data); setMembershipReady(true);
    }).catch(() => { if (active) Toast.error('Impossible de charger tes favoris.'); });
    return () => { active = false; };
  }, [id, user?.id]);

  const heartScale = useSharedValue(1);
  const saveScale = useSharedValue(1);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));
  const saveStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));

  const mutate = async (kind: 'like' | 'save') => {
    if (!user?.id) { router.push('/(auth)/sign-in'); return; }
    if (busy || !membershipReady) return;
    setBusy(true);
    const current = kind === 'like' ? isLiked : isSaved;
    const table = kind === 'like' ? 'post_likes' : 'saved_posts';
    try {
      const { error } = current
        ? await supabase.from(table).delete().eq('post_id', id).eq('user_id', user.id)
        : await supabase.from(table).insert({ post_id: id, user_id: user.id });
      if (error) throw error;
      if (kind === 'like') { setLiked(!current); setLikes((n) => Math.max(0, n + (current ? -1 : 1))); }
      else setSaved(!current);
      useFeedStore.setState((state) => {
        const membership = new Set(kind === 'like' ? state.likedPostIds : state.savedPostIds);
        if (current) membership.delete(id); else membership.add(id);
        return {
          ...(kind === 'like' ? { likedPostIds: membership } : { savedPostIds: membership }),
          posts: state.posts.map((p) => p.id !== id ? p : kind === 'like'
            ? { ...p, isLiked: !current, likesCount: Math.max(0, likes + (current ? -1 : 1)) }
            : { ...p, isSaved: !current }),
        };
      });
    } catch { Toast.error('Modification non enregistrée. Réessaie.'); }
    finally { setBusy(false); }
  };
  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    heartScale.value = withSequence(withSpring(1.5, { damping: 3 }), withSpring(1, { damping: 6 }));
    void mutate('like');
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveScale.value = withSequence(withSpring(1.4, { damping: 4 }), withSpring(1, { damping: 6 }));
    void mutate('save');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Découvre ce tatouage sur INKR : ${post.caption ?? ''}${Platform.OS === 'web' ? ` ${window.location.origin}/post/${id}` : ''}`,
      });
    } catch {}
  };

  const handleReport = () => {
    if (!user?.id) { router.push('/(auth)/sign-in'); return; }
    Alert.alert(
      'Signaler ce contenu',
      'Pourquoi tu veux signaler ce post ?',
      [
        { text: 'Spam', onPress: () => submitReport('spam') },
        { text: 'Contenu inapproprié', onPress: () => submitReport('inappropriate') },
        { text: 'Faux contenu', onPress: () => submitReport('fake') },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const submitReport = async (reason: 'spam' | 'inappropriate' | 'fake') => {
    if (!user?.id) return;
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_type: 'post',
        target_id: id,
        reason,
      });
      if (error) throw error;
      Toast.success('Signalement envoyé. Merci.');
    } catch {
      Toast.error('Le signalement n’a pas été envoyé. Réessaie.');
    }
  };

  const handleOptions = () => {
    const options = ['Partager', 'Signaler', 'Annuler'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, destructiveButtonIndex: 1 },
        (idx) => {
          if (idx === 0) handleShare();
          if (idx === 1) handleReport();
        }
      );
    } else {
      Alert.alert('Options', '', [
        { text: 'Partager', onPress: handleShare },
        { text: 'Signaler', onPress: handleReport, style: 'destructive' },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Floating header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="semibold">Post</TText>
        <TouchableOpacity style={styles.headerBtn} onPress={handleOptions}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}>
        {/* Full image */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.imageWrap}>
          <Image
            source={{ uri: post.mediaUrl }}
            style={[styles.image, { height: SCREEN_W * 1.25 }]}
            contentFit="cover"
          />
          <LinearGradient
            colors={['rgba(5,5,8,0.5)', 'transparent', 'rgba(5,5,8,0.7)']}
            locations={[0, 0.3, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Actions bar */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.actionsBar}>
          {/* Like */}
          <TouchableOpacity onPress={handleLike} style={styles.actionItem}>
            <Animated.View style={heartStyle}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={26}
                color={isLiked ? '#F87171' : Colors.textSecondary}
              />
            </Animated.View>
            <TText variant="caption" color="secondary" style={{ marginLeft: 5 }}>
              {post.likes}
            </TText>
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity onPress={handleSave} style={styles.actionItem}>
            <Animated.View style={saveStyle}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={isSaved ? Colors.accentWarm : Colors.textSecondary}
              />
            </Animated.View>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity onPress={handleShare} style={styles.actionItem}>
            <Ionicons name="arrow-redo-outline" size={23} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          {/* Report */}
          <TouchableOpacity style={styles.actionItem} onPress={handleReport}>
            <Ionicons name="flag-outline" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Caption */}
        {post.caption ? (
          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.captionWrap}>
            <TText variant="body" color="secondary" style={{ lineHeight: 24 }}>{post.caption}</TText>
          </Animated.View>
        ) : null}

        {/* Style tags */}
        {post.styles.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.tagsRow}>
            {post.styles.map((s) => (
              <View key={s} style={styles.styleTag}>
                <TText variant="micro" color="secondary" uppercase>{s}</TText>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Artist card */}
        {artist && (
          <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.artistSection}>
            <GlassCard variant="elevated" style={styles.artistCard}>
              <TouchableOpacity
                onPress={() => router.push(`/artist/${artist.id}`)}
                activeOpacity={0.85}
                style={styles.artistInner}
              >
                <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="xl" isPremium={artist.tier === 'premium'} />
                <View style={styles.artistInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TText variant="bodySmall" weight="semibold">{artist.blaze}</TText>
                    {artist.isVerified && (
                      <Ionicons name="checkmark-circle" size={14} color={Colors.info} />
                    )}
                  </View>
                  <TText variant="caption" color="secondary">{artist.city}</TText>
                  <View style={styles.artistStatus}>
                    <View style={[styles.statusDot, { backgroundColor: status!.dot }]} />
                    <TText variant="micro" color="secondary">{status!.label}</TText>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>

              {/* Styles */}
              {artist.styles.length > 0 && (
                <View style={styles.artistStyles}>
                  {artist.styles.slice(0, 3).map((s) => (
                    <View key={s} style={styles.artistStyleTag}>
                      <TText variant="micro" color="secondary" uppercase>{s}</TText>
                    </View>
                  ))}
                </View>
              )}
            </GlassCard>
          </Animated.View>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      {artist && artist.bookingStatus === 'open' && (
        <Animated.View
          entering={FadeInDown.delay(300).springify()}
          style={[styles.stickyBar, { paddingBottom: insets.bottom + 8 }]}
        >
          <TButton
            title={`Demander un tatoo à ${artist.blaze.split(' ')[0]}`}
            variant="primary"
            onPress={() => router.push({ pathname: '/request/new', params: { artistId: artist.id } })}
          />
        </Animated.View>
      )}
      {artist && artist.bookingStatus !== 'open' && (
        <Animated.View
          entering={FadeInDown.delay(300).springify()}
          style={[styles.stickyBar, { paddingBottom: insets.bottom + 8 }]}
        >
          <TButton
            title={`Voir le profil de ${artist.blaze.split(' ')[0]}`}
            variant="glass"
            onPress={() => router.push(`/artist/${artist.id}`)}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'], height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  imageWrap: { overflow: 'hidden' },
  image: { width: SCREEN_W, backgroundColor: Colors.bgSurface },
  actionsBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  captionWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  styleTag: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderSubtle,
  },
  artistSection: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },
  artistCard: { padding: Spacing.sm },
  artistInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  artistInfo: { flex: 1, gap: 2 },
  artistStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  artistStyles: { flexDirection: 'row', gap: 6, marginTop: Spacing.xs, paddingTop: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderSubtle },
  artistStyleTag: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  stickyBar: {
    paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm,
    backgroundColor: 'rgba(5,5,8,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderSubtle,
  },
});
