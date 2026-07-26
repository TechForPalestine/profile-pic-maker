import { describe, expect, it } from 'vitest';

import {
  APP_URL,
  buildShareLinks,
  shareCaption,
  shareLandingUrl,
} from '@/lib/share';

describe('shareLandingUrl', () => {
  it('tags bare-link shares with just the channel in a compact ref', () => {
    expect(shareLandingUrl('whatsapp')).toBe(`${APP_URL}?ref=whatsapp`);
  });

  it('appends what travelled with image shares to the ref', () => {
    expect(shareLandingUrl('system', 'story')).toBe(
      `${APP_URL}?ref=system-story`,
    );
    expect(shareLandingUrl('system', 'profile')).toBe(
      `${APP_URL}?ref=system-profile`,
    );
  });
});

describe('shareCaption', () => {
  it('ends with the tagged landing URL', () => {
    const caption = shareCaption('copy');
    expect(caption.endsWith(shareLandingUrl('copy'))).toBe(true);
  });

  it('keeps the flag emoji everywhere except WhatsApp', () => {
    // wa.me hand-offs mangled the regional-indicator emoji into "�" in
    // WhatsApp Desktop on macOS.
    expect(shareCaption('whatsapp')).not.toContain('🇵🇸');
    for (const channel of [
      'telegram',
      'x',
      'facebook',
      'copy',
      'system',
    ] as const) {
      expect(shareCaption(channel)).toContain('🇵🇸');
    }
  });

  it('carries the share format through to the URL', () => {
    const caption = shareCaption('system', 'profile');
    expect(caption.endsWith(shareLandingUrl('system', 'profile'))).toBe(true);
  });
});

describe('buildShareLinks', () => {
  const links = Object.fromEntries(
    buildShareLinks().map((link) => [link.channel, link]),
  );

  it('covers the top worldwide networks', () => {
    expect(Object.keys(links).sort()).toEqual([
      'facebook',
      'telegram',
      'whatsapp',
      'x',
    ]);
  });

  it('sends WhatsApp the full caption through wa.me', () => {
    const url = new URL(links.whatsapp.href);
    expect(url.origin + url.pathname).toBe('https://wa.me/');
    expect(url.searchParams.get('text')).toBe(shareCaption('whatsapp'));
  });

  it('sends Telegram the URL and text as separate params', () => {
    const url = new URL(links.telegram.href);
    expect(url.origin + url.pathname).toBe('https://t.me/share/url');
    expect(url.searchParams.get('url')).toBe(shareLandingUrl('telegram'));
    // The text param must not repeat the URL (Telegram renders both).
    expect(url.searchParams.get('text')).not.toContain(APP_URL);
  });

  it('sends X the full caption through the post intent', () => {
    const url = new URL(links.x.href);
    expect(url.origin + url.pathname).toBe('https://x.com/intent/post');
    expect(url.searchParams.get('text')).toBe(shareCaption('x'));
  });

  it('sends Facebook the tagged landing URL through the sharer', () => {
    const url = new URL(links.facebook.href);
    expect(url.origin + url.pathname).toBe(
      'https://www.facebook.com/sharer/sharer.php',
    );
    expect(url.searchParams.get('u')).toBe(shareLandingUrl('facebook'));
  });

  it('every link-out is attributed to the channel it is labelled for', () => {
    for (const { channel, href, label } of buildShareLinks()) {
      expect(label.toLowerCase()).toContain(channel === 'x' ? 'x' : channel);
      expect(href).toContain(`ref%3D${channel}`);
    }
  });
});
