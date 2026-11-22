// Checkout return URLs must be explicit and symmetric for Web clients.
// Native clients omit both URLs and use the fixed HTTPS-to-deep-link bridge.
export interface CheckoutReturnUrls {
  successUrl: string;
  cancelUrl: string;
}

function isExpectedWebUrl(
  value: unknown,
  expected: 'success' | 'cancel',
  allowed: (value: unknown) => value is string,
): value is string {
  if (typeof value !== 'string' || !allowed(value)) return false;
  try {
    const url = new URL(value);
    // Stripe-hosted Checkout requires HTTPS, including for test mode.
    return url.protocol === 'https:'
      && url.username === ''
      && url.password === ''
      && url.pathname === '/settings/subscription'
      && url.searchParams.toString() === `checkout=${expected}`
      && url.hash === '';
  } catch {
    return false;
  }
}

export function resolveCheckoutReturnUrls(
  body: Record<string, unknown>,
  allowed: (value: unknown) => value is string,
  bridge: (target: string) => string,
): CheckoutReturnUrls | null {
  const hasWebReturn = Object.prototype.hasOwnProperty.call(body, 'successUrl')
    || Object.prototype.hasOwnProperty.call(body, 'cancelUrl');
  if (hasWebReturn) {
    // Never silently convert an invalid Web checkout into a native deep link.
    if (!isExpectedWebUrl(body.successUrl, 'success', allowed)
      || !isExpectedWebUrl(body.cancelUrl, 'cancel', allowed)) return null;
    return { successUrl: body.successUrl, cancelUrl: body.cancelUrl };
  }
  return {
    successUrl: bridge('settings/subscription?checkout=success'),
    cancelUrl: bridge('settings/subscription?checkout=cancelled'),
  };
}
