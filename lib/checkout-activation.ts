type ArtistStatus = { id: string; artistTier?: string } | null;

const pauseForWebhook = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** Checkout redirects before the subscription webhook is guaranteed to arrive. */
export async function waitForCheckoutActivation(
  expectedUserId: string,
  refreshProfile: () => Promise<void>,
  readUser: () => ArtistStatus,
  pause: (milliseconds: number) => Promise<void> = pauseForWebhook,
  isActive: () => boolean = () => true,
): Promise<boolean> {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (!isActive() || readUser()?.id !== expectedUserId) return false;
    try {
      await refreshProfile();
    } catch {
      return false;
    }
    if (!isActive()) return false;
    const user = readUser();
    if (user?.id !== expectedUserId) return false;
    if (user.artistTier === 'premium') return true;
    if (attempt < 5) await pause(2000);
  }
  return false;
}
