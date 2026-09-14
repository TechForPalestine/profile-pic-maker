/**
 * Cloudflare Turnstile verification for the join form.
 *
 * Turnstile is the only bot check in the app and it guards a single action:
 * asking to be listed on the leaderboard. Generating a link needs no check
 * because it stores nothing.
 *
 * With `TURNSTILE_SECRET` unset (local dev, preview builds without secrets)
 * verification is skipped and the join route logs that once, so the form can
 * be exercised end to end without Cloudflare keys.
 */

/** Public widget key. Unset means the widget is not rendered at all. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

let warnedAboutMissingSecret = false;

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp: string | undefined,
  secret: string | undefined = process.env.TURNSTILE_SECRET,
): Promise<boolean> {
  if (!secret) {
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      console.warn(
        'TURNSTILE_SECRET is not set: join requests are accepted without a bot check.',
      );
    }
    return true;
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
    if (!res.ok) return false;
    const result = (await res.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
