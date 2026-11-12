import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { Layout } from '@/constants/theme';

/** Width taken by the fixed navigation rail (0 on phones, tablets and native). */
export const ShellContext = createContext<{ sidebarWidth: number }>({ sidebarWidth: 0 });

export function useShell() {
  const { sidebarWidth } = useContext(ShellContext);
  return { sidebarWidth, hasSidebar: sidebarWidth > 0 };
}

/**
 * Drop-in replacement for `useWindowDimensions()` inside pages: `width` is the
 * space actually left to the page once the navigation rail is subtracted.
 * Full-window overlays (lightbox, story viewer, sheets) keep `useWindowDimensions`.
 */
export function useContentDimensions() {
  const window = useWindowDimensions();
  const { sidebarWidth } = useContext(ShellContext);
  const width = Math.max(0, window.width - sidebarWidth);
  return {
    ...window,
    width,
    /** Editorial two-column compositions start here. */
    isWide: width >= 900,
    /** Side gutter of the page at this width. */
    gutter: width >= 900 ? Layout.gutterWide : Layout.gutter,
  };
}
