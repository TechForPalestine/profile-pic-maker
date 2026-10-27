import type { ComponentType } from 'react';

import MemberTag from './member-tag';

/**
 * Co-branded overlays, keyed by the brand id `BRAND_LINKS` maps link codes
 * to (see `@/lib/brands`). Each one replaces the ring's short URL.
 *
 * `text` holds the defaults; the secret can override any key without a code
 * change. `label` and `hint` are the checkbox shown to people who came through
 * the link; every other key is the overlay's own.
 */
export type BrandText = { label: string; hint: string } & Record<
  string,
  string
>;

export interface Brand {
  Overlay: ComponentType<{ text: BrandText }>;
  text: BrandText;
}

export const BRANDS: Record<string, Brand> = {
  't4p-member': {
    Overlay: MemberTag,
    text: {
      label: 'Add the “Hello, I’m a T4P member” name tag',
      hint: 'With a join link along the bottom of the frame.',
      // t4p.al/j redirects to the membership page. Around 25 characters fit
      // on the arc.
      link: 'Join at https://t4p.al/j',
    },
  },
};
