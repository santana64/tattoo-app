import { Easing, FadeIn, FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';

// Curves — never ease-in on UI.
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);      // entrances, reveals
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);  // on-screen movement
export const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);    // sheets / drawers

export const MotionDuration = {
  press: 120,    // press feedback
  state: 180,    // chips, toggles, small state changes
  enter: 520,    // content entering the screen
  reveal: 700,   // photographs "lighting up"
} as const;

// Springs: designer parameters (duration + damping ratio), used only when a finger is involved.
export const Springs = {
  settle: { duration: 400, dampingRatio: 1 },
  snapBack: { duration: 400, dampingRatio: 0.8 },
  sheet: { duration: 300, dampingRatio: 0.8 },
  pop: { duration: 260, dampingRatio: 0.55 },
} as const;

/**
 * Staggered entrance: rises and fades in. Collapses to a plain fade under reduced motion.
 * Note: no `.withInitialValues()` — on web it turns the preset into a custom animation whose
 * cleanup crashes in Reanimated 4.1 (setElementPosition on a missing snapshot).
 */
export function enterUp(index = 0, base = 0) {
  return FadeInDown.delay(base + Math.min(index, 8) * 55)
    .duration(MotionDuration.enter)
    .easing(EASE_OUT)
    .reduceMotion(ReduceMotion.System);
}

export const fadeIn = (delay = 0) =>
  FadeIn.delay(delay).duration(MotionDuration.enter).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

export const fadeOut = FadeOut.duration(160).easing(EASE_OUT);
