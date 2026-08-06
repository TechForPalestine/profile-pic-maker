type PlausibleProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: PlausibleProps; callback?: () => void },
    ) => void;
  }
}

/**
 * Funnel events tracked end to end in Plausible, in firing order. The
 * numeric prefix keeps them ordered in the Plausible dashboard.
 *
 * Landed: visitor opens the page.
 * SourceSelected: clicks a "pick a photo" button (upload or a social platform).
 * PhotoProvided: commits input (chooses a file / submits a username).
 * PhotoFetched: a usable source is obtained (data URL / social profile URL).
 * PreviewShown: that photo actually renders on screen.
 * Downloaded: the final framed image is downloaded (carries `branding`:
 *   whether the short URL was baked into the ring).
 */
export const FunnelEvent = {
  Landed: 'Funnel: 1 Landed',
  SourceSelected: 'Funnel: 2 Source Selected',
  PhotoProvided: 'Funnel: 3 Photo Provided',
  PhotoFetched: 'Funnel: 4 Photo Fetched',
  PreviewShown: 'Funnel: 5 Preview Shown',
  Downloaded: 'Funnel: 6 Downloaded',
  // Not a funnel step: user resets to pick a different photo.
  StartOver: 'Start Over',
  // Not a funnel step: user turned the ring's short URL on or off. Carries
  // `branding` ('on' / 'off') — the state it was switched *to*.
  BrandingToggled: 'Branding Toggled',
} as const;

export type FunnelEventName = (typeof FunnelEvent)[keyof typeof FunnelEvent];

/**
 * Share funnel — tracked separately from the creation funnel above, in
 * firing order. All events carry `channel` / `format` props (see
 * `ShareChannel` / `ShareFormat` in `@/types`) plus `method` (the photo
 * source, same as the creation funnel).
 *
 * OptionsShown: the share panel rendered (user downloaded their picture).
 * Clicked: user activated a share action (share sheet, link-out, copy,
 *   story download).
 */
export const ShareEvent = {
  OptionsShown: 'Share: 1 Options Shown',
  Clicked: 'Share: 2 Clicked',
} as const;

export type ShareEventName = (typeof ShareEvent)[keyof typeof ShareEvent];

/**
 * Safely fire a Plausible custom event. No-ops during SSR or if the
 * Plausible script hasn't loaded yet.
 */
export function trackEvent(
  event: FunnelEventName | ShareEventName,
  props?: PlausibleProps,
) {
  if (typeof window === 'undefined' || typeof window.plausible !== 'function') {
    return;
  }
  window.plausible(event, props ? { props } : undefined);
}
