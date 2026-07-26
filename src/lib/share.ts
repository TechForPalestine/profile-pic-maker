import { ShareChannel, ShareFormat } from '@/types';

// Full canonical URL, used on every shared/copied link so previews and
// redirects behave predictably.
export const APP_URL = 'https://ppm.techforpalestine.org/';

// Short human-readable address shown on the story card, where people
// retype what they see. Must redirect to the app.
export const STORY_URL_LABEL = 'ppm.t4p.al';

/**
 * The message shared alongside the picture / link, without the URL.
 * Kept separate because some share targets (e.g. Telegram's share
 * endpoint) take the URL as its own parameter.
 *
 * WhatsApp gets the emoji-free variant: the 🇵🇸 flag arrived as "�" in
 * WhatsApp Desktop on macOS — the wa.me hand-off doesn't decode
 * regional-indicator emoji reliably. Every other channel keeps the flag.
 */
export const SHARE_MESSAGE =
  'I framed my profile picture in solidarity with Palestine 🇵🇸 Make yours too:';
export const SHARE_MESSAGE_PLAIN =
  'I framed my profile picture in solidarity with Palestine. Make yours too:';

export function shareMessage(channel: ShareChannel): string {
  return channel === 'whatsapp' ? SHARE_MESSAGE_PLAIN : SHARE_MESSAGE;
}

/**
 * Landing URL tagged with a single compact `ref` param, which Plausible
 * reads as the traffic source (same field as utm_source) — no user
 * tracking involved. Bare-link shares are tagged with just the channel
 * (`?ref=whatsapp`); image shares append what travelled with them
 * (`?ref=system-story`), since the share sheet can't tell us the
 * destination app.
 */
export function shareLandingUrl(
  channel: ShareChannel,
  format: ShareFormat = 'link',
): string {
  const ref = format === 'link' ? channel : `${channel}-${format}`;
  return `${APP_URL}?ref=${ref}`;
}

export function shareCaption(
  channel: ShareChannel,
  format: ShareFormat = 'link',
): string {
  return `${shareMessage(channel)} ${shareLandingUrl(channel, format)}`;
}

export interface ShareLink {
  channel: Extract<ShareChannel, 'whatsapp' | 'telegram' | 'x' | 'facebook'>;
  label: string;
  href: string;
}

/**
 * Web link-outs for the top worldwide networks. These share the caption +
 * link only (web intents can't attach an image); the OS share sheet is the
 * image path. wa.me and t.me work on mobile and desktop (WhatsApp
 * Web/Desktop), so these double as the desktop share path.
 */
export function buildShareLinks(): ShareLink[] {
  return [
    {
      channel: 'whatsapp',
      label: 'Share on WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(shareCaption('whatsapp'))}`,
    },
    {
      channel: 'telegram',
      label: 'Share on Telegram',
      href: `https://t.me/share/url?url=${encodeURIComponent(
        shareLandingUrl('telegram'),
      )}&text=${encodeURIComponent(SHARE_MESSAGE)}`,
    },
    {
      channel: 'x',
      label: 'Share on X',
      href: `https://x.com/intent/post?text=${encodeURIComponent(shareCaption('x'))}`,
    },
    {
      channel: 'facebook',
      label: 'Share on Facebook',
      // Facebook strips pre-filled text by platform policy — the post body
      // must be typed by the user, and the preview comes from the landing
      // page's Open Graph card. `quote` is passed for the few surfaces that
      // still honour it.
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        shareLandingUrl('facebook'),
      )}&quote=${encodeURIComponent(SHARE_MESSAGE)}`,
    },
  ];
}

/**
 * Whether this browser can hand an image file to the OS share sheet
 * (Web Share API level 2). True on Android Chrome, iOS Safari, and desktop
 * Safari/Chrome on macOS/Windows; false on Firefox and older browsers.
 */
export function canShareImageFiles(): boolean {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.canShare !== 'function'
  ) {
    return false;
  }
  try {
    const probe = new File([''], 'probe.png', { type: 'image/png' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function dataUrlToFile(
  dataUrl: string,
  filename: string,
): Promise<File> {
  const blob = await fetch(dataUrl).then((res) => res.blob());
  return new File([blob], filename, { type: blob.type || 'image/png' });
}
