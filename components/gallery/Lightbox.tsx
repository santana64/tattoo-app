import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View,
  useWindowDimensions, type StyleProp, type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation, interpolate, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDecay, withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { EASE_OUT, Springs } from '@/components/motion';

export interface LightboxItem {
  id: string;
  uri: string;
  title?: string | null;
  subtitle?: string | null;
}

interface LightboxProps {
  visible: boolean;
  onClose(): void;
  items: LightboxItem[];
  index: number;
  onIndexChange?(i: number): void;
}

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const CHROME_IDLE_MS = 2500;
const SLIDE_MS = 260;
const ZOOM_MS = 240;
const SWIPE_RATIO = 0.3;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;
const WIDE = 768;

// Pan modes, decided by the first movement of a one-finger drag.
const MODE_NONE = 0;
const MODE_ZOOM = 1;
const MODE_SWIPE = 2;
const MODE_DISMISS = 3;
const MODE_IGNORE = 4;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/** How far a zoomed picture may move from the centre before its edge leaves the screen edge. */
function panLimit(fitted: number, view: number, scale: number) {
  'worklet';
  return Math.max(0, (fitted * scale - view) / 2);
}

/** Past the limit the picture follows the finger at a third of the speed. */
function rubber(value: number, limit: number) {
  'worklet';
  if (value > limit) return limit + (value - limit) * 0.3;
  if (value < -limit) return -limit + (value + limit) * 0.3;
  return value;
}

/**
 * Translation that keeps the point under the fingers (or cursor) fixed while
 * the scale goes from s0 to s. Coordinates are relative to the stage centre.
 */
function anchoredTranslation(t0: number, s0: number, s: number, focalStart: number, focalNow: number) {
  'worklet';
  return focalNow - (s * (focalStart - t0)) / s0;
}

/**
 * Full-screen viewer on the ink wall: pinch, double-tap and wheel zoom,
 * swipe between works, swipe down to leave. The chrome steps back after a
 * moment so only the work remains.
 */
