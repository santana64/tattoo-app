// Domain types, the style catalogue and display labels shared across screens.
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

// ─── LABELS ──────────────────────────────────────────────────────────────────

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
