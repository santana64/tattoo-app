// Native: no captcha. Turnstile only runs in a browser (see Captcha.web.tsx);
// sign-in on iOS and Android behaves exactly as without a site key.
import type { StyleProp, ViewStyle } from 'react-native';

export interface CaptchaProps {
  /** A fresh single-use token, or null when there is none (expired, failed, reset). */
  onToken: (token: string | null) => void;
  /** Change it after each auth attempt: the widget is reset and the old token dropped. */
  resetKey?: number;
  style?: StyleProp<ViewStyle>;
}

/** Whether auth calls must carry a captcha token on this platform. */
export const CAPTCHA_REQUIRED = false;

export function Captcha(_props: CaptchaProps) {
  return null;
}
