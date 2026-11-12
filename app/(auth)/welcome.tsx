import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Layout, Duration, Gradients, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { Logo } from '@/components/ui/Logo';
import { EditorialTitle, Kicker, TextLink } from '@/components/v5';
import { RevealImage } from '@/components/motion';
import { STYLES } from '@/constants/tattoo';
import { useFeedStore, type FeedPost } from '@/store/feed-store';

// Slugs from the shared STYLES taxonomy.
const QUICK_STYLES = STYLES.filter((s) => ['fine-line', 'blackwork', 'realisme', 'japonais', 'old-school', 'neo-trad'].includes(s.slug));
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

type Hover = { pressed: boolean; hovered?: boolean };
const webPointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

function enter(delay: number, reduced: boolean) {
  return reduced ? undefined : FadeInDown.delay(delay).duration(Duration.reveal).easing(EASE);
}

/** Filter pill on the ink ground: paper hairline, paper fill on hover. */
function InkPill({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={(state) => {
        const { hovered, pressed } = state as Hover;
        return [styles.pill, webPointer, (hovered || pressed) && styles.pillLit];
      }}
    >
      {(state) => {
        const { hovered, pressed } = state as Hover;
        return (
          <TText variant="caption" weight="semibold" style={{ fontSize: 12.5, lineHeight: 16, color: hovered || pressed ? Colors.ink : Colors.onInk }}>
            {label}
          </TText>
        );
      }}
    </Pressable>
  );
}

/** Right column when real pieces exist: the week's most liked work, unframed, each with its cartel. */
function SelectionColumn({ posts, onOpen }: { posts: FeedPost[]; onOpen: (id: string) => void }) {
  const [lead, ...rest] = posts;
  const side = rest.slice(0, 2);
  const cell = (post: FeedPost, index: number, style: object) => (
    <Pressable
      key={post.id}
      onPress={() => onOpen(post.id)}
      accessibilityRole="link"
      accessibilityLabel={`Réalisation de ${post.artistName}${post.artistCity ? `, ${post.artistCity}` : ''}`}
      style={[styles.cell, style, webPointer]}
    >
      <RevealImage uri={post.mediaUrl} style={StyleSheet.absoluteFill} />
      <View style={styles.cellMark} pointerEvents="none">
        <TText variant="micro" weight="bold" uppercase style={styles.cellMarkText} numberOfLines={1}>
          {`N° ${String(index + 1).padStart(2, '0')} / ${post.artistName}`}
        </TText>
      </View>
    </Pressable>
  );
  return (
    <View style={styles.visual}>
      <View style={styles.selectionGrid}>
        {cell(lead, 0, { flex: side.length ? 2 : 1 })}
        {side.length > 0 && (
          <View style={styles.selectionSide}>
            {side.map((p, i) => cell(p, i + 1, { flex: 1 }))}
          </View>
        )}
      </View>
      <View style={styles.selectionCaption}>
        <Kicker tone="onInkMuted">Sélection de la semaine</Kicker>
        <Kicker tone="onInkMuted">Pièces publiées sur Inkr</Kicker>
      </View>
    </View>
  );
}

