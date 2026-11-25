import type { Metadata, Viewport } from 'next'
import { Mukta, Yatra_One } from 'next/font/google'
import { BottomNav } from '@/components/BottomNav'
import './globals.css'

const yatra = Yatra_One({ weight: '400', subsets: ['latin', 'devanagari'], variable: '--font-yatra' })
const mukta = Mukta({ weight: ['400', '500', '600', '700'], subsets: ['latin', 'devanagari'], variable: '--font-mukta' })

export const metadata: Metadata = {
  title: 'Milan · shaadi ka kaam, phone par',
  description: 'Tell Milan what you need. It finds vendors near you, calls them, and brings back the quotes.',
}

export const viewport: Viewport = { themeColor: '#8e1b2c', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${yatra.variable} ${mukta.variable}`}>
      <body className="min-h-dvh pb-24">
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
