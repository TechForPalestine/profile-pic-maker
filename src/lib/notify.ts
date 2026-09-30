import type { Promoter } from '@/lib/promoters';
import { APP_URL } from '@/lib/share';

/**
 * Tells the approvers' Mattermost channel that a listing request is waiting.
 *
 * `MATTERMOST_WEBHOOK_URL` is a Mattermost incoming webhook, set as a Secret
 * (anyone holding the URL can post to the channel, so it never goes in the
 * repository). Unset: nothing is sent. A failed or slow post is reported to
 * the caller as `false` but never fails the listing request, which is already
 * stored by then; the admin page stays the source of truth.
 */

export const NOTIFY_TIMEOUT_MS = 3000;

/** Only https URLs are accepted, so a typo cannot send the post elsewhere. */
export function webhookUrl(
  value: string | undefined = process.env.MATTERMOST_WEBHOOK_URL,
): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Names are already limited to letters, digits, spaces, dots, apostrophes and
 * hyphens; this is a second guard so no text from the form can ever format
 * the post or mention (@channel) anyone.
 */
function plain(text: string): string {
  return text.replace(/[\\`*_~[\]()<>#|!]/g, '').replace(/@/g, '@​');
}

export function listingMessage(
  promoter: Pick<Promoter, 'code' | 'displayName' | 'link' | 'referredBy'>,
  pendingCount: number,
): string {
  const lines = [
    `:raising_hand: **New leaderboard listing to review:** ${plain(promoter.displayName)}`,
    `Code: \`${plain(promoter.code)}\``,
  ];
  // Shown as code so Mattermost does not fetch a preview of an unchecked URL.
  if (promoter.link) lines.push(`Link: \`${plain(promoter.link)}\``);
  if (promoter.referredBy) {
    lines.push(`Referred by: \`${plain(promoter.referredBy)}\``);
  }
  lines.push(
    `${pendingCount} waiting in total. Review at ${APP_URL}admin/promoters`,
  );
  return lines.join('\n');
}

export async function notifyNewListing(
  promoter: Pick<Promoter, 'code' | 'displayName' | 'link' | 'referredBy'>,
  pendingCount: number,
  url: string | undefined = webhookUrl(),
): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: listingMessage(promoter, pendingCount),
        username: 'PPM Leaderboard',
      }),
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
