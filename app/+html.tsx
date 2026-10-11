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
        <meta name="theme-color" content="#0B0A09" />
        <meta name="color-scheme" content="dark" />
        <title>Inkr — Trouvez l’artiste tatoueur qui vous ressemble</title>
        <meta
          name="description"
          content="Parcourez les portfolios de tatoueurs, studios et guest spots par style et par ville, puis envoyez votre projet directement à l’artiste."
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Inkr" />
        <meta property="og:title" content="Inkr — Trouvez l’artiste tatoueur qui vous ressemble" />
        <meta
          property="og:description"
          content="Portfolios, styles et villes : découvrez des tatoueurs et confiez-leur votre projet."
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: documentStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Paint the gallery wall before JS loads (no white flash), keep text crisp,
// and give keyboard users a visible focus ring.
const documentStyle = `
html, body { background-color: #0B0A09; color: #F4EFE6; }
body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
::selection { background: rgba(201,164,106,0.35); }
:focus-visible { outline: 2px solid rgba(221,187,130,0.85); outline-offset: 2px; border-radius: 6px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;