/** Right column without real pieces: a skin-tone plate carrying the manifesto. No image is invented. */
function ManifestoColumn() {
  return (
    <View style={styles.visual}>
      <View style={styles.plate}>
        <LinearGradient colors={Gradients.plateClay} start={{ x: 0.3, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.plateFrame} pointerEvents="none" />
        <View style={styles.plateBody}>
          <Kicker style={styles.plateKicker}>[ Manifeste ]</Kicker>
          <TText variant="displayL" style={styles.plateStatement}>
            Ce n’est pas{'\n'}une image.{'\n'}
            <TText variant="displayL" italic style={styles.plateStatement}>C’est une rencontre.</TText>
          </TText>
        </View>
        <View style={styles.plateCaption}>
          <Kicker>Inkr / The human canvas</Kicker>
          <Kicker>Never just ink</Kicker>
        </View>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const wide = width >= 900;
  const selection = useFeedStore((s) => s.selection);
  const fetchSelection = useFeedStore((s) => s.fetchSelection);

  // Real pieces only, and only where there is room to show them.
  useEffect(() => { if (wide) void fetchSelection(); }, [wide, fetchSelection]);

  const explore = (style?: string) =>
    router.push(style ? { pathname: '/(tabs)/explore', params: { style } } : '/(tabs)/explore');
  const openPost = (id: string) => router.push(`/post/${id}`);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.shell, wide && styles.shellWide, { minHeight: height }]}>
          <View
            style={[
              styles.copy,
              wide && styles.copyWide,
              { paddingTop: insets.top + (wide ? 36 : 18), paddingBottom: insets.bottom + Spacing.lg },
            ]}
          >
            {/* Crown */}
            <Animated.View entering={reduced ? undefined : FadeIn.duration(700)}>
              <View style={styles.topBar}>
                <Logo size="sm" variant="wordmark" color={Colors.onInk} />
                <TextLink label="Se connecter" onPress={() => router.push('/(auth)/sign-in')} onInk icon="log-in-outline" />
              </View>
              <Kicker tone="onInkMuted" style={styles.crown}>INKR / THE HUMAN CANVAS</Kicker>
            </Animated.View>

            {/* Statement */}
            <View style={styles.statement}>
              <Animated.View entering={enter(120, reduced)}>
                <EditorialTitle size="hero" onInk emphasis="SKIN." breakEmphasis>{'ART\nUNDER'}</EditorialTitle>
              </Animated.View>

              <Animated.View entering={enter(260, reduced)}>
                <TText variant="body" color="onInkMuted" style={styles.lede}>
                  Le tatouage ne se choisit pas dans un catalogue : il se rencontre. Parcourez les portfolios
                  par style et par ville, puis confiez votre projet directement à l’artiste qui vous parle.
                </TText>
              </Animated.View>

              <Animated.View entering={enter(360, reduced)}>
                <Kicker tone="onInkMuted" style={styles.stylesKicker}>Entrer par un style</Kicker>
                <View style={styles.pills}>
                  {QUICK_STYLES.map((s) => (
                    <InkPill
                      key={s.slug}
                      label={s.name}
                      onPress={() => explore(s.slug)}
                      accessibilityLabel={`Voir les artistes ${s.name}`}
                    />
                  ))}
                </View>
              </Animated.View>

              <Animated.View entering={enter(460, reduced)} style={styles.actions}>
                <TButton
                  title="Découvrir les artistes"
                  variant="glass"
                  onPress={() => explore()}
                  icon={<Ionicons name="arrow-forward" size={15} color={Colors.ink} />}
                  iconPosition="right"
                  fullWidth={!wide}
                />
                <TButton
                  title="Je suis tatoueur·se"
                  variant="inverse"
                  onPress={() => router.push('/(auth)/sign-in')}
                  fullWidth={!wide}
                  accessibilityLabel="Je suis tatoueur ou tatoueuse : se connecter ou créer un espace artiste"
                />
              </Animated.View>
            </View>

            {/* Signature */}
            <Animated.View entering={reduced ? undefined : FadeIn.delay(700).duration(600)}>
              <View style={styles.signature}>
                <Kicker tone="onInkMuted" style={styles.signatureLines}>{'No two skins alike.\nNo two stories the same.'}</Kicker>
                <TText variant="displayS" italic color="flameOnInk" style={styles.signatureMotto}>Inked to exist.</TText>
              </View>

              <View style={styles.legalRow}>
                <TText variant="caption" color="onInkMuted">En continuant, vous acceptez les </TText>
                <Pressable onPress={() => router.push('/legal/terms')} accessibilityRole="link" style={webPointer}>
                  <TText variant="caption" color="onInk" style={styles.underline}>CGU</TText>
                </Pressable>
                <TText variant="caption" color="onInkMuted"> et la </TText>
                <Pressable onPress={() => router.push('/legal/privacy-policy')} accessibilityRole="link" style={webPointer}>
                  <TText variant="caption" color="onInk" style={styles.underline}>politique de confidentialité</TText>
                </Pressable>
                <TText variant="caption" color="onInkMuted">.</TText>
              </View>
            </Animated.View>
          </View>

          {wide && (
            <Animated.View entering={reduced ? undefined : FadeIn.delay(200).duration(900)} style={styles.visualWrap}>
              {selection.length > 0
                ? <SelectionColumn posts={selection} onOpen={openPost} />
                : <ManifestoColumn />}
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.inkPanel },

  shell: { flex: 1, width: '100%', backgroundColor: Colors.inkPanel },
  shellWide: { flexDirection: 'row' },

  copy: { flex: 1, justifyContent: 'space-between', paddingHorizontal: Layout.gutter, gap: Spacing['2xl'] },
  copyWide: { flex: 55, minWidth: 0, paddingHorizontal: Spacing['3xl'] },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  crown: { marginTop: Spacing.lg, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.onInkLine },

  statement: { maxWidth: 720 },
  lede: { maxWidth: 440, marginTop: Spacing.xl, lineHeight: 27 },

  stylesKicker: { marginTop: Spacing.xl, marginBottom: Spacing.xs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    minHeight: 40, paddingHorizontal: 14, justifyContent: 'center',
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.onInkLine,
  },
  pillLit: { backgroundColor: Colors.paper, borderColor: Colors.paper },

  actions: { gap: 10, flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.xl },

  signature: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.sm,
    paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.onInkLine,
  },
  signatureLines: { lineHeight: 17 },
  signatureMotto: { fontSize: 30, lineHeight: 32 },

  legalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: Spacing.md },
  underline: { textDecorationLine: 'underline' },

  // Right column (wide only)
  visualWrap: { flex: 45, minWidth: 0 },
  visual: { flex: 1 },

  selectionGrid: { flex: 1, flexDirection: 'row', gap: 2, backgroundColor: Colors.inkPanel },
  selectionSide: { flex: 1, gap: 2 },
  cell: { overflow: 'hidden', backgroundColor: Colors.clay },
  cellMark: {
    position: 'absolute', top: 14, left: 14, maxWidth: '85%',
    backgroundColor: Colors.paper, paddingHorizontal: 7, paddingVertical: 4,
  },
  cellMarkText: { color: Colors.ink, letterSpacing: 1.2, fontSize: 9 },
  selectionCaption: {
    flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.onInkLine,
  },

  plate: { flex: 1, overflow: 'hidden', justifyContent: 'space-between' },
  plateFrame: { ...StyleSheet.absoluteFillObject, margin: 24, borderWidth: 1, borderColor: Colors.clayDeep },
  plateBody: { padding: Spacing['3xl'], paddingTop: Spacing['4xl'] },
  plateKicker: { marginBottom: Spacing.lg },
  plateStatement: { color: Colors.ink, fontSize: 64, lineHeight: 60, letterSpacing: -2.4 },
  plateCaption: {
    flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm,
    marginHorizontal: Spacing['2xl'], marginBottom: Spacing['2xl'],
    paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.clayDeep,
  },
});
