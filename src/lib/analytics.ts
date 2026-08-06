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
 * Post-download micro-survey (see `@/lib/survey`), in firing order.
 *
 * Shown: the survey rendered — the denominator for every response rate below.
 * Answered: one question answered; carries `question` and `answer` (both are
 *   fixed tokens from the question definitions, never free text).
 * Completed: both questions answered.
 * Dismissed: closed early; carries `step` so partial drop-off is visible.
 * NextStepClicked: followed one of the "do more than a picture" links.
 * FeedbackOpened: opened the written-feedback form.
 */
export const SurveyEvent = {
  Shown: 'Survey: 1 Shown',
  Answered: 'Survey: 2 Answered',
  Completed: 'Survey: 3 Completed',
  Dismissed: 'Survey: Dismissed',
  NextStepClicked: 'Survey: Next Step Clicked',
  FeedbackOpened: 'Survey: Feedback Opened',
} as const;

export type SurveyEventName = (typeof SurveyEvent)[keyof typeof SurveyEvent];

/**
 * Safely fire a Plausible custom event. No-ops during SSR or if the
 * Plausible script hasn't loaded yet.
 */
export function trackEvent(
  event: FunnelEventName | ShareEventName | SurveyEventName,
  props?: PlausibleProps,
) {
  if (typeof window === 'undefined' || typeof window.plausible !== 'function') {
    return;
  }
  window.plausible(event, props ? { props } : undefined);
}
