import type { Metadata } from 'next';

import LandingShell from '../landing-shell';

export const metadata: Metadata = {
  title: 'Palestine Flag Border for Your Profile Pic',
  description:
    'Add a Palestinian flag border to any photo and download a square PNG. Free, no account needed, and the picture is made on your device rather than on a server.',
  alternates: { canonical: '/palestine-flag-border' },
  openGraph: {
    title: 'Palestine Flag Border for Your Profile Pic',
    description:
      'Add a Palestinian flag border to any photo and download it as a PNG. Free and made entirely on your device.',
    url: '/palestine-flag-border',
    siteName: 'Palestine Profile Pic Maker 🇵🇸',
    images: '/social-card.png',
    type: 'website',
  },
};

export default function PalestineFlagBorderPage() {
  return (
    <LandingShell
      heading="Palestine Flag Border for Your Profile Pic"
      tagline="A clean flag border around any picture, downloaded as a PNG."
      ctaLabel="Add the flag border"
      path="/palestine-flag-border"
    >
      <p>
        The border is a circular band carrying the four colours of the
        Palestinian flag. It hugs the outer edge of the picture and leaves the
        middle alone, so whatever is in the photo stays fully visible. The
        border adds to it rather than covering it up.
      </p>
      <p>
        It does not have to be a portrait. People use it on team logos, shop
        avatars, pets, illustrations and campaign artwork. Anything square works
        best; a photo that is taller or wider than it is high gets centred and
        cropped into the circle, so pick one where the subject sits near the
        middle.
      </p>
      <p>
        You get a square PNG back, with the corners outside the circle left
        transparent. That matters on platforms that crop avatars into a circle:
        the band lands exactly on the edge instead of being sliced off. The same
        file uploads anywhere you have a profile: social networks, messaging
        apps, work tools, forums.
      </p>
      <p>
        Everything happens in this browser tab. Your photo is read locally and
        drawn onto a canvas on the page; no copy of it is uploaded or kept. The
        tool is free, needs no account, and is open source under the MIT licence
        so you can read exactly what it does.
      </p>
    </LandingShell>
  );
}
