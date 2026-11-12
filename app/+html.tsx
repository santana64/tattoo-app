import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Web-only document shell (static output). Native ignores this file.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#F0ECE3" />
        <meta name="color-scheme" content="light" />
        {/* Title, description, canonical and social tags are set per route by <Seo> (components/Seo.tsx):
            a second <title> here would lose to the router's own, which is emitted first. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: documentStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Paint the paper before JS loads (no flash), keep text crisp,
// and give keyboard users a visible focus ring.
const documentStyle = `
html, body { background-color: #F0ECE3; color: #121310; }
body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
::selection { background: #EA583B; color: #fff; }
:focus-visible { outline: 3px solid #EA583B; outline-offset: 3px; }
input:focus-visible, textarea:focus-visible { outline: none; }
/* Paper grain: a mineral tooth on the page. Static, GPU-cheap, never intercepts input. */
body::after {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;
  opacity: 0.05; mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;
