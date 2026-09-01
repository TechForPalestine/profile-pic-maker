export enum SocialPlatform {
  Twitter = 'twitter',
  Github = 'github',
  Gitlab = 'gitlab',
  Bluesky = 'bluesky',
}

/**
 * Where a share was initiated from.
 * - system: the OS share sheet (Web Share API) — covers WhatsApp chats &
 *   status, Instagram Stories, Messenger, Telegram, SMS, etc. on mobile.
 * - whatsapp/telegram/x/facebook: web link-outs (desktop fallback).
 * - copy: caption + link copied to the clipboard.
 * - download: the story image saved to disk for manual posting.
 */
export type ShareChannel =
  'system' | 'whatsapp' | 'telegram' | 'x' | 'facebook' | 'copy' | 'download';

/** What was shared: the framed picture, the 9:16 story card, or just a link. */
export type ShareFormat = 'profile' | 'story' | 'link';

/** Shape used for the generated profile picture. */
export type FrameShape = 'circle' | 'original';
