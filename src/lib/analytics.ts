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
 * Downloaded: the final framed image is downloaded.
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
} as const;

export type FunnelEventName = (typeof FunnelEvent)[keyof typeof FunnelEvent];

/**
 * Safely fire a Plausible custom event. No-ops during SSR or if the
 * Plausible script hasn't loaded yet.
 */
export function trackEvent(event: FunnelEventName, props?: PlausibleProps) {
  if (typeof window === 'undefined' || typeof window.plausible !== 'function') {
    return;
  }
  window.plausible(event, props ? { props } : undefined);
}
