import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/theme';
import { PressableScale } from '@/components/motion';
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
  /** Icon variant only: hairline circle (headers) or bare glyph (action rows). */
  framed?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SHARE_ICON: keyof typeof Ionicons.glyphMap = Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline';

export function ShareButton({ title, text, path, variant = 'icon', framed = true, style }: ShareButtonProps) {
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
        variant="secondary"
        size="md"
        fullWidth={false}
        disabled={busy}
        onPress={() => { void onPress(); }}
        accessibilityLabel={`Partager « ${title} »`}
        icon={<Ionicons name={SHARE_ICON} size={17} color={Colors.textPrimary} />}
        style={StyleSheet.flatten(style)}
      />
    );
  }

  return (
    <PressableScale
      onPress={() => { void onPress(); }}
      pressedScale={0.92}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Partager"
      accessibilityHint={`Partage le lien de « ${title} »`}
      accessibilityState={{ busy, disabled: busy }}
      hitSlop={8}
      style={[framed ? styles.framed : styles.bare, style]}
    >
      <Ionicons name={SHARE_ICON} size={framed ? 18 : 21} color={framed ? Colors.textPrimary : Colors.textSecondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  framed: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  bare: { minWidth: 44, height: 44, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
});
