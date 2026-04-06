export type UserRole = 'user' | 'artist';
export type ArtistTier = 'normal' | 'premium';
export type BookingStatus = 'open' | 'paused' | 'closed';
export type RequestStatus =
  | 'submitted'
  | 'accepted'
  | 'declined'
  | 'clarification_needed'
  | 'archived'
  | 'completed';
export type AppointmentStatus = 'proposed' | 'confirmed' | 'completed' | 'canceled';

export interface Style {
  id: string;
  slug: string;
  name: string;
  emoji: string;
}

export interface Artist {
  id: string;
  blaze: string;
  city: string;
  bio: string;
  coverUrl: string;
  avatarUrl: string;
  styles: string[];
  specialties: string[];
  bookingStatus: BookingStatus;
  minBudget: number;
  tier: ArtistTier;
  isVerified: boolean;
  stats: {
    posts: number;
    profileViews: number;
    requestsThisMonth: number;
  };
  exclusions: string[];
  faq: { question: string; answer: string }[];
  rules: string;
  process?: string;
}

export interface Post {
  id: string;
  artistId: string;
  artist: Pick<Artist, 'id' | 'blaze' | 'city' | 'avatarUrl' | 'tier'>;
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  caption: string;
  styles: string[];
  likes: number;
  isLiked: boolean;
  publishedAt: string;
}

export interface TattooRequest {
  id: string;
  clientName: string;
  clientAvatar: string;
  artistId: string;
  projectType: 'new' | 'cover_up' | 'touch_up' | 'extension';
  bodyZone: string;
  sizeCategory: 'xs' | 's' | 'm' | 'l' | 'xl';
  budgetMin: number;
  budgetMax: number;
  colorPreference: 'black_grey' | 'color' | 'artist_choice';
  stylePreference: string;
  description: string;
  flexibilityLevel: 'precise' | 'open' | 'full_trust';
  isFirstTattoo: boolean;
  status: RequestStatus;
  submittedAt: string;
  references: string[];
  declineReason?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'system' | 'slot_proposal' | 'appointment_confirmed';
  createdAt: string;
  isRead: boolean;
}

