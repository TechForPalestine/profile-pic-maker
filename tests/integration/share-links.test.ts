import { describe, expect, it } from 'vitest';

import {
  APP_URL,
  buildShareLinks,
  shareCaption,
  shareLandingUrl,
} from '@/lib/share';

describe('shareLandingUrl', () => {
  it('tags the landing URL with standard UTM params', () => {
    const url = new URL(shareLandingUrl('whatsapp'));
    expect(url.origin + url.pathname).toBe(APP_URL);
    expect(url.searchParams.get('utm_source')).toBe('whatsapp');
    expect(url.searchParams.get('utm_medium')).toBe('social');
    expect(url.searchParams.get('utm_campaign')).toBe('profile-pic-share');
    expect(url.searchParams.get('utm_content')).toBe('link');
  });

  it('records what travelled with the share in utm_content', () => {
    const url = new URL(shareLandingUrl('system', 'story'));
    expect(url.searchParams.get('utm_source')).toBe('system');
    expect(url.searchParams.get('utm_content')).toBe('story');
  });
});

describe('shareCaption', () => {
  it('ends with the tagged landing URL', () => {
    const caption = shareCaption('copy');
    expect(caption.endsWith(shareLandingUrl('copy'))).toBe(true);
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
      expect(href).toContain(`utm_source%3D${channel}`);
    }
  });
});
