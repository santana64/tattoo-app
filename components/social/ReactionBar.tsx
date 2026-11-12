import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Toast } from '@/components/ui/TToast';
import { EASE_OUT, PressableScale } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { REACTIONS, totalReactions, type ReactionCounts, type ReactionKey } from '@/lib/care';
import { useReactionStore } from './reaction-store';

interface ReactionBarProps {
  postId: string;
  compact?: boolean;
  initialCounts?: ReactionCounts;
  initialMine?: ReactionKey | null;
}

const EMPTY: ReactionCounts = Object.freeze({}) as ReactionCounts;
/** Below this window width the picker opens inline; above, as a popover over the button. */
const POPOVER_MIN_WIDTH = 640;
const COMPACT_CHIPS = 3;
const POPOVER_EMOJI = 40;
const POPOVER_PAD = 6;
const POPOVER_WIDTH = REACTIONS.length * POPOVER_EMOJI + (REACTIONS.length - 1) * 2 + POPOVER_PAD * 2;

const appear = FadeIn.duration(160).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
const vanish = FadeOut.duration(120).reduceMotion(ReduceMotion.System);

const META = Object.fromEntries(REACTIONS.map((r) => [r.key, r])) as Record<ReactionKey, (typeof REACTIONS)[number]>;
const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k` : String(n));

interface Anchor { x: number; y: number; width: number; height: number }

/**
 * Emoji reactions on a piece: the reactions that have counts as chips, plus a
 * button opening the five-emoji picker. One reaction per person: tapping your
 * current one removes it. Optimistic, rolled back with a toast on failure.
 */
export function ReactionBar({ postId, compact = false, initialCounts, initialMine }: ReactionBarProps) {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const load = useReactionStore((s) => s.load);
  const seed = useReactionStore((s) => s.seed);
  const react = useReactionStore((s) => s.react);
  const storedCounts = useReactionStore((s) => s.counts[postId]);
  const storedMine = useReactionStore((s) => (s.mineOwner === userId ? s.mine[postId] : undefined));
  const pending = useReactionStore((s) => s.pending.has(postId));

  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const toggleRef = useRef<View>(null);
  const usePopover = windowWidth >= POPOVER_MIN_WIDTH;

  // Values handed down by a list are server truth: keep the shared store in step.
  useEffect(() => {
    seed(postId, initialCounts, initialMine, userId);
  }, [postId, initialCounts, initialMine, userId, seed]);

  // Self-contained when nothing was handed down. Deferred one tick: a parent list's
  // effects run after ours and batch-load its page first, and the store never asks
  // twice for the same post.
  useEffect(() => {
    const needCounts = initialCounts === undefined;
    const needMine = !!userId && initialMine === undefined;
    if (!needCounts && !needMine) return;
    const timer = setTimeout(() => { void load([postId], needMine ? userId : null); }, 0);
    return () => clearTimeout(timer);
  }, [postId, userId, initialCounts, initialMine, load]);

  const counts = storedCounts ?? initialCounts ?? EMPTY;
  const mine: ReactionKey | null = userId ? (storedMine ?? initialMine ?? null) : null;

  const chips = useMemo(
    () => REACTIONS.filter((r) => (counts[r.key] ?? 0) > 0)
      .sort((a, b) => (counts[b.key] ?? 0) - (counts[a.key] ?? 0)),
    [counts],
  );
  const visibleChips = compact ? chips.slice(0, COMPACT_CHIPS) : chips;
  const hiddenTotal = compact
    ? chips.slice(COMPACT_CHIPS).reduce((sum, r) => sum + (counts[r.key] ?? 0), 0)
    : 0;
  const total = totalReactions(counts);

  const close = useCallback(() => setOpen(false), []);

  const choose = useCallback(async (key: ReactionKey) => {
    setOpen(false);
    if (!userId) {
      router.push({ pathname: '/(auth)/sign-in', params: { next: `/post/${postId}` } });
      return;
    }
    const next = mine === key ? null : key;
    if (!await react(userId, postId, next)) {
      Toast.error('Votre réaction n’a pas été enregistrée. Réessayez.');
    }
  }, [mine, postId, react, router, userId]);

  const openPicker = useCallback(() => {
    if (!userId) {
      router.push({ pathname: '/(auth)/sign-in', params: { next: `/post/${postId}` } });
      return;
    }
    if (open) { setOpen(false); return; }
    if (usePopover && toggleRef.current) {
      toggleRef.current.measureInWindow((x, y, width, height) => {
        setAnchor({ x, y, width, height });
        setOpen(true);
      });
    } else {
      setOpen(true);
    }
  }, [open, postId, router, usePopover, userId]);

  // The popover follows the window: close it when the layout changes under it.
  useEffect(() => { setOpen(false); }, [windowWidth, windowHeight]);

  const size = compact ? 'compact' : 'regular';
  const emojiSize = compact ? 13 : 15;
  const inlineOpen = open && !usePopover;
  const summary = total > 0
    ? `${total} réaction${total > 1 ? 's' : ''}${mine ? `, dont la vôtre : ${META[mine].label}` : ''}`
    : 'Aucune réaction';

  return (
    <View style={styles.root} accessibilityLabel={`Réactions. ${summary}`}>
      {inlineOpen ? (
        <Animated.View entering={appear} exiting={vanish} style={styles.inlinePicker} accessibilityRole="menu">
          {REACTIONS.map((r) => (
            <EmojiButton
              key={r.key}
              reaction={r}
              selected={mine === r.key}
              compact={compact}
              onPress={() => { void choose(r.key); }}
            />
          ))}
        </Animated.View>
      ) : (
        <View style={styles.chips}>
          {visibleChips.map((r) => {
            const n = counts[r.key] ?? 0;
            const selected = mine === r.key;
            return (
              <PressableScale
                key={r.key}
                onPress={() => { void choose(r.key); }}
                disabled={pending}
                pressedScale={0.92}
                haptic
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`${r.label}, ${n}`}
                accessibilityHint={selected ? 'Retire votre réaction.' : 'Réagir avec cet emoji.'}
                accessibilityState={{ selected, disabled: pending }}
                style={[styles.chip, styles[`chip_${size}`], selected && styles.chipSelected]}
              >
                <TText style={{ fontSize: emojiSize, lineHeight: emojiSize + 4 }}>{r.emoji}</TText>
                <TText variant="caption" tabular color={selected ? 'accentGlow' : 'secondary'} style={compact ? styles.countCompact : undefined}>
                  {formatCount(n)}
                </TText>
              </PressableScale>
            );
          })}
          {hiddenTotal > 0 && (
            <TText
              variant="caption"
              color="tertiary"
              tabular
              style={styles.more}
              accessibilityLabel={`et ${hiddenTotal} autre${hiddenTotal > 1 ? 's' : ''} réaction${hiddenTotal > 1 ? 's' : ''}`}
            >
              +{formatCount(hiddenTotal)}
            </TText>
          )}
        </View>
      )}

      <View ref={toggleRef} collapsable={false}>
        <PressableScale
          onPress={openPicker}
          pressedScale={0.92}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Fermer les réactions' : mine ? `Changer votre réaction (${META[mine].label})` : 'Réagir'}
          accessibilityState={{ expanded: open }}
          style={[styles.toggle, styles[`toggle_${size}`], open && styles.toggleOpen]}
        >
          {open
            ? <Ionicons name="close" size={compact ? 15 : 17} color={Colors.textPrimary} />
            : mine && chips.length === 0
              ? <TText style={{ fontSize: emojiSize, lineHeight: emojiSize + 4 }}>{META[mine].emoji}</TText>
              : (
                <View style={styles.smiley}>
                  <Ionicons name="happy-outline" size={compact ? 16 : 18} color={Colors.textSecondary} />
                  <View style={styles.plusDot}>
                    <Ionicons name="add" size={9} color={Colors.textInverse} />
                  </View>
                </View>
              )}
        </PressableScale>
      </View>

      {usePopover && (
        <Modal visible={open && !!anchor} transparent animationType="none" onRequestClose={close}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fermer les réactions" />
          {anchor && (
            <Animated.View
              entering={appear}
              accessibilityRole="menu"
              accessibilityViewIsModal
              style={[
                styles.popover,
                {
                  top: Math.max(8, anchor.y - POPOVER_EMOJI - POPOVER_PAD * 2 - 8),
                  left: Math.min(
                    Math.max(8, anchor.x + anchor.width - POPOVER_WIDTH),
                    windowWidth - POPOVER_WIDTH - 8,
                  ),
                },
              ]}
            >
              {REACTIONS.map((r) => (
                <EmojiButton
                  key={r.key}
                  reaction={r}
                  selected={mine === r.key}
                  large
                  onPress={() => { void choose(r.key); }}
                />
              ))}
            </Animated.View>
          )}
        </Modal>
      )}
    </View>
  );
}

function EmojiButton({ reaction, selected, onPress, compact, large }: {
  reaction: (typeof REACTIONS)[number]; selected: boolean; onPress: () => void; compact?: boolean; large?: boolean;
}) {
  const dim = large ? POPOVER_EMOJI : compact ? 32 : 36;
  const font = large ? 22 : compact ? 17 : 19;
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.88}
      haptic
      accessibilityRole="menuitem"
      accessibilityLabel={reaction.label}
      accessibilityHint={selected ? 'Votre réaction actuelle. Appuyez pour la retirer.' : undefined}
      accessibilityState={{ selected }}
      style={[styles.emojiBtn, { width: dim, height: dim, borderRadius: dim / 2 }, selected && styles.emojiSelected]}
    >
      <TText style={{ fontSize: font, lineHeight: font + 6 }}>{reaction.emoji}</TText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    backgroundColor: Colors.glassBg,
  },
  chip_regular: { height: 32, paddingHorizontal: 10 },
  chip_compact: { height: 28, paddingHorizontal: 8 },
  chipSelected: { borderColor: Colors.borderGlow, backgroundColor: Colors.accentMuted },
  countCompact: { fontSize: 12 },
  more: { paddingHorizontal: 2 },

  toggle: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  toggle_regular: { width: 36, height: 36, borderRadius: 18 },
  toggle_compact: { width: 32, height: 32, borderRadius: 16 },
  toggleOpen: { borderColor: Colors.borderGlow, backgroundColor: Colors.glassBgMid },
  smiley: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  plusDot: {
    position: 'absolute', right: -4, bottom: -3,
    width: 12, height: 12, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accentWarm,
    borderWidth: 1, borderColor: Colors.bgPrimary,
  },

  inlinePicker: { flexDirection: 'row', alignItems: 'center', gap: 2, flexWrap: 'wrap', flexShrink: 1 },
  emojiBtn: { alignItems: 'center', justifyContent: 'center' },
  emojiSelected: { backgroundColor: Colors.accentMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow },

  popover: {
    position: 'absolute',
    flexDirection: 'row', gap: 2,
    padding: POPOVER_PAD,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderBright,
    ...Shadow.md,
  },
});