export function Lightbox({ visible, onClose, items, index, onIndexChange }: LightboxProps) {
  const reduced = useReducedMotion();
  const open = visible && items.length > 0;
  return (
    <Modal
      visible={open}
      transparent
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      {/* A native Modal is a separate root: gestures need their own handler root. */}
      <GestureHandlerRootView style={styles.root}>
        {open && (
          <LightboxStage
            items={items}
            index={index}
            onIndexChange={onIndexChange}
            onClose={onClose}
            reduced={reduced}
          />
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

interface StageProps {
  items: LightboxItem[];
  index: number;
  onIndexChange?(i: number): void;
  onClose(): void;
  reduced: boolean;
}

function LightboxStage({ items, index, onIndexChange, onClose, reduced }: StageProps) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const count = items.length;
  const wide = W >= WIDE;

  const [current, setCurrent] = useState(() => clamp(index, 0, count - 1));
  const currentRef = useRef(current);
  const currentIdRef = useRef(items[current]?.id);
  const lastIndexProp = useRef(index);
  const sizes = useRef(new Map<string, { w: number; h: number }>());

  // ── Shared state (UI thread) ──
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const trackX = useSharedValue(-current * W);
  const dismissY = useSharedValue(0);
  const chrome = useSharedValue(1);
  const stageW = useSharedValue(W);
  const stageH = useSharedValue(H);
  const fitW = useSharedValue(W);
  const fitH = useSharedValue(H);
  const indexSV = useSharedValue(current);
  const countSV = useSharedValue(count);
  // Gesture bookkeeping.
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const pinching = useSharedValue(false);
  const rebase = useSharedValue(false);
  const panMode = useSharedValue(MODE_NONE);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);

  const [zoomed, setZoomed] = useState(false);
  useAnimatedReaction(
    () => scale.get() > 1.01,
    (now, before) => { if (now !== before) scheduleOnRN(setZoomed, now); },
  );

  // ── Chrome visibility ──
  const [chromeShown, setChromeShown] = useState(true);
  const chromeShownRef = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenReader = useRef(false);

  const hideChrome = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
    if (screenReader.current) return;
    chromeShownRef.current = false;
    setChromeShown(false);
  }, []);

  /** Shows the chrome and restarts the inactivity countdown. */
  const poke = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!chromeShownRef.current) {
      chromeShownRef.current = true;
      setChromeShown(true);
    }
    hideTimer.current = screenReader.current ? null : setTimeout(hideChrome, CHROME_IDLE_MS);
  }, [hideChrome]);

  const toggleChrome = useCallback(() => {
    if (chromeShownRef.current) hideChrome();
    else poke();
  }, [hideChrome, poke]);

  // With a screen reader the chrome never hides. On web there is no way to
  // know (react-native-web always answers true), so focus brings it back instead.
  useEffect(() => {
    poke();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [poke]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (!active) return;
      screenReader.current = on;
      if (on) poke();
    }, () => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (on: boolean) => {
      screenReader.current = on;
      poke();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [poke]);

  useEffect(() => {
    chrome.set(reduced ? (chromeShown ? 1 : 0) : withTiming(chromeShown ? 1 : 0, { duration: 220, easing: EASE_OUT }));
  }, [chromeShown, reduced, chrome]);

  // ── Geometry ──
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  /** Size of the current work once fitted (contain) in the stage, for the pan limits. */
  const updateFit = useCallback((i: number) => {
    const item = itemsRef.current[i];
    const size = item ? sizes.current.get(item.id) : undefined;
    const w = stageW.get();
    const h = stageH.get();
    if (!size || !size.w || !size.h) {
      fitW.set(w); fitH.set(h);
      return;
    }
    const f = Math.min(w / size.w, h / size.h);
    fitW.set(size.w * f); fitH.set(size.h * f);
  }, [stageW, stageH, fitW, fitH]);

  useEffect(() => {
    stageW.set(W); stageH.set(H);
    trackX.set(-currentRef.current * W);
    updateFit(currentRef.current);
  }, [W, H, stageW, stageH, trackX, updateFit]);

  useEffect(() => { countSV.set(count); }, [count, countSV]);

  const onSize = useCallback((id: string, w: number, h: number) => {
    sizes.current.set(id, { w, h });
    if (itemsRef.current[currentRef.current]?.id === id) updateFit(currentRef.current);
  }, [updateFit]);

  // ── Navigation ──
  /** Makes `next` the current work: unzoomed, announced, reported to the parent. */
  const commitIndex = useCallback((next: number) => {
    if (next === currentRef.current) return;
    const list = itemsRef.current;
    currentRef.current = next;
    currentIdRef.current = list[next]?.id;
    scale.set(1); tx.set(0); ty.set(0);
    updateFit(next);
    setCurrent(next);
    onIndexChange?.(next);
    if (Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility(`${list[next]?.title || 'Image'}, ${next + 1} sur ${list.length}`);
    }
  }, [onIndexChange, scale, tx, ty, updateFit]);

  const go = useCallback((delta: number) => {
    const next = currentRef.current + delta;
    if (next < 0 || next >= itemsRef.current.length) return;
    trackX.set(reduced ? -next * W : withTiming(-next * W, { duration: SLIDE_MS, easing: EASE_OUT }));
    indexSV.set(next);
    commitIndex(next);
  }, [reduced, W, trackX, indexSV, commitIndex]);

  /** Jumps without a slide (index changed by the parent, or the list changed). */
  const jumpTo = useCallback((next: number) => {
    trackX.set(-next * W);
    indexSV.set(next);
    commitIndex(next);
  }, [W, trackX, indexSV, commitIndex]);

  // The parent moved the index itself.
  useEffect(() => {
    if (index === lastIndexProp.current) return;
    lastIndexProp.current = index;
    const next = clamp(index, 0, count - 1);
    if (next !== currentRef.current) jumpTo(next);
  }, [index, count, jumpTo]);

  // The list changed while open (e.g. siblings arrived): stay on the same work.
  useEffect(() => {
    const at = items.findIndex((item) => item.id === currentIdRef.current);
    const next = at >= 0 ? at : clamp(currentRef.current, 0, items.length - 1);
    if (next !== currentRef.current) jumpTo(next);
    else currentIdRef.current = items[next]?.id;
  }, [items, jumpTo]);

  // Neighbours are fetched ahead of the swipe so it never lands on an empty wall.
  useEffect(() => {
    const neighbours = [current - 1, current + 1, current - 2, current + 2]
      .filter((i) => i >= 0 && i < items.length)
      .map((i) => items[i].uri)
      .filter((uri) => !!uri);
    if (neighbours.length) Image.prefetch(neighbours, 'memory-disk').catch(() => {});
  }, [current, items]);

  // ── Zoom helpers (callable from both threads) ──
  const settle = () => {
    'worklet';
    const s = clamp(scale.get(), 1, MAX_SCALE);
    const lx = panLimit(fitW.get(), stageW.get(), s);
    const ly = panLimit(fitH.get(), stageH.get(), s);
    const x = s <= 1.001 ? 0 : clamp(tx.get(), -lx, lx);
    const y = s <= 1.001 ? 0 : clamp(ty.get(), -ly, ly);
    if (reduced) {
      scale.set(s); tx.set(x); ty.set(y);
      return;
    }
    const timing = { duration: ZOOM_MS, easing: EASE_OUT };
    scale.set(withTiming(s, timing)); tx.set(withTiming(x, timing)); ty.set(withTiming(y, timing));
  };

  /** Zooms to `target` keeping the point (px, py), relative to the stage centre, in place. */
  const zoomAround = (target: number, px: number, py: number, animate: boolean) => {
    'worklet';
    const s0 = scale.get();
    const s = clamp(target, 1, MAX_SCALE);
    const lx = panLimit(fitW.get(), stageW.get(), s);
    const ly = panLimit(fitH.get(), stageH.get(), s);
    const x = s <= 1.001 ? 0 : clamp(anchoredTranslation(tx.get(), s0, s, px, px), -lx, lx);
    const y = s <= 1.001 ? 0 : clamp(anchoredTranslation(ty.get(), s0, s, py, py), -ly, ly);
    if (!animate || reduced) {
      scale.set(s); tx.set(x); ty.set(y);
      return;
    }
    const timing = { duration: ZOOM_MS, easing: EASE_OUT };
    scale.set(withTiming(s, timing)); tx.set(withTiming(x, timing)); ty.set(withTiming(y, timing));
  };

  // ── Gestures ──
  const pinch = Gesture.Pinch()
    .onStart((e) => {
      pinching.set(true);
      startScale.set(scale.get());
      startX.set(tx.get());
      startY.set(ty.get());
      focalX.set(e.focalX - stageW.get() / 2);
      focalY.set(e.focalY - stageH.get() / 2);
    })
    .onUpdate((e) => {
      const s0 = startScale.get();
      const s = clamp(s0 * e.scale, 0.85, MAX_SCALE * 1.15);
      const fx = e.focalX - stageW.get() / 2;
      const fy = e.focalY - stageH.get() / 2;
      scale.set(s);
      tx.set(anchoredTranslation(startX.get(), s0, s, focalX.get(), fx));
      ty.set(anchoredTranslation(startY.get(), s0, s, focalY.get(), fy));
    })
    .onFinalize(() => {
      if (!pinching.get()) return;
      pinching.set(false);
      rebase.set(true);
      settle();
    });

  const pan = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      panMode.set(scale.get() > 1.01 ? MODE_ZOOM : MODE_NONE);
      panX.set(tx.get());
      panY.set(ty.get());
      rebase.set(false);
    })
    .onUpdate((e) => {
      if (pinching.get()) return;
      let mode = panMode.get();
      if (rebase.get()) {
        // A pinch just ended under this drag: continue from where it left the picture.
        rebase.set(false);
        panX.set(tx.get() - e.translationX);
        panY.set(ty.get() - e.translationY);
        if (scale.get() > 1.01) { mode = MODE_ZOOM; panMode.set(mode); }
      }
      if (mode === MODE_NONE) {
        const horizontal = Math.abs(e.translationX) > Math.abs(e.translationY);
        mode = horizontal ? MODE_SWIPE : e.translationY > 0 ? MODE_DISMISS : MODE_IGNORE;
        panMode.set(mode);
      }
      if (mode === MODE_ZOOM) {
        const s = scale.get();
        tx.set(rubber(panX.get() + e.translationX, panLimit(fitW.get(), stageW.get(), s)));
        ty.set(rubber(panY.get() + e.translationY, panLimit(fitH.get(), stageH.get(), s)));
      } else if (mode === MODE_SWIPE) {
        const i = indexSV.get();
        const atEdge = (i === 0 && e.translationX > 0) || (i === countSV.get() - 1 && e.translationX < 0);
        trackX.set(-i * stageW.get() + (atEdge ? e.translationX * 0.25 : e.translationX));
      } else if (mode === MODE_DISMISS) {
        dismissY.set(Math.max(0, e.translationY));
      }
    })
    .onEnd((e) => {
      const mode = panMode.get();
      if (mode === MODE_ZOOM) {
        const s = scale.get();
        const lx = panLimit(fitW.get(), stageW.get(), s);
        const ly = panLimit(fitH.get(), stageH.get(), s);
        if (reduced || Math.abs(tx.get()) > lx || Math.abs(ty.get()) > ly) settle();
        else {
          tx.set(withDecay({ velocity: e.velocityX, clamp: [-lx, lx] }));
          ty.set(withDecay({ velocity: e.velocityY, clamp: [-ly, ly] }));
        }
      } else if (mode === MODE_SWIPE) {
        const i = indexSV.get();
        const w = stageW.get();
        const projected = e.translationX + e.velocityX * 0.2;
        let target = i;
        if (projected < -w * SWIPE_RATIO && i < countSV.get() - 1) target = i + 1;
        else if (projected > w * SWIPE_RATIO && i > 0) target = i - 1;
        trackX.set(reduced ? -target * w : withTiming(-target * w, { duration: SLIDE_MS, easing: EASE_OUT }));
        if (target !== i) {
          indexSV.set(target);
          scheduleOnRN(commitIndex, target);
        }
      } else if (mode === MODE_DISMISS) {
        if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
          if (!reduced) dismissY.set(withTiming(stageH.get(), { duration: 200, easing: EASE_OUT }));
          scheduleOnRN(onClose);
        } else {
          dismissY.set(reduced ? 0 : withSpring(0, { ...Springs.snapBack, velocity: e.velocityY }));
        }
      }
      panMode.set(MODE_NONE);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(12)
    .onEnd((e, success) => {
      if (!success) return;
      if (scale.get() > 1.01) zoomAround(1, 0, 0, true);
      else zoomAround(DOUBLE_TAP_SCALE, e.x - stageW.get() / 2, e.y - stageH.get() / 2, true);
    });

  const singleTap = Gesture.Tap()
    .maxDistance(12)
    .onEnd((_e, success) => {
      if (success) scheduleOnRN(toggleChrome);
    });

  const gestures = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  // ── Web: keyboard, wheel, pointer ──
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      // Escape is handled by the Modal (onRequestClose).
      if (e.key === 'ArrowRight') { e.preventDefault(); poke(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); poke(); go(-1); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); poke(); zoomAround(scale.get() * 1.5, 0, 0, true); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); poke(); zoomAround(scale.get() / 1.5, 0, 0, true); }
      else if (e.key === '0') { poke(); zoomAround(1, 0, 0, true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // zoomAround only touches shared values, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, poke]);

  // Plain View: on web its ref is the DOM element.
  const stageNode = useRef<View>(null);
  useEffect(() => {
    const node = stageNode.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !node || typeof node.addEventListener !== 'function') return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      poke();
      const rect = node.getBoundingClientRect();
      const px = e.clientX - rect.left - rect.width / 2;
      const py = e.clientY - rect.top - rect.height / 2;
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      // Trackpad pinches arrive as ctrl+wheel with small deltas.
      const speed = e.ctrlKey || e.metaKey ? 0.01 : 0.002;
      zoomAround(scale.get() * Math.exp(-delta * speed), px, py, false);
    };
    const onMove = () => poke();
    const noDrag = (e: Event) => e.preventDefault();
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('pointermove', onMove);
    node.addEventListener('dragstart', noDrag);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('dragstart', noDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poke]);

  // ── Styles ──
  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: trackX.get() }] }));
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));
  const dismissStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dismissY.get() },
      { scale: interpolate(dismissY.get(), [0, stageH.get()], [1, 0.86], Extrapolation.CLAMP) },
    ],
  }));
  const wallStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissY.get(), [0, stageH.get() * 0.5], [1, 0.15], Extrapolation.CLAMP),
  }));
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: chrome.get() * interpolate(dismissY.get(), [0, 80], [1, 0], Extrapolation.CLAMP),
  }));

  const item = items[current];
  const counter = `${current + 1} / ${count}`;
  const a11yLabel = `${item?.title || 'Image'}${item?.subtitle ? `, ${item.subtitle}` : ''}, ${current + 1} sur ${count}`;
  const webStage: ViewStyle | null = Platform.OS === 'web'
    ? ({ cursor: zoomed ? 'grab' : 'zoom-in', touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle)
    : null;

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.wall, wallStyle]} />

      <View ref={stageNode} style={StyleSheet.absoluteFill}>
        <GestureDetector gesture={gestures}>
          <Animated.View
            collapsable={false}
            style={[StyleSheet.absoluteFill, webStage, dismissStyle]}
            accessible
            accessibilityRole={Platform.OS === 'web' ? 'image' : 'adjustable'}
            accessibilityLabel={a11yLabel}
            accessibilityHint={count > 1 && Platform.OS !== 'web' ? 'Balayez vers le haut ou le bas pour changer d’œuvre.' : undefined}
            accessibilityActions={count > 1 ? [{ name: 'increment', label: 'Œuvre suivante' }, { name: 'decrement', label: 'Œuvre précédente' }] : undefined}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'increment') go(1);
              else if (e.nativeEvent.actionName === 'decrement') go(-1);
            }}
            onAccessibilityEscape={onClose}
          >
            <Animated.View style={[styles.track, { width: count * W, height: H }, trackStyle]}>
              {items.map((it, i) => (Math.abs(i - current) <= 1 ? (
                <View key={it.id} style={[styles.slide, { left: i * W, width: W, height: H }]}>
                  <Animated.View style={[StyleSheet.absoluteFill, i === current ? zoomStyle : null]}>
                    <Slide item={it} reduced={reduced} onSize={onSize} />
                  </Animated.View>
                </View>
              ) : null))}
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* ── Chrome ── */}
      <Animated.View style={[StyleSheet.absoluteFill, chromeStyle]} pointerEvents={chromeShown ? 'box-none' : 'none'}>
        <View style={[styles.topBar, { top: insets.top + Spacing['2xs'], left: insets.left + Layout.gutter, right: insets.right + Layout.gutter }]} pointerEvents="box-none">
          {count > 1 ? (
            <View style={styles.counter}>
              <TText variant="label" weight="bold" tabular color="onInk" accessibilityLabel={`Œuvre ${current + 1} sur ${count}`}>
                {counter}
              </TText>
            </View>
          ) : <View />}
          <ChromeButton icon="close" label="Fermer la visionneuse" onPress={onClose} onFocus={poke} />
        </View>

        {wide && count > 1 && (
          <>
            <ChromeButton
              icon="chevron-back"
              label="Œuvre précédente"
              onPress={() => { poke(); go(-1); }}
              onFocus={poke}
              disabled={current === 0}
              style={[styles.arrow, { left: insets.left + Layout.gutter }]}
            />
            <ChromeButton
              icon="chevron-forward"
              label="Œuvre suivante"
              onPress={() => { poke(); go(1); }}
              onFocus={poke}
              disabled={current === count - 1}
              style={[styles.arrow, { right: insets.right + Layout.gutter }]}
            />
          </>
        )}

        {!!(item?.title || item?.subtitle) && (
          <View
            style={[styles.label, { bottom: insets.bottom + Spacing.lg, left: insets.left + Layout.gutter, right: insets.right + Layout.gutter }]}
            pointerEvents="none"
          >
            {!!item?.title && (
              <TText variant="title1" serif italic color="onInk" numberOfLines={2} style={styles.labelTitle}>{item.title}</TText>
            )}
            {!!item?.subtitle && (
              <TText variant="caption" color="onInkMuted" numberOfLines={2} style={styles.labelSub}>{item.subtitle}</TText>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function Slide({ item, reduced, onSize }: {
  item: LightboxItem; reduced: boolean; onSize: (id: string, w: number, h: number) => void;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  return (
    <View style={StyleSheet.absoluteFill}>
      {state !== 'failed' && (
        <Image
          source={{ uri: item.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={item.id}
          allowDownscaling={false}
          transition={reduced ? 0 : 180}
          accessibilityLabel={item.title ?? undefined}
          onLoad={(e) => {
            onSize(item.id, e.source.width, e.source.height);
            setState('ready');
          }}
          onError={() => setState('failed')}
        />
      )}
      {state === 'loading' && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={Colors.onInkMuted} />
        </View>
      )}
      {state === 'failed' && (
        <View style={styles.center} pointerEvents="none">
          <Ionicons name="image-outline" size={28} color={Colors.onInkMuted} />
          <TText variant="caption" color="onInkMuted" style={{ marginTop: Spacing['2xs'] }}>Image indisponible</TText>
        </View>
      )}
    </View>
  );
}

type Interaction = { pressed: boolean; hovered?: boolean };

/** Square ink plate: stays legible over any photograph. */
function ChromeButton({ icon, label, onPress, onFocus, disabled, style }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  onFocus?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      onFocus={onFocus}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      style={(state) => {
        const { pressed, hovered } = state as Interaction;
        return [
          styles.chromeButton,
          style,
          (pressed || hovered) && !disabled && styles.chromeButtonLit,
          disabled && styles.chromeButtonDisabled,
        ];
      }}
    >
      {(state) => {
        const { pressed, hovered } = state as Interaction;
        return <Ionicons name={icon} size={22} color={(pressed || hovered) && !disabled ? '#FFFFFF' : Colors.onInk} />;
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  wall: { backgroundColor: Colors.inkPanel },
  track: { position: 'absolute', top: 0, left: 0 },
  slide: { position: 'absolute', top: 0, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  counter: { backgroundColor: Colors.inkPanel, paddingHorizontal: 10, paddingVertical: 6 },
  chromeButton: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.inkPanel,
    borderWidth: 1, borderColor: Colors.onInkLine,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as ViewStyle)
      : null),
  },
  chromeButtonLit: { backgroundColor: Colors.flame, borderColor: Colors.flame },
  chromeButtonDisabled: { opacity: 0.3 },
  arrow: { position: 'absolute', top: '50%', marginTop: -22 },
  // The cartel sits on its own ink plate, never on a gradient over the work.
  label: {
    position: 'absolute', maxWidth: 560, alignSelf: 'flex-start',
    backgroundColor: Colors.inkPanel,
    borderLeftWidth: 2, borderLeftColor: Colors.flame,
    paddingLeft: Spacing.sm, paddingRight: Spacing.md, paddingVertical: Spacing.xs,
  },
  labelTitle: { fontSize: 24, lineHeight: 29 },
  labelSub: { marginTop: 4, lineHeight: 18 },
});
