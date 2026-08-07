import type { Metadata } from 'next';

import LandingShell from '../landing-shell';

export const metadata: Metadata = {
  title: 'Palestine Facebook Profile Frame (Frames Feature Replacement)',
  description:
    'Facebook retired its profile frames. Add a Palestine flag frame to your photo here instead, then upload it as your Facebook profile picture. Free and browser-only.',
  alternates: { canonical: '/palestine-facebook-frame' },
  openGraph: {
    title: 'Palestine Facebook Profile Frame (Frames Feature Replacement)',
    description:
      'Facebook removed profile frames. Frame your photo here and upload it as your Facebook profile picture. Free, no account.',
    url: '/palestine-facebook-frame',
    siteName: 'Palestine Profile Pic Maker 🇵🇸',
    images: '/social-card.png',
    type: 'website',
  },
};

export default function PalestineFacebookFramePage() {
  return (
    <LandingShell
      heading="Palestine Facebook Profile Frame"
      tagline="Facebook removed profile frames. Here is what to use instead."
      ctaLabel="Frame my Facebook picture"
      path="/palestine-facebook-frame"
    >
      <p>
        Facebook used to let you apply a frame to your profile picture from
        inside the app, and campaigns published flag overlays you could search
        for by name. That feature has been discontinued, which is why the
        Palestine frames people remember can no longer be found in
        Facebook&apos;s frame picker.
      </p>
      <p>
        This free tool does the framing part itself. You give it your photo, it
        draws the Palestinian flag ring around the edge, and you download a
        finished picture. Facebook is then only involved at the last step, where
        you set that picture as your profile photo like any other upload.
      </p>
      <p>
        On the Facebook app: tap your profile picture, choose{' '}
        <em>Select profile picture</em>, and pick the file you just downloaded.
        On a computer: go to your profile, click the camera icon on your picture
        and upload the same file. Facebook crops profile pictures into a circle
        and the frame is drawn to match, so nothing important gets cut off.
      </p>
      <p>
        The result is an ordinary PNG, so it is not locked to one network. The
        same file works on Instagram, WhatsApp, X, LinkedIn and anywhere else.
        Your photo is framed inside your browser and never uploaded to us, and
        your original file is left exactly as it was.
      </p>
    </LandingShell>
  );
}
