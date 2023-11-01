'use client'
import { toPng } from 'html-to-image';
import { useRef, useState } from "react";
import download from "downloadjs";
import Image from "next/image"


export default function Home() {
  const [userImage, setUserImage] = useState(null);
  const myComponentRef = useRef<HTMLDivElement | null>(null);
  const downloadRef = useRef<HTMLDivElement | null>(null);

  const [hasClickedDownload, setHasClickedDownload] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>()

  const handleImageUpload = (e: any) => {
    setGeneratedImageUrl(undefined)
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event: any) => {
      setUserImage(event.target.result);
      setTimeout(() => {
        generateImage()
      }, 500)
    };

    reader.readAsDataURL(file);
  };

  const handleUploadButtonClick = () => {
    setHasClickedDownload(false)
    document.getElementById('fileInput')?.click();
  };

  const generateImage = async () => {
    const image = await toPng(myComponentRef.current as HTMLElement)
    setGeneratedImageUrl(image);
    return image
  }

  const handleDownload = async () => {
    setHasClickedDownload(true)
    if (generatedImageUrl) {
      download(generatedImageUrl, "profile-pic.png")
    }
  };

  return (
    <main className='text-center px-8 py-12 max-w-lg mx-auto flex justify-center align-center items-center min-h-screen'>
      <div>
        <h1 className='font-semibold text-3xl'>Support Palestine 🇵🇸</h1>
        <p className="text-lg py-2">Create your Palestine profile picture to show your support </p>
        <div className="my-12">
          <div style={{ width: '300px', height: '300px' }} className="mx-auto relative" ref={myComponentRef}>
            <img id="borderImage" src={generatedImageUrl ?? "/bg.png"} style={{ position: 'absolute', width: '100%', height: '100%' }} className="rounded-full" />
            {!generatedImageUrl && <img id="userImage" alt='profile-image' src={userImage ?? "/user.jpg"} style={{ position: 'absolute', width: '85%', height: '85%', borderRadius: '50%', left: '7.5%', top: '7.5%' }} className="border object-cover cursor-pointer" onClick={handleUploadButtonClick} />}
          </div>
          {hasClickedDownload && (
            <div className='border p-4 rounded-lg bg-yellow-200 my-2'>
              <p>If download fails, long press on the image to manually save it 🙏</p>
            </div>
          )}
        </div>
        <div>{generatedImageUrl && (
          <button onClick={handleDownload} className="rounded-full mb-2 py-4 px-2 w-full border border-gray-900 bg-gray-900 text-white text-xl">
            Download Image
          </button>

        )}
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="fileInput" />
          <button onClick={handleUploadButtonClick} className="rounded-full my-2 py-4 px-2 w-full border border-gray-900 text-xl">
            Upload Image
          </button>
        </div>
        <div className='pt-8'>
          <p className='text-gray-600'>Have any feedback? <a href='https://www.instagram.com/tengkuhafidz' target='_blank' className='underline cursor-pointer'>Let me know!</a></p>
        </div>
      </div>
    </main>
  )
}
