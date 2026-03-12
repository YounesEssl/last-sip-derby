import type { Metadata, Viewport } from 'next'
import { Rye, VT323, Courier_Prime } from 'next/font/google'
import './globals.css'

const rye = Rye({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-rye',
})

const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-vt323',
})

const courier = Courier_Prime({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-courier',
})

export const metadata: Metadata = {
  title: 'Last Sip Derby - Ticket',
  description: 'Pariez et buvez !',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${rye.variable} ${vt323.variable} ${courier.variable} font-body antialiased bg-pmu-paper text-pmu-dark`}>{children}</body>
    </html>
  )
}
