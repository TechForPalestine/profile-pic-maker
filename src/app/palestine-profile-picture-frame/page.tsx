import type { Metadata } from 'next';

import LandingShell from '../landing-shell';

export const metadata: Metadata = {
  title: 'Palestine Profile Picture Frame, Free and No Sign-Up',
  description:
    'Put a Palestine flag frame around your profile picture in under a minute. Free, no account, and your photo is framed inside your browser instead of being uploaded.',
  alternates: { canonical: '/palestine-profile-picture-frame' },
  openGraph: {
    title: 'Palestine Profile Picture Frame, Free and No Sign-Up',
    description:
      'Frame your profile picture with the colours of Palestine. Free, browser-only, works on every platform.',
    url: '/palestine-profile-picture-frame',
    siteName: 'Palestine Profile Pic Maker 🇵🇸',
    images: '/social-card.png',
    type: 'website',
  },
};

export default function PalestineProfilePictureFramePage() {
  return (
    <LandingShell
      heading="Palestine Profile Picture Frame"
      tagline="Wrap your photo in the colours of the Palestinian flag. 🇵🇸"
      ctaLabel="Make my profile picture"
      path="/palestine-profile-picture-frame"
    >
      <p>
        The frame is a ring in the colours of the Palestinian flag (red, black,
        white and green) that sits around the edge of the photo you already use.
        You keep your face; the flag goes around it. It was drawn to stay
        readable at the size profile pictures are actually seen at, roughly the
        width of a thumbnail in a timeline.
      </p>
      <p>
        Making one takes three steps. Open the maker, give it a photo, and
        download the result. The photo can come from your device, or from the
        picture you already use on X, GitHub, GitLab or Bluesky. There is no
        sign-up, no email address and nothing to pay.
      </p>
      <p>
        Your photo stays with you. Your browser reads the file, draws the framed
        version on a canvas in the page, and hands you the finished image. It is
        never sent to a server, so there is nothing for anyone to store.
      </p>
      <p>
        What you download is a square PNG with transparent corners, which is
        what every platform expects: X, Instagram, Facebook, LinkedIn, WhatsApp,
        TikTok, Threads, Bluesky, Discord, Slack. Upload the same file
        everywhere. Changing your mind later is easy too, because your original
        photo is untouched and you can simply set it back.
      </p>
    </LandingShell>
  );
}
