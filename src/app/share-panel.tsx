'use client';
import { ShareEvent, trackEvent } from '@/lib/analytics';
import {
  STORY_URL_LABEL,
  buildShareLinks,
  canShareImageFiles,
  dataUrlToFile,
  shareCaption,
} from '@/lib/share';
import { ShareChannel, ShareFormat } from '@/types';
import download from 'downloadjs';
import { toPng } from 'html-to-image';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  FaDownload,
  FaFacebookF,
  FaRegCopy,
  FaShareNodes,
  FaTelegram,
  FaWhatsapp,
  FaXTwitter,
} from 'react-icons/fa6';

// Official brand colours make the row instantly recognisable.
const CHANNEL_STYLES = {
  whatsapp: { Icon: FaWhatsapp, background: '#25D366' },
  telegram: { Icon: FaTelegram, background: '#229ED9' },
  x: { Icon: FaXTwitter, background: '#000000' },
  facebook: { Icon: FaFacebookF, background: '#1877F2' },
} as const;

// Palestine flag colours, cycled across the confetti pieces.
const CONFETTI_COLORS = ['#E4312B', '#149954', '#000000'];
const CONFETTI_PIECES = Array.from({ length: 24 }, (_, i) => ({
  // Deterministic pseudo-random spread — no Math.random so renders are stable.
  left: `${(i * 41 + 13) % 100}%`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: `${(i % 6) * 0.12}s`,
  width: `${6 + (i % 3) * 3}px`,
  height: `${10 + ((i + 1) % 3) * 3}px`,
}));

interface SharePanelProps {
  userImageUrl: string;
  /** Photo source (upload / social platform), mirrored into event props. */
  method: string;
  /** Rasterises the framed 1:1 profile picture (same node the download uses). */
  generateProfileImage: () => Promise<string | undefined>;
}

