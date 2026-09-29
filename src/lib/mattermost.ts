/**
 * Mattermost alert for approvers: one message per new listing request.
 *
 * Uses an incoming webhook, so the only credential is the webhook URL itself
 * (keep it a Secret: anyone holding it can post to the channel). With
 * `MATTERMOST_WEBHOOK_URL` unset (local dev, previews) nothing is sent.
 *
 * A failed or slow post never fails the join request: the entry is already
 * saved and still shows up on /admin/promoters.
 */

import { APP_URL } from '@/lib/share';
import type { Promoter } from '@/lib/promoters';

const TIMEOUT_MS = 5000;

export function pendingPromoterMessage(
  promoter: Pick<Promoter, 'code' | 'displayName' | 'link' | 'referredBy'>,
  pendingCount: number,
  appUrl: string = APP_URL,
): string {
  // Display names and codes are limited to letters, digits and a little
  // punctuation (validateJoinRequest), so they cannot carry @mentions or
  // markdown links. The link is shown bare and Mattermost autolinks it.
  const lines = [
    `#### New leaderboard request: ${promoter.displayName}`,
    `Code: \`${promoter.code}\``,
    `Link: ${promoter.link ?? 'none'}`,
  ];
  if (promoter.referredBy) {
    lines.push(`Referred by: \`${promoter.referredBy}\``);
  }
  lines.push(
    `Waiting for review: ${pendingCount}`,
    `Review it at ${new URL('admin/promoters', appUrl)}`,
  );
  return lines.join('\n');
}

/** Posts the alert. Resolves to whether Mattermost accepted it. */
export async function notifyPendingPromoter(
  promoter: Pick<Promoter, 'code' | 'displayName' | 'link' | 'referredBy'>,
  pendingCount: number,
  webhookUrl: string | undefined = process.env.MATTERMOST_WEBHOOK_URL,
): Promise<boolean> {
  if (!webhookUrl) return false;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: pendingPromoterMessage(promoter, pendingCount),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`Mattermost webhook answered ${res.status}.`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Mattermost webhook failed.', error);
    return false;
  }
}
