# Instantané du backend déployé

Copie, prise le 11 novembre 2026, de ce qui tourne réellement sur le projet Supabase `jxmefklkixzzdceeorcg` et dont le code source ne figure nulle part ailleurs dans ce dépôt.

**Ce dossier est une sauvegarde, pas du code actif.** Rien ici n'est déployé par les scripts du projet. Les fonctions de `supabase/functions/` sont une autre version, plus simple, écrite dans ce dépôt.

## Fonctions edge (`functions/`)

Téléchargées telles quelles depuis le tableau de bord (Edge Functions → Download as ZIP). Elles dataient de cinq à six mois au moment de la copie.

| Fonction | Rôle | Présente dans `supabase/functions/` |
|---|---|---|
| `create-billing-portal-session` | Portail de facturation Stripe | non |
| `create-checkout-session` | Abonnement Premium | oui, version différente |
| `create-deposit-checkout` | Acompte sur un rendez-vous, avec e-mail | non |
| `create-flash-checkout` | Réservation d'un flash | non |
| `healed-photo-reminders` | Rappels de photo cicatrisée | non |
| `payment-return` | Retour de paiement | non |
| `send-push` | Notifications push | oui, version différente |
| `stripe-webhook` | Webhook Stripe complet, avec e-mails | oui, version différente |

Secrets attendus par ces fonctions : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `INTERNAL_FUNCTION_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.

## Base de données

La base contient 32 tables. Celles en gras n'existent dans aucune migration de ce dépôt :

`appointments`, `artist_analytics_events`, `artist_availability`, `artist_faq`, **`artist_reviews`**, **`artist_waitlist`**, **`artist_weekly_schedule`**, `artists` (37 colonnes), **`deposits`**, **`flash_bookings`**, **`flash_designs`**, **`guest_spots`**, **`healed_photo_reminders`**, **`healed_photos`**, **`message_templates`**, `messages`, **`notification_preferences`**, `notifications`, **`open_slots`**, `post_likes`, `posts`, `profiles` (14 colonnes), `push_tokens`, `reports`, `request_references`, `reviews`, `saved_artists`, `saved_posts`, **`stories`**, **`story_views`**, `subscriptions`, `tattoo_requests` (25 colonnes).

Fonctions SQL propres à cette version : `create_default_message_templates_for_artist`, `insert_default_message_templates`, `increment_story_view_count`, `notify_waitlist_on_open_slot`, `process_pending_account_deletions`, `queue_healed_photo_reminder`, `set_healed_photo_parties`, `sync_deposit_paid`, `sync_flash_sold_copies`, et les fonctions `*_set_updated_at`.

Le schéma complet (définitions des tables, règles RLS, corps des fonctions) n'est pas dans ce dossier. Pour l'exporter :

```bash
npx supabase db dump --project-ref jxmefklkixzzdceeorcg -f supabase/deployed-snapshot/schema.sql
```

## Point d'attention

Les migrations `002` à `010` de ce dépôt ont été appliquées sur cette base le 11 novembre 2026. La migration `005` limite la lecture et l'écriture de `profiles`, `artists` et `posts` aux colonnes connues de ce dépôt : les colonnes supplémentaires de ces trois tables ne sont plus accessibles par l'API tant que des droits ne leur sont pas rendus explicitement.

`process_pending_account_deletions` indique que cette version gérait une suppression de compte différée, alors que l'écran actuel supprime immédiatement.
