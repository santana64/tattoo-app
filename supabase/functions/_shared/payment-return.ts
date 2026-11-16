const ALLOWED_TARGETS = new Set([
  'settings/subscription?checkout=success',
  'settings/subscription?checkout=cancelled',
]);

export function paymentReturnDeepLink(target: string | null): string {
  return `inkr://${target && ALLOWED_TARGETS.has(target) ? target : 'settings/subscription'}`;
}
