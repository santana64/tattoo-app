import React from 'react';
import { LegalDocument, type LegalSection } from '@/components/v5/LegalDocument';

const SECTIONS: LegalSection[] = [
  {
    title: 'Responsable du traitement',
    body: 'INKR SAS, contact@inkr.app. Hébergement : Supabase (données stockées en Europe).',
  },
  {
    title: 'Données collectées',
    body: 'Adresse email (authentification), nom d’affichage, ville, préférences stylistiques, photos de profil et posts, historique des demandes et rendez-vous, données d’utilisation anonymisées.',
  },
  {
    title: 'Finalité du traitement',
    body: 'Fonctionnement du service, mise en relation artiste-client, envoi de notifications, amélioration de l’application, prévention de la fraude.',
  },
  {
    title: 'Base légale',
    body: 'Exécution du contrat (art. 6.1.b RGPD) pour les fonctionnalités essentielles. Consentement (art. 6.1.a RGPD) pour les notifications et communications marketing.',
  },
  {
    title: 'Durée de conservation',
    body: 'Données de compte : durée de l’inscription + 3 ans. Données de transaction : 10 ans (obligation légale). Données anonymisées : durée indéterminée.',
  },
  {
    title: 'Vos droits',
    body: 'Conformément au RGPD, vous disposez d’un droit d’accès, de rectification, de suppression, d’opposition et de portabilité. Exercez vos droits via l’application (Paramètres > Confidentialité) ou par email : privacy@inkr.app.',
  },
  {
    title: 'Cookies et traceurs',
    body: 'L’application n’utilise pas de cookies. Des données d’utilisation anonymisées sont collectées pour améliorer l’expérience.',
  },
  {
    title: 'Partage de données',
    body: 'Vos données ne sont jamais vendues. Partage uniquement avec les prestataires nécessaires (Supabase, Stripe pour les paiements).',
  },
  {
    title: 'Modifications',
    body: 'INKR se réserve le droit de modifier cette politique. Vous serez notifié des changements importants.',
  },
  {
    title: 'Contact DPO',
    body: 'privacy@inkr.app — CNIL : www.cnil.fr',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocument
      headerTitle="Confidentialité"
      kicker="Informations légales"
      title="Politique de"
      emphasis="confidentialité"
      updated="Dernière mise à jour : 1er avril 2026"
      sections={SECTIONS}
    />
  );
}
