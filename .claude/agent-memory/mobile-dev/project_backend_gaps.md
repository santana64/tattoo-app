---
name: project-backend-gaps
description: INKR account/pro screens whose UI exists but backend does not (account deletion, prefs persistence, billing management) as of 2026-10-11
metadata:
  type: project
---

As of 2026-10-11 (Galerie noire redesign), several INKR settings screens are UI-only:
- `settings/delete-account` handler only calls `signOut()`; no deletion/deactivation exists server-side (App Store 5.1.1(v) / RGPD blocker).
- Notification, privacy and customization toggles are local state, never persisted (customization reads real `artists` columns but cannot save).
- No billing portal: subscription management routes to support; `setArtistTier` in auth-store is a client-side tier write (security issue).

**Why:** redesign brief was presentation-only; screens were relabelled honestly (notices) instead of faking success.
**How to apply:** when touching these screens, don't reintroduce fake confirmations; if asked to "finish" them, these are the backend pieces to build first.
