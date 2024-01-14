'use client'
import { SocialPlatform } from '@/types';
import download from 'downloadjs';
import { toPng } from 'html-to-image';
import { useEffect, useRef, useState } from "react";
import { FaGithub, FaXTwitter } from "react-icons/fa6";
import Image from 'next/image'

export default function Home() {
  const ref = useRef<HTMLDivElement>(null)
  const [userImageUrl, setUserImageUrl] = useState<string>();
  const [unsuportedBrowser, setUnsupportedBrowser] = useState(false);
  const [loader, setLoader] = useState(false)

  useEffect(() => {
    const isInstagramBrowser = /Instagram/i.test(navigator.userAgent);
    const isFacebookBrowser = /FBAN|FBAV/i.test(navigator.userAgent);

    if (isInstagramBrowser || isFacebookBrowser) {
      setUnsupportedBrowser(true)
    }
  }, [unsuportedBrowser])

  const handleImageUpload = (e: any) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (event: any) => {
      setUserImageUrl(event.target.result);
    };

    reader.readAsDataURL(file);
  };

  const handleUploadButtonClick = () => {
    document.getElementById('fileInput')?.click();
  };

  const handleRetrieveProfilePicture = async (platform: SocialPlatform) => {
    const userProvidedUsername = prompt(`Enter your ${platform} username:`);

    if (userProvidedUsername) {
      try {
        setLoader(true);
        const response = await fetch(`/api/retrieve-profile-pic?username=${userProvidedUsername}&platform=${platform}`).then(res => res.ok ? res.json() : null);
        setLoader(false);
        if (response === null) {
          alert('Error fetching your profile picture. Please make sure that you entered a correct username.');
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
      return await toPng(ref.current as HTMLElement)
    } catch (error) {
      console.log("Error generating image", error)
    }
  }

  const handleDownload = async () => {
    // TODO: Fix if possible. This is a hack to ensure that image generated is as expected. Without repeating generateImage(), at times, the image wont be generated correctly. 
    await generateImage()
    await generateImage()
    await generateImage()
    const generatedImageUrl = await generateImage()
    if (generatedImageUrl) {
      download(generatedImageUrl, "profile-pic.png")
    }
  };

  return (
    <main className='text-center px-8 py-12 max-w-lg mx-auto flex justify-center align-center items-center min-h-screen'>
      <div>
        {unsuportedBrowser && (
          <div className='border p-2 rounded-lg bg-yellow-200 my-2  text-sm mb-8'>
            <p className='font-semibold'>⚠️ Unsupported Browser Detected</p>
            <p>Please open on regular browsers like Chrome or Safari.</p>
          </div>
        )}

        <h1 className='font-semibold text-3xl'>Show Solidarity 🇵🇸</h1>
        <p className="text-lg py-2">Use your profile picture to spotlight the cause. <a href="https://x.com/hashtag/CeasefireNOW" target='_blank' className="text-blue-600 cursor-pointer">#CeasefireNow</a> ✊</p>
        <p className="text-lg py-2">Watch the <a href='https://www.instagram.com/p/C2B1DP0LqBl/' target='_blank' className='underline cursor-pointer'>step-by-step guide</a> 👀</p>

        <div className="my-12">
          <div className='flex justify-center'>
            <div
              style={{ width: '300px', height: '300px' }}
              className="relative"
              ref={ref}
            >
              <img
                alt="border"
                id="borderImage"
                src={'/bg.webp'}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
                className="rounded-full"
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
        <div>{userImageUrl && (
          <button onClick={handleDownload} className="rounded-full mb-2 py-4 px-2 w-full border border-gray-900 bg-gray-900 text-white text-xl">
            Download Image
          </button>
        )}
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="fileInput" />
          <button onClick={handleUploadButtonClick} className="rounded-full my-2 py-3 px-2 w-full border border-gray-900 text-xl">
            Upload Image
          </button>
          <button onClick={async () => await handleRetrieveProfilePicture(SocialPlatform.Twitter)} className="rounded-full my-2 py-3 px-2 w-full border border-gray-900 text-xl">
            Use <FaXTwitter className="inline mb-1" /> Profile Pic
          </button>
          <button onClick={async () => await handleRetrieveProfilePicture(SocialPlatform.Github)} className="rounded-full my-2 py-3 px-2 w-full border border-gray-900 text-xl">
            Use <FaGithub className="inline mb-1" /> Profile Pic
          </button>
        </div>
        <div className='pt-8'>
          <p className="p-2 my-6 text-sm border rounded-lg">Note: This app runs purely on your browser end. No images nor data will be saved by the app.</p>
          <p className='text-gray-600'>Have any feedback? <a href='https://www.x.com/sohafidz' target='_blank' className='underline cursor-pointer'>Let me know!</a></p>
        </div>
      </div>
    </main>
  )
}
