import React from 'react';
import { LegalDocument, type LegalSection } from '@/components/v5/LegalDocument';

const SECTIONS: LegalSection[] = [
  {
    title: 'Objet',
    body: 'INKR est une plateforme de mise en relation entre tatoueurs professionnels et clients. L’application permet la découverte d’artistes, l’envoi de demandes de tatouage et la gestion de rendez-vous.',
  },
  {
    title: 'Inscription et compte',
    body: 'L’accès aux fonctionnalités nécessite la création d’un compte. L’utilisateur s’engage à fournir des informations exactes. Chaque personne ne peut posséder qu’un seul compte.',
  },
  {
    title: 'Utilisation de la plateforme',
    body: 'L’utilisation d’INKR est réservée aux personnes majeures (18 ans ou plus). Il est interdit d’utiliser la plateforme pour publier des contenus illégaux, choquants ou contraires aux bonnes mœurs.',
  },
  {
    title: 'Contenu utilisateur',
    body: 'En publiant du contenu sur INKR, l’utilisateur accorde à INKR une licence non-exclusive d’utilisation. L’utilisateur reste propriétaire de son contenu.',
  },
  {
    title: 'Abonnement Premium',
    body: 'L’abonnement Premium est proposé aux tatoueurs. Il est sans engagement et résiliable à tout moment. Le paiement est effectué via Apple Pay ou carte bancaire.',
  },
  {
    title: 'Responsabilité',
    body: 'INKR agit en qualité d’intermédiaire et ne peut être tenu responsable des actes des tatoueurs ou clients inscrits sur la plateforme.',
  },
  {
    title: 'Résiliation',
    body: 'INKR se réserve le droit de suspendre ou supprimer tout compte en violation des présentes conditions.',
  },
  {
    title: 'Contact',
    body: 'Pour toute question : contact@inkr.app',
  },
];

export default function TermsScreen() {
  return (
    <LegalDocument
      headerTitle="Conditions d’utilisation"
      kicker="Informations légales"
      title="Conditions"
      emphasis="d’utilisation"
      updated="Dernière mise à jour : 1er avril 2026"
      sections={SECTIONS}
    />
  );
}