export default function SharePanel({
  userImageUrl,
  method,
  generateProfileImage,
}: SharePanelProps) {
  const storyRef = useRef<HTMLDivElement>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [busyAction, setBusyAction] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  // Memoised per mounted picture: rasterising is slow, and iOS only allows
  // navigator.share() during (transient) user activation — so the files are
  // prepared eagerly and the click handler awaits an already-settled promise.
  const preparedFiles = useRef<{
    profile?: Promise<File | undefined>;
    story?: Promise<File | undefined>;
  }>({});

  const generateStoryImage = async () => {
    const render = async () => {
      try {
        // Same includeQueryParams rationale as the profile render (issue #35);
        // pixelRatio 3 turns the 360x640 node into a 1080x1920 story image.
        return await toPng(storyRef.current as HTMLElement, {
          includeQueryParams: true,
          pixelRatio: 3,
        });
      } catch (error) {
        console.log('Error generating story image', error);
      }
    };
    // Repeated renders for the same reason as the profile picture: the first
    // rasterisations can come back incomplete while resources warm up.
    await render();
    await render();
    await render();
    return render();
  };

  const prepareFile = (format: 'profile' | 'story') => {
    if (!preparedFiles.current[format]) {
      const generate =
        format === 'story' ? generateStoryImage : generateProfileImage;
      preparedFiles.current[format] = generate().then((dataUrl) =>
        dataUrl
          ? dataUrlToFile(dataUrl, `palestine-${format}-pic.png`)
          : undefined,
      );
    }
    return preparedFiles.current[format];
  };

  useEffect(() => {
    // Web Share API detection needs the browser (unavailable during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanNativeShare(canShareImageFiles());
    trackEvent(ShareEvent.OptionsShown, { method });
    prepareFile('profile');
    prepareFile('story');
    // Drop the confetti from the DOM once the burst has played out.
    const confettiTimer = setTimeout(() => setShowConfetti(false), 2500);
    return () => clearTimeout(confettiTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNativeShare = async (
    format: Extract<ShareFormat, 'profile' | 'story'>,
  ) => {
    trackEvent(ShareEvent.Clicked, { channel: 'system', format, method });
    setBusyAction(`share-${format}`);
    try {
      const file = await prepareFile(format);
      if (!file) return;
      await navigator.share({
        files: [file],
        title: 'Palestine Profile Pic Maker',
        text: shareCaption('system', format),
      });
      trackEvent(ShareEvent.Completed, { channel: 'system', format, method });
    } catch (error) {
      // AbortError means the user dismissed the share sheet — not an error.
      if ((error as DOMException)?.name !== 'AbortError') {
        console.error('Error sharing image', error);
      }
    } finally {
      setBusyAction(undefined);
    }
  };

  const handleStoryDownload = async () => {
    trackEvent(ShareEvent.Clicked, {
      channel: 'download',
      format: 'story',
      method,
    });
    setBusyAction('story-download');
    try {
      const file = await prepareFile('story');
      if (!file) return;
      download(file, 'palestine-story-pic.png');
      trackEvent(ShareEvent.Completed, {
        channel: 'download',
        format: 'story',
        method,
      });
    } finally {
      setBusyAction(undefined);
    }
  };

  const handleCopyCaption = async () => {
    trackEvent(ShareEvent.Clicked, { channel: 'copy', format: 'link', method });
    try {
      await navigator.clipboard.writeText(shareCaption('copy'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent(ShareEvent.Completed, {
        channel: 'copy',
        format: 'link',
        method,
      });
    } catch (error) {
      console.error('Error copying caption', error);
    }
  };

  const handleLinkOut = (channel: ShareChannel) => {
    trackEvent(ShareEvent.Clicked, { channel, format: 'link', method });
  };

  return (
    <div className="relative overflow-hidden mt-8 rounded-2xl border border-gray-300 bg-gray-50 px-4 py-5">
      {showConfetti &&
        CONFETTI_PIECES.map((piece, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="confetti-piece"
            style={{
              left: piece.left,
              width: piece.width,
              height: piece.height,
              backgroundColor: piece.color,
              animationDelay: piece.delay,
            }}
          />
        ))}
      <p className="font-semibold text-lg">Now spread the word 📣</p>
      <p className="text-sm text-gray-600 pb-3">
        Post it to your story or send it to friends.
      </p>
      {canNativeShare && (
        <>
          <button
            onClick={() => handleNativeShare('story')}
            disabled={!!busyAction}
            className="rounded-full my-2 py-3 px-4 w-full border border-gray-900 bg-gray-900 text-white disabled:opacity-60"
          >
            <span className="text-xl font-semibold">
              {busyAction === 'share-story' ? 'Preparing…' : 'Share to Story'}{' '}
              <FaShareNodes className="inline mb-1 ml-1 text-md" />
            </span>
            <span className="block text-xs text-gray-300 mt-0.5">
              9:16 card with your pic and the link — for WhatsApp &amp;
              Instagram stories
            </span>
          </button>
          <button
            onClick={() => handleNativeShare('profile')}
            disabled={!!busyAction}
            className="rounded-full my-2 py-3 px-4 w-full border border-gray-900 disabled:opacity-60"
          >
            <span className="text-xl font-semibold">
              {busyAction === 'share-profile'
                ? 'Preparing…'
                : 'Share the Photo'}{' '}
              <FaShareNodes className="inline mb-1 ml-1 text-md" />
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Just your framed profile picture
            </span>
          </button>
        </>
      )}
      <div className="flex justify-center gap-3 my-4">
        {buildShareLinks().map(({ channel, label, href }) => {
          const { Icon, background } = CHANNEL_STYLES[channel];
          return (
            <a
              key={channel}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              onClick={() => handleLinkOut(channel)}
              className="rounded-full p-3.5 text-2xl text-white shadow-md hover:scale-110 transition-transform"
              style={{ backgroundColor: background }}
            >
              <Icon />
            </a>
          );
        })}
        <button
          onClick={handleCopyCaption}
          aria-label="Copy caption and link"
          title="Copy caption and link"
          className="rounded-full p-3.5 text-2xl text-white bg-gray-600 shadow-md hover:scale-110 transition-transform"
        >
          <FaRegCopy />
        </button>
      </div>
      {copied && <p className="text-sm text-gray-600">Caption copied! 📋</p>}
      {!canNativeShare && (
        <button
          onClick={handleStoryDownload}
          disabled={!!busyAction}
          className="text-sm text-gray-600 underline cursor-pointer hover:text-gray-900 disabled:opacity-60"
        >
          {busyAction === 'story-download'
            ? 'Preparing story image…'
            : 'Save a story-sized image (9:16)'}{' '}
          <FaDownload className="inline mb-0.5" />
        </button>
      )}

      {/* Off-screen 9:16 story card, rasterised at 3x into a 1080x1920 PNG.
          Kept rendered (not display:none) so html-to-image can lay it out. */}
      <div
        aria-hidden="true"
        style={{ position: 'fixed', left: '-10000px', top: 0 }}
      >
        <div
          ref={storyRef}
          className="flex flex-col items-center"
          style={{
            width: '360px',
            height: '640px',
            backgroundColor: '#303846',
          }}
        >
          <div
            className="relative"
            style={{ width: '250px', height: '250px', marginTop: '48px' }}
          >
            <Image
              width={100}
              height={100}
              alt=""
              src={'/bg.webp'}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              className="rounded-full"
              unoptimized
            />
            <Image
              alt=""
              src={userImageUrl}
              width={100}
              height={100}
              style={{
                position: 'absolute',
                width: '85%',
                height: '85%',
                left: '7.5%',
                top: '7.5%',
              }}
              className="object-cover rounded-full"
            />
          </div>
          <p className="text-white text-3xl font-semibold mt-6">
            I stand with Palestine
          </p>
          {/* Small Palestinian flag, drawn with CSS (no emoji: system emoji
              fonts don't rasterise reliably across platforms). */}
          <div
            className="relative overflow-hidden mt-4"
            style={{ width: '60px', height: '40px' }}
          >
            <div style={{ height: '13.4px', backgroundColor: '#000000' }} />
            <div style={{ height: '13.3px', backgroundColor: '#ffffff' }} />
            <div style={{ height: '13.3px', backgroundColor: '#149954' }} />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 0,
                height: 0,
                borderTop: '20px solid transparent',
                borderBottom: '20px solid transparent',
                borderLeft: '22px solid #E4312B',
              }}
            />
          </div>
          {/* The URL pill sits in the upper two-thirds: WhatsApp/Instagram
              overlay the caption and reply UI over roughly the bottom quarter
              of a story, which swallowed it when it was bottom-anchored. */}
          <div className="mt-6 rounded-full bg-white px-7 py-3 text-gray-900 text-2xl font-bold">
            {STORY_URL_LABEL}
          </div>
          <p className="text-gray-300 mt-5">Frame your profile picture too</p>
        </div>
      </div>
    </div>
  );
}
