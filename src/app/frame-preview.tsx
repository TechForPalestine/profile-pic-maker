import Image from 'next/image';

/**
 * A static rendering of what the tool produces: the flag ring with a photo
 * inside it. Same geometry as the live preview in `profile-pic-maker.tsx`, but
 * without any of its state — landing pages are plain server-rendered pages.
 */
export default function FramePreview() {
  return (
    <div className="flex justify-center my-10">
      <div style={{ width: '260px', height: '260px' }} className="relative">
        <Image
          width={100}
          height={100}
          alt="Palestinian flag frame"
          src="/bg.webp"
          style={{ position: 'absolute', width: '100%', height: '100%' }}
          className="rounded-full"
          unoptimized
        />
        <Image
          width={100}
          height={100}
          alt="Example profile picture inside the frame"
          src="/user.jpg"
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
    </div>
  );
}
