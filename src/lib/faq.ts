/**
 * The questions people actually ask before they trust a tool with their photo.
 *
 * Answers are plain strings on purpose: the same text is rendered on the page
 * *and* emitted as FAQPage structured data (see `@/lib/structured-data`), and
 * Google only accepts structured-data answers that are visible on the page. One
 * source of text keeps the two provably identical.
 */
export const FAQ_ITEMS = [
  {
    // Verified against the implementation: `handleImageUpload` in
    // `profile-pic-maker.tsx` reads the file with a `FileReader` into a data
    // URL, `next/image` skips the optimizer for `data:` sources, and
    // html-to-image rasterises the framed picture on a canvas in the page. No
    // request carries the photo. The one call that does leave the browser is
    // the optional social-avatar lookup, which sends a username, hence the
    // second half of this answer.
    question: 'Is my photo uploaded anywhere?',
    answer:
      'No. When you pick a photo from your device, your browser reads the file locally and draws the framed version on a canvas in the same tab. The photo is never sent to our servers, so there is nothing for us to store, log or lose. The one request that does leave your browser is optional: if you ask the tool to pull in your existing avatar from X, GitHub, GitLab or Bluesky, we pass that username to our server to look up the public avatar for you.',
  },
  {
    question: 'Is this free? Do I need an account?',
    answer:
      'It is completely free, with no account, no email address and no sign-in. There is no paid tier, no watermark unless you tick the box to add ppm.t4p.al to the ring, and no limit on how many pictures you make. The tool is open source under the MIT licence and maintained by the Tech For Palestine collective.',
  },
  {
    question: 'Which platforms does the framed picture work on?',
    answer:
      'Any platform that takes a profile picture: X, Instagram, Facebook, LinkedIn, WhatsApp, TikTok, Threads, Bluesky, Telegram, Signal, Discord, Slack, GitHub and the rest. You download one square PNG and upload it wherever you like. The area outside the circle is transparent, so the flag ring still sits neatly at the edge on the platforms that crop profile pictures into a circle.',
  },
  {
    question: 'What image formats and sizes work best?',
    answer:
      'JPG, PNG, WebP and GIF all work, along with anything else your browser can display. A square photo of at least 400 by 400 pixels gives the sharpest result, because the picture is rendered at your screen density and then downloaded as a PNG. Photos that are not square are centred and cropped to a circle, so choose one where your face is roughly in the middle rather than off to one side.',
  },
  {
    question: 'How do I go back to my old profile picture?',
    answer:
      'Upload your original photo to the platform again. The tool never touches that file: it leaves your photo exactly where it was on your device and gives you a separate, framed copy to download. The frame is part of that new image, so it cannot be peeled off afterwards, which is why keeping the original is worth doing. If you want a different version instead, hit Start Over and run your photo through again.',
  },
  {
    question: 'Does this replace the Facebook profile frames feature?',
    answer:
      'It covers the same need. Facebook retired its profile frames, so the old flag overlays you used to apply inside the app are gone. This tool does the framing itself and hands you a finished PNG, which you then set as your Facebook profile picture the ordinary way. Because the result is just an image file, the same picture works on every other platform too.',
  },
] as const;