export interface Appointment {
  id: string;
  requestId: string;
  clientName: string;
  clientAvatar: string;
  artistBlaze: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  bodyZone: string;
  notes?: string;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

export const STYLES: Style[] = [
  { id: '1', slug: 'blackwork', name: 'Blackwork', emoji: '◼' },
  { id: '2', slug: 'realisme', name: 'Réalisme', emoji: '🎨' },
  { id: '3', slug: 'japonais', name: 'Japonais', emoji: '🌸' },
  { id: '4', slug: 'geometrie', name: 'Géométrie', emoji: '⬡' },
  { id: '5', slug: 'aquarelle', name: 'Aquarelle', emoji: '💧' },
  { id: '6', slug: 'lettering', name: 'Lettering', emoji: 'A' },
  { id: '7', slug: 'old-school', name: 'Old School', emoji: '⚓' },
  { id: '8', slug: 'neo-trad', name: 'Néo-Trad', emoji: '🦁' },
  { id: '9', slug: 'tribal', name: 'Tribal', emoji: '🔱' },
  { id: '10', slug: 'minimaliste', name: 'Minimaliste', emoji: '—' },
  { id: '11', slug: 'fine-line', name: 'Fine Line', emoji: '∿' },
  { id: '12', slug: 'dotwork', name: 'Dotwork', emoji: '·' },
];

// ─── ARTISTS ─────────────────────────────────────────────────────────────────

export const ARTISTS: Artist[] = [
  {
    id: 'a1',
    blaze: 'Marco Ink',
    city: 'Paris',
    bio: 'Japonais traditionnel & illustratif · Paris · 15 ans de pratique. Je travaille sur des projets porteurs de sens.',
    coverUrl: 'https://images.unsplash.com/photo-1590246814883-57c511e76523?w=800',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200',
    styles: ['japonais', 'neo-trad'],
    specialties: ['Manches', 'Dos complet', 'Portraits'],
    bookingStatus: 'open',
    minBudget: 400,
    tier: 'premium',
    isVerified: true,
    stats: { posts: 87, profileViews: 3240, requestsThisMonth: 12 },
    exclusions: ['Recouvrement seul', 'Couleur seule'],
    faq: [
      { question: 'Quel est ton tarif minimum ?', answer: 'À partir de 400€. Chaque projet est évalué individuellement selon la complexité et la durée de séance.' },
      { question: 'Tu travailles sur des recouvrement ?', answer: 'Uniquement si le projet final m\'intéresse vraiment. Envoie une demande avec photos du tatouage existant.' },
      { question: 'Comment fonctionne ta prise de RDV ?', answer: 'Demande → évaluation → échange → créneau → acompte de 30% pour confirmation.' },
      { question: 'Quel est ton délai d\'attente ?', answer: 'En ce moment environ 4 à 6 mois selon la complexité du projet.' },
    ],
    rules: 'Je travaille uniquement sur des projets qui m\'inspirent. Mon style est ma signature — je n\'adapte pas mes dessins à des références extérieures. Budget minimum 400€.',
    process: 'On échange d\'abord sur le projet. Je conçois le tatouage une fois le RDV confirmé et l\'acompte versé. Le dessin est présenté le jour J — c\'est le moment pour ajuster. Je ne montre jamais les dessins à l\'avance.',
  },
  {
    id: 'a2',
    blaze: 'Lucie Blanc',
    city: 'Bordeaux',
    bio: 'Fine line & aquarelle couleur · Bordeaux. Projets personnels, symboliques, féminins ou non.',
    coverUrl: 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=800',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
    styles: ['fine-line', 'aquarelle'],
    specialties: ['Fine line', 'Aquarelle', 'Portraits floraux'],
    bookingStatus: 'open',
    minBudget: 250,
    tier: 'normal',
    isVerified: false,
    stats: { posts: 43, profileViews: 1180, requestsThisMonth: 8 },
    exclusions: ['Recouvrement', 'Tribal'],
    faq: [
      { question: 'Tu fais des retouches ?', answer: 'Oui, une retouche offerte dans les 3 mois suivant la séance.' },
      { question: 'Budget minimum ?', answer: 'À partir de 250€ pour une petite pièce fine line.' },
      { question: 'Délai de réponse ?', answer: 'Je réponds sous 48h en semaine.' },
    ],
    rules: 'Pas de recouvrement. Pas de tribal. J\'adore les projets floraux, botaniques, minimalistes ou symboliques.',
    process: undefined,
  },
  {
    id: 'a3',
    blaze: 'Karim Nox',
    city: 'Lyon',
    bio: 'Blackwork & géométrie · Lyon · Projets geometriques et sacrés.',
    coverUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    styles: ['blackwork', 'geometrie'],
    specialties: ['Géométrie', 'Mandala', 'Ornamental'],
    bookingStatus: 'open',
    minBudget: 300,
    tier: 'normal',
    isVerified: true,
    stats: { posts: 61, profileViews: 2010, requestsThisMonth: 14 },
    exclusions: ['Couleur', 'Portrait réaliste'],
    faq: [
      { question: 'Tu fais de la couleur ?', answer: 'Non, je travaille exclusivement en noir.' },
      { question: 'Budget minimum ?', answer: '300€ minimum.' },
    ],
    rules: 'Blackwork uniquement. Pas de couleur. Projets géométriques, ornementaux, ou à forte charge symbolique.',
    process: undefined,
  },
  {
    id: 'a4',
    blaze: 'Sofia Reyes',
    city: 'Barcelone',
    bio: 'Illustration fine & portraits réalistes · Barcelone. Je capture ce qui compte.',
    coverUrl: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    styles: ['realisme', 'fine-line'],
    specialties: ['Portraits', 'Animaux', 'Botanique détaillée'],
    bookingStatus: 'paused',
    minBudget: 350,
    tier: 'premium',
    isVerified: true,
    stats: { posts: 124, profileViews: 5600, requestsThisMonth: 0 },
    exclusions: ['Old school', 'Tribal'],
    faq: [
      { question: 'Quand reouvres-tu les demandes ?', answer: 'Prochaine ouverture en juin. Active la notification pour être prévenu.' },
      { question: 'Budget minimum ?', answer: 'À partir de 350€.' },
    ],
    rules: 'Réalisme et fine line uniquement. Actuellement en pause — prochaine ouverture en juin.',
    process: 'Session de 3 à 7h selon la pièce. Je fournis toutes les instructions de soin.',
  },
];

// ─── POSTS ───────────────────────────────────────────────────────────────────

export const POSTS: Post[] = [
  {
    id: 'p1',
    artistId: 'a1',
    artist: { id: 'a1', blaze: 'Marco Ink', city: 'Paris', avatarUrl: ARTISTS[0].avatarUrl, tier: 'premium' },
    mediaUrl: 'https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=600',
    mediaType: 'photo',
    caption: 'Chrysanthème et carpe koï — manche complète en 3 séances.',
    styles: ['japonais'],
    likes: 284,
    isLiked: false,
    publishedAt: '2026-03-28T14:22:00Z',
  },
  {
    id: 'p2',
    artistId: 'a2',
    artist: { id: 'a2', blaze: 'Lucie Blanc', city: 'Bordeaux', avatarUrl: ARTISTS[1].avatarUrl, tier: 'normal' },
    mediaUrl: 'https://images.unsplash.com/photo-1590841609987-4ac211afdde1?w=600',
    mediaType: 'photo',
    caption: 'Pivoine fine line poignet — 2h30.',
    styles: ['fine-line'],
    likes: 147,
    isLiked: true,
    publishedAt: '2026-03-30T09:10:00Z',
  },
  {
    id: 'p3',
    artistId: 'a3',
    artist: { id: 'a3', blaze: 'Karim Nox', city: 'Lyon', avatarUrl: ARTISTS[2].avatarUrl, tier: 'normal' },
    mediaUrl: 'https://images.unsplash.com/photo-1586105251261-72a756497a11?w=600',
    mediaType: 'photo',
    caption: 'Géométrie sacrée avant-bras intérieur. 4h.',
    styles: ['blackwork', 'geometrie'],
    likes: 203,
    isLiked: false,
    publishedAt: '2026-03-31T16:45:00Z',
  },
  {
    id: 'p4',
    artistId: 'a4',
    artist: { id: 'a4', blaze: 'Sofia Reyes', city: 'Barcelone', avatarUrl: ARTISTS[3].avatarUrl, tier: 'premium' },
    mediaUrl: 'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=600',
    mediaType: 'photo',
    caption: 'Portrait chien réaliste cuisse — 7h de travail.',
    styles: ['realisme'],
    likes: 521,
    isLiked: false,
    publishedAt: '2026-04-01T11:00:00Z',
  },
  {
    id: 'p5',
    artistId: 'a1',
    artist: { id: 'a1', blaze: 'Marco Ink', city: 'Paris', avatarUrl: ARTISTS[0].avatarUrl, tier: 'premium' },
    mediaUrl: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600',
    mediaType: 'photo',
    caption: 'Oni mask épaule — début d\'un projet dos complet.',
    styles: ['japonais'],
    likes: 398,
    isLiked: true,
    publishedAt: '2026-04-01T18:30:00Z',
  },
  {
    id: 'p6',
    artistId: 'a2',
    artist: { id: 'a2', blaze: 'Lucie Blanc', city: 'Bordeaux', avatarUrl: ARTISTS[1].avatarUrl, tier: 'normal' },
    mediaUrl: 'https://images.unsplash.com/photo-1604881991720-f91add269bed?w=600',
    mediaType: 'photo',
    caption: 'Lavande aquarelle côte droite.',
    styles: ['aquarelle', 'fine-line'],
    likes: 189,
    isLiked: false,
    publishedAt: '2026-04-02T08:00:00Z',
  },
];

// ─── REQUESTS ─────────────────────────────────────────────────────────────────

export const REQUESTS: TattooRequest[] = [
  {
    id: 'r1',
    clientName: 'Théo M.',
    clientAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100',
    artistId: 'a1',
    projectType: 'new',
    bodyZone: 'Épaule droite',
    sizeCategory: 'm',
    budgetMin: 300,
    budgetMax: 450,
    colorPreference: 'black_grey',
    stylePreference: 'japonais',
    description: 'Je voudrais un tatouage japonais traditionnel sur l\'épaule. Thème : fleurs et vague. Premier tatouage, je suis ouvert aux suggestions.',
    flexibilityLevel: 'open',
    isFirstTattoo: true,
    status: 'submitted',
    submittedAt: '2026-04-01T20:14:00Z',
    references: ['https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=300'],
  },
  {
    id: 'r2',
    clientName: 'Isabelle D.',
    clientAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
    artistId: 'a1',
    projectType: 'new',
    bodyZone: 'Avant-bras gauche',
    sizeCategory: 'l',
    budgetMin: 500,
    budgetMax: 800,
    colorPreference: 'artist_choice',
    stylePreference: 'neo-trad',
    description: 'Manchette florale complète. J\'ai des références précises mais je laisse de la liberté sur la composition. Pas pressée, je peux attendre.',
    flexibilityLevel: 'open',
    isFirstTattoo: false,
    status: 'accepted',
    submittedAt: '2026-03-28T15:30:00Z',
    references: [],
  },
  {
    id: 'r3',
    clientName: 'Lucas B.',
    clientAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
    artistId: 'a1',
    projectType: 'cover_up',
    bodyZone: 'Biceps droit',
    sizeCategory: 'm',
    budgetMin: 150,
    budgetMax: 200,
    colorPreference: 'black_grey',
    stylePreference: 'blackwork',
    description: 'Recouvrement d\'un ancien tatouage tribal. Budget serré.',
    flexibilityLevel: 'precise',
    isFirstTattoo: false,
    status: 'declined',
    submittedAt: '2026-03-25T10:00:00Z',
    references: [],
    declineReason: 'budget_mismatch',
  },
  {
    id: 'r4',
    clientName: 'Emma R.',
    clientAvatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100',
    artistId: 'a1',
    projectType: 'new',
    bodyZone: 'Cheville gauche',
    sizeCategory: 'xs',
    budgetMin: 200,
    budgetMax: 300,
    colorPreference: 'black_grey',
    stylePreference: 'fine-line',
    description: 'Petite constellation ou lune minimaliste.',
    flexibilityLevel: 'full_trust',
    isFirstTattoo: false,
    status: 'clarification_needed',
    submittedAt: '2026-04-02T07:30:00Z',
    references: [],
  },
];

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

export const APPOINTMENTS: Appointment[] = [
  {
    id: 'apt1',
    requestId: 'r2',
    clientName: 'Isabelle D.',
    clientAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
    artistBlaze: 'Marco Ink',
    startsAt: '2026-04-08T10:00:00Z',
    endsAt: '2026-04-08T15:00:00Z',
    status: 'confirmed',
    bodyZone: 'Avant-bras gauche',
    notes: 'Prévoir gabarit de manchette complète. Apporter références.',
  },
  {
    id: 'apt2',
    requestId: 'r5',
    clientName: 'Julien P.',
    clientAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
    artistBlaze: 'Marco Ink',
    startsAt: '2026-04-10T14:00:00Z',
    endsAt: '2026-04-10T17:00:00Z',
    status: 'confirmed',
    bodyZone: 'Sternum',
    notes: undefined,
  },
  {
    id: 'apt3',
    requestId: 'r6',
    clientName: 'Chloé V.',
    clientAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100',
    artistBlaze: 'Marco Ink',
    startsAt: '2026-04-15T09:00:00Z',
    endsAt: '2026-04-15T12:00:00Z',
    status: 'proposed',
    bodyZone: 'Épaule gauche',
    notes: undefined,
  },
];

// ─── MESSAGES ─────────────────────────────────────────────────────────────────

export const MESSAGES_BY_REQUEST: Record<string, Message[]> = {
  r2: [
    {
      id: 'm1',
      senderId: 'system',
      senderName: 'INKR',
      content: 'Ta demande a été acceptée. La conversation est ouverte.',
      messageType: 'system',
      createdAt: '2026-03-29T08:00:00Z',
      isRead: true,
    },
    {
      id: 'm2',
      senderId: 'a1',
      senderName: 'Marco Ink',
      content: 'Bonjour Isabelle. Ton projet m\'intéresse. Est-ce que tu peux m\'envoyer quelques photos de référence pour la composition ? Ça m\'aidera à préparer le gabarit.',
      messageType: 'text',
      createdAt: '2026-03-29T09:15:00Z',
      isRead: true,
    },
    {
      id: 'm3',
      senderId: 'client',
      senderName: 'Isabelle D.',
      content: 'Bonjour ! Oui bien sûr, je t\'envoie ça ce soir. J\'ai surtout des références botaniques avec une dominante de fougères et de roses.',
      messageType: 'text',
      createdAt: '2026-03-29T12:30:00Z',
      isRead: true,
    },
    {
      id: 'm4',
      senderId: 'a1',
      senderName: 'Marco Ink',
      content: 'Parfait. Je te propose deux créneaux pour la première séance.',
      messageType: 'slot_proposal',
      createdAt: '2026-03-30T10:00:00Z',
      isRead: true,
    },
    {
      id: 'm5',
      senderId: 'system',
      senderName: 'INKR',
      content: 'Rendez-vous confirmé · Mardi 8 avril · 10h00 → 15h00',
      messageType: 'appointment_confirmed',
      createdAt: '2026-03-30T14:00:00Z',
      isRead: false,
    },
  ],
  r4: [
    {
      id: 'm10',
      senderId: 'system',
      senderName: 'INKR',
      content: 'Marco Ink a besoin d\'un peu plus d\'information.',
      messageType: 'system',
      createdAt: '2026-04-02T09:00:00Z',
      isRead: true,
    },
    {
      id: 'm11',
      senderId: 'a1',
      senderName: 'Marco Ink',
      content: 'Bonjour Emma. Tu mentionnes une constellation — as-tu une constellation précise en tête, ou tu préfères que je suggère quelque chose selon ta date de naissance ou autre ?',
      messageType: 'text',
      createdAt: '2026-04-02T09:01:00Z',
      isRead: false,
    },
  ],
};

// ─── SIZE LABELS ──────────────────────────────────────────────────────────────

export const SIZE_LABELS: Record<string, string> = {
  xs: 'XS · jusqu\'à 3cm',
  s: 'S · 3 à 7cm',
  m: 'M · 7 à 15cm',
  l: 'L · 15 à 25cm',
  xl: 'XL · 25cm et plus',
};

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  new: 'Nouveau tatouage',
  cover_up: 'Recouvrement',
  touch_up: 'Retouche',
  extension: 'Agrandissement',
};

export const STATUS_LABELS: Record<string, string> = {
  submitted: 'En attente',
  accepted: 'Acceptée',
  declined: 'Refusée',
  clarification_needed: 'Précision demandée',
  archived: 'Archivée',
  completed: 'Terminée',
};

export const DECLINE_REASONS: Record<string, string> = {
  style_mismatch: 'Hors style',
  budget_mismatch: 'Hors budget',
  fully_booked: 'Planning complet',
  too_vague: 'Description trop vague',
  not_feasible: 'Non réalisable',
  other: 'Autre',
};
