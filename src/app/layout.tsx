import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Palestine Profile Pic Maker 🇵🇸',
  description: 'Create your Palestine profile picture to show your support',
  openGraph: {
    title: 'Palestine Profile Pic Maker 🇵🇸',
    description: 'Create your Palestine profile picture to show your support',
    siteName: 'Palestine Profile Pic Maker 🇵🇸',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
      }
    ],
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
