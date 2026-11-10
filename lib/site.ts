// Public identity of the web app, used for titles, canonical URLs and social previews.
// Set EXPO_PUBLIC_SITE_URL when the site moves to its own domain.
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://tattoo-app-4gmu.vercel.app').replace(/\/+$/, '');
export const SITE_NAME = 'Inkr';
export const DEFAULT_TITLE = 'Inkr — Trouvez l’artiste tatoueur qui vous ressemble';
export const DEFAULT_DESCRIPTION =
  'Parcourez les portfolios de tatoueurs, studios et guest spots par style et par ville, puis envoyez votre projet directement à l’artiste.';
export const OG_IMAGE_PATH = '/og-image.png';

export interface PageMeta {
  title: string;
  description: string;
  /** False for personal or transactional screens that search engines should skip. */
  indexable: boolean;
}

const page = (title: string, description = DEFAULT_DESCRIPTION, indexable = false): PageMeta => ({
  title: `${title} — ${SITE_NAME}`,
  description,
  indexable,
});

// Keyed by the route without its (group) segments, e.g. "settings/account".
const PAGES: Record<string, PageMeta> = {
  '': { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, indexable: true },
  welcome: { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, indexable: true },
  explore: page(
    'Trouver un tatoueur par style et par ville',
    'Blackwork, réalisme, japonais, aquarelle… Recherchez un tatoueur par style et par ville et découvrez son portfolio.',
    true,
  ),
  'artist/[id]': page('Profil d’artiste tatoueur', DEFAULT_DESCRIPTION, true),
  'post/[id]': page('Réalisation', DEFAULT_DESCRIPTION, true),
  'legal/terms': page('Conditions générales d’utilisation', 'Les conditions générales d’utilisation d’Inkr.', true),
  'legal/privacy-policy': page('Politique de confidentialité', 'Comment Inkr collecte, utilise et protège vos données.', true),
  'sign-in': page('Connexion', 'Connectez-vous ou créez votre compte Inkr.'),
  'role-select': page('Votre profil'),
  inbox: page('Projets'),
  messages: page('Messages'),
  agenda: page('Agenda'),
  profile: page('Compte'),
  notifications: page('Notifications'),
  saved: page('Favoris'),
  create: page('Publier une réalisation'),
  analytics: page('Statistiques'),
  customization: page('Personnalisation'),
  'premium-guide': page('Inkr Premium'),
  'request/new': page('Nouveau projet'),
  'request/[id]': page('Projet'),
  'conversation/[id]': page('Conversation'),
  'appointment/[id]': page('Rendez-vous'),
  'review/new': page('Laisser un avis'),
  settings: page('Réglages'),
  'settings/account': page('Compte'),
  'settings/notifications': page('Notifications'),
  'settings/privacy': page('Confidentialité'),
  'settings/subscription': page('Abonnement'),
  'settings/support': page('Aide'),
  'settings/delete-account': page('Supprimer le compte'),
};

const FALLBACK: PageMeta = { title: SITE_NAME, description: DEFAULT_DESCRIPTION, indexable: false };

/** Metadata for a route, from expo-router segments such as ["(tabs)", "explore"]. */
export function pageMeta(segments: readonly string[]): PageMeta {
  const key = segments.filter((s) => !(s.startsWith('(') && s.endsWith(')')) && s !== 'index').join('/');
  if (Object.hasOwn(PAGES, key)) return PAGES[key];
  // Onboarding steps: /artist/step1 … /client/step3.
  if (/^(artist|client)\/step\d+$/.test(key)) return page('Bienvenue');
  return FALLBACK;
}

export function absoluteUrl(path: string): string {
  if (!path) return SITE_URL;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Shortens free text to a meta description, cutting on a word boundary. */
export function toDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30))}…`;
}
