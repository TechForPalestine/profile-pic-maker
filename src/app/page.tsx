'use client'
import { toPng } from 'html-to-image';
import { useRef, useState } from "react";


export default function Home() {
  const [userImage, setUserImage] = useState(null);
  const myComponentRef = useRef<HTMLDivElement | null>(null);

  const handleImageUpload = (e: any) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event: any) => {
      setUserImage(event.target.result);
    };

    reader.readAsDataURL(file);
  };

  const handleUploadButtonClick = () => {
    document.getElementById('fileInput')?.click();
  };

  const handleDownload = () => {
    toPng(myComponentRef.current as HTMLElement)
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'my-image.png';
        link.href = dataUrl;
        link.click();
      })
      .catch((error) => {
        console.error('Error occurred while downloading the image', error);
      });
  };



  return (
    <main className='text-center px-8 py-12 max-w-lg mx-auto flex justify-center align-center items-center min-h-screen'>
      <div>
        <h1 className='font-semibold text-3xl'>Support Palestine 🇵🇸</h1>
        <p className="text-lg py-2">Create your Palestine profile picture to show your support </p>
        <div className="my-12">
          <div style={{ width: '300px', height: '300px' }} className="mx-auto relative" ref={myComponentRef}>
            <img id="borderImage" src="/bg.png" style={{ position: 'absolute', width: '100%', height: '100%' }} className="rounded-full" />
            <img id="userImage" alt='profile-image' src={userImage ?? "/user.jpg"} style={{ position: 'absolute', width: '85%', height: '85%', borderRadius: '50%', left: '7.5%', top: '7.5%' }} className="border object-cover cursor-pointer" onClick={handleUploadButtonClick} />
          </div>

        </div>
        <div>
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="fileInput" />
          <button onClick={handleUploadButtonClick} className="rounded-full my-2 py-4 px-2 w-full border border-gray-900 text-xl">
            Upload Image
          </button>
          <br />
          {/* <button onClick={handleDownload} className="rounded-full my-2 py-4 px-2 w-full border border-gray-900 bg-gray-900 text-white text-xl">
            Download Image
          </button> */}
          <div className='border p-4 rounded-lg bg-yellow-200 my-2'>
            <p>Downloading is not supported here. 😥</p>
            <p className='mt-1'>Please open this page on your native browser. 🙏</p>
          </div>
        </div>
        <div className='pt-8'>
          <p className='text-gray-600'>Have any feedback? <a href='https://www.instagram.com/tengkuhafidz' target='_blank' className='underline cursor-pointer'>Let me know!</a></p>
        </div>
      </div>
    </main>
  )
}
