'use client';
import { FunnelEvent, trackEvent } from '@/lib/analytics';
import { SocialPlatform } from '@/types';
import download from 'downloadjs';
import { toPng } from 'html-to-image';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  FaArrowRotateLeft,
  FaDownload,
  FaGithub,
  FaGitlab,
  FaXTwitter,
  FaBluesky,
} from 'react-icons/fa6';

export default function Home() {
  const ref = useRef<HTMLDivElement>(null);
  const [userImageUrl, setUserImageUrl] = useState<string>();
  const [unsupportedBrowser, setUnsupportedBrowser] = useState(false);
  const [loader, setLoader] = useState(false);
  const [gazaStatusSummary, setGazaStatusSummary] = useState();
  const [filePostfix, setFilePostfix] = useState<
    SocialPlatform | 'user-upload'
  >();

  useEffect(() => {
    trackEvent(FunnelEvent.Landed);
  }, []);

  // Step 4: a usable image source (data URL / social profile URL) is obtained.
  useEffect(() => {
    if (userImageUrl) {
      trackEvent(FunnelEvent.PhotoFetched, {
        method: filePostfix ?? 'unknown',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userImageUrl]);

  useEffect(() => {
    const isInstagramBrowser = /Instagram/i.test(navigator.userAgent);
    const isFacebookBrowser = /FBAN|FBAV/i.test(navigator.userAgent);

    if (isInstagramBrowser || isFacebookBrowser) {
      // Browser detection must happen in an effect (navigator unavailable during SSR).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnsupportedBrowser(true);
    }
  }, []);

  useEffect(() => {
    fetch('/api/gaza-status')
      .then((res) => res.json())
      .then((data) => setGazaStatusSummary(data.summary));
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file: File | undefined = e.target.files?.[0];
    const reader = new FileReader();

    if (file) {
      trackEvent(FunnelEvent.PhotoProvided, { method: 'user-upload' });
      reader.onload = async (event: ProgressEvent<FileReader>) => {
        setFilePostfix('user-upload');
        setUserImageUrl(event.target?.result as string);
      };

      reader.readAsDataURL(file);
    } else {
      // Handle the case when no file is selected (optional)
      console.error('No file selected.');
    }
  };

  const handleUploadButtonClick = () => {
    trackEvent(FunnelEvent.SourceSelected, { method: 'user-upload' });
    document.getElementById('fileInput')?.click();
  };

  const handleRetrieveProfilePicture = async (platform: SocialPlatform) => {
    trackEvent(FunnelEvent.SourceSelected, { method: platform });
    const userProvidedUsername = prompt(`Enter your ${platform} username:`);

    if (userProvidedUsername) {
      trackEvent(FunnelEvent.PhotoProvided, { method: platform });
      setFilePostfix(platform);
      try {
        setLoader(true);
        const response = await fetch(
          `/api/retrieve-profile-pic?username=${userProvidedUsername}&platform=${platform}`,
        ).then((res) => (res.ok ? res.json() : null));
        setLoader(false);
        if (response === null) {
          alert(
            'Error fetching your profile picture. Please make sure that you entered a correct username.',
          );
          return;
        }
        setUserImageUrl(response.profilePicUrl);
      } catch (error) {
        console.error('Error fetching profile picture:', error);
      }
    }
  };

  const generateImage = async () => {
    try {
      return await toPng(ref.current as HTMLElement);
    } catch (error) {
      console.log('Error generating image', error);
    }
  };

  const handleDownload = async () => {
    // TODO: Fix if possible. This is a hack to ensure that image generated is as expected. Without repeating generateImage(), at times, the image wont be generated correctly.
    await generateImage();
    await generateImage();
    await generateImage();
    const generatedImageUrl = await generateImage();
    if (generatedImageUrl) {
      download(generatedImageUrl, `profile-pic-${filePostfix}.png`);
      trackEvent(FunnelEvent.Downloaded, {
        method: filePostfix ?? 'unknown',
      });
    }
  };

  const startOver = async () => {
    trackEvent(FunnelEvent.StartOver, { method: filePostfix ?? 'unknown' });
    setUserImageUrl(undefined);
  };

  return (
    <main className="min-h-screen flex flex-col text-center">
      <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-xl mx-auto w-full">
        {unsupportedBrowser && (
          <div className="border p-2 rounded-lg bg-yellow-200 my-2  text-sm mb-8">
            <p className="font-semibold">⚠️ Unsupported Browser Detected</p>
            <p>Please open on regular browsers like Chrome or Safari.</p>
          </div>
        )}
        {gazaStatusSummary && (
          <a
            className="rounded-lg bg-gray-200 py-1.5 px-4 text-sm text-gray-800 cursor-pointer"
            target="_blank"
            href="https://data.techforpalestine.org/"
          >
            😥 {gazaStatusSummary} →
          </a>
        )}
        <h1 className="font-semibold text-3xl mt-6">Show Solidarity 🇵🇸</h1>
        <p className="text-lg py-2">
          Let&apos;s unite in our profile pictures to spotlight the cause. ✊
        </p>
        <p className="text-gray-600">
          Watch the{' '}
          <a
            href="/how-to-guide.mp4"
            target="_blank"
            className="underline cursor-pointer hover:text-gray-900"
          >
            step-by-step guide
          </a>{' '}
          👀
        </p>
        <div className="my-12">
          <div className="flex justify-center">
            <div
              style={{ width: '300px', height: '300px' }}
              className="relative"
              ref={ref}
            >
              <Image
                width={100}
                height={100}
                alt="border"
                id="borderImage"
                src={'/bg.webp'}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
                className="rounded-full"
                unoptimized
              />
              {loader ? (
                <Image
                  id="spinner"
                  alt="spinner-animation"
                  src={'/spinner.svg'}
                  width={100}
                  height={100}
                  style={{
                    position: 'absolute',
                    width: '85%',
                    height: '85%',
                    left: '7.5%',
                    top: '7.5%',
                  }}
                  className="object-cover rounded-full cursor-wait"
                />
              ) : (
                <Image
                  id="userImage"
                  alt="profile-image"
                  src={userImageUrl ?? '/user.jpg'}
                  onLoad={() => {
                    // Only the user's selected photo counts, not the placeholder.
                    if (userImageUrl) {
                      trackEvent(FunnelEvent.PreviewShown, {
                        method: filePostfix ?? 'unknown',
                      });
                    }
                  }}
                  width={100}
                  height={100}
                  style={{
                    position: 'absolute',
                    width: '85%',
                    height: '85%',
                    left: '7.5%',
                    top: '7.5%',
                  }}
                  className="object-cover rounded-full cursor-pointer"
                />
              )}
            </div>
          </div>
        </div>
        <div>
          {userImageUrl ? (
            <>
              <p className="p-2 my-6 text-sm border rounded-lg">
                Download the image, then use it as your new profile picture.
              </p>
              <button
                onClick={handleDownload}
                className="rounded-full mb-2 py-3 px-2 w-full border border-gray-900 bg-gray-900 text-white text-xl"
              >
                Download Image{' '}
                <FaDownload className="inline mb-1 ml-2 text-md" />
              </button>
              <button
                onClick={startOver}
                className="rounded-full my-2 py-3 px-2 w-full border border-gray-900 text-xl"
              >
                Start Over{' '}
                <FaArrowRotateLeft className="inline mb-1 ml-2 text-md" />
              </button>
            </>
          ) : (
            <>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="fileInput"
              />
              <button
                onClick={handleUploadButtonClick}
                className="rounded-full my-2 py-3 px-2 w-full border border-gray-900 text-xl"
              >
                Upload Image
              </button>
              <button
                onClick={async () =>
                  await handleRetrieveProfilePicture(SocialPlatform.Twitter)
                }
                className="rounded-full my-2 py-3 px-2 w-full border border-gray-900 text-xl"
              >
                Use <FaXTwitter className="inline mb-1" /> Profile Pic
              </button>
              <button
                onClick={async () =>
                  await handleRetrieveProfilePicture(SocialPlatform.Github)
                }
                className="rounded-full my-2 py-3 px-2 w-full border border-gray-900 text-xl"
              >
                Use <FaGithub className="inline mb-1" /> Profile Pic
              </button>
              <button
                onClick={async () =>
                  await handleRetrieveProfilePicture(SocialPlatform.Gitlab)
                }
                className="rounded-full my-2 py-3 px-2 w-full border border-gray-900 text-xl"
              >
                Use <FaGitlab className="inline mb-1" /> Profile Pic
              </button>
              <button
                onClick={async () =>
                  await handleRetrieveProfilePicture(SocialPlatform.Bluesky)
                }
                className="rounded-full my-2 py-3 px-2 w-full border border-gray-900 text-xl"
              >
                Use <FaBluesky className="inline mb-1" /> Profile Pic
              </button>
            </>
          )}
        </div>
        <div className="pt-8">
          <p className="p-2 my-6 text-sm border rounded-lg">
            Note: Your image is processed entirely in your browser. No images
            are uploaded or saved by the app.
          </p>
          <p className="text-gray-600">
            Have feedback, a question, or found a bug?{' '}
            <a
              href="https://github.com/TechForPalestine/profile-pic-maker/issues"
              target="_blank"
              className="underline cursor-pointer"
            >
              Let us know on GitHub
            </a>
          </p>
        </div>
      </div>
      <footer className="bg-[#303846] text-center py-8 px-4">
        <div className="container max-w-xl mx-auto">
          <div className="mb-4">
            <a
              href="https://techforpalestine.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <img
                src="/img/logo.svg"
                alt="Tech For Palestine Logo"
                width={320}
                height={180}
                className="mx-auto"
              />
            </a>
          </div>
          <p className="text-sm text-[#ebedf0]">
            An open source initiative of the Tech For Palestine collective
          </p>
        </div>
      </footer>
    </main>
  );
}
