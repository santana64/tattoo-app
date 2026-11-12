import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/theme';
import { TButton } from './TButton';
import { Toast } from './TToast';
import { absoluteUrl, shareLink, type ShareOutcome } from '@/lib/share';

export interface SharePageInput {
  title: string;
  text?: string;
  /** In-app path of the public page, e.g. "/post/<id>". */
  path: string;
}

/** Shares a public page and tells the person what happened. */
export async function sharePage({ title, text, path }: SharePageInput): Promise<ShareOutcome> {
  const outcome = await shareLink({ title, text, url: absoluteUrl(path) });
  if (outcome === 'copied') Toast.success('Lien copié');
  else if (outcome === 'failed') Toast.error('Le partage n’a pas fonctionné. Réessayez.');
  return outcome;
}

interface ShareButtonProps extends SharePageInput {
  variant?: 'icon' | 'button';
  /** Icon variant only: square hairline control (headers) or bare glyph (action rows). */
  framed?: boolean;
  /** On an ink panel or over photography. */
  onInk?: boolean;
  style?: StyleProp<ViewStyle>;
}

type Interaction = { pressed: boolean; hovered?: boolean };

const SHARE_ICON: keyof typeof Ionicons.glyphMap = Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline';
const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as object)
  : null;

export function ShareButton({ title, text, path, variant = 'icon', framed = true, onInk = false, style }: ShareButtonProps) {
  const [busy, setBusy] = useState(false);
  // A second tap while the sheet is opening must not open a second one.
  const busyRef = useRef(false);

  const onPress = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await sharePage({ title, text, path });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (variant === 'button') {
    return (
      <TButton
        title="Partager"
        variant={onInk ? 'inverse' : 'secondary'}
        size="md"
        fullWidth={false}
        disabled={busy}
        onPress={() => { void onPress(); }}
        accessibilityLabel={`Partager « ${title} »`}
        icon={<Ionicons name={SHARE_ICON} size={16} color={onInk ? Colors.onInk : Colors.ink} />}
        style={StyleSheet.flatten(style)}
      />
    );
  }

  const rest = onInk ? Colors.onInk : framed ? Colors.ink : Colors.textSecondary;
  return (
    <Pressable
      onPress={() => { void onPress(); }}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Partager"
      accessibilityHint={`Partage le lien de « ${title} »`}
      accessibilityState={{ busy, disabled: busy }}
      hitSlop={framed ? 0 : 4}
      style={(state) => {
        const { hovered, pressed } = state as Interaction;
        const lit = (hovered || pressed) && !busy;
        return [
          framed ? styles.framed : styles.bare,
          framed && { borderColor: onInk ? Colors.onInkLine : Colors.line },
          webPointer,
          lit && (framed ? styles.framedLit : styles.bareLit),
          busy && styles.busy,
          style,
        ];
      }}
    >
      {(state) => {
        const { hovered, pressed } = state as Interaction;
        const lit = (hovered || pressed) && !busy;
        const color = lit
          ? (framed ? '#FFFFFF' : onInk ? Colors.flameOnInk : Colors.flameText)
          : rest;
        return <Ionicons name={SHARE_ICON} size={framed ? 18 : 20} color={color} />;
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  framed: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  framedLit: { backgroundColor: Colors.flame, borderColor: Colors.flame },
  bare: { minWidth: 44, height: 44, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  bareLit: {},
  busy: { opacity: 0.5 },
});
