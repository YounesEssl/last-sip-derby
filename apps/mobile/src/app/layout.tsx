import type { Metadata, Viewport } from 'next'
import { Yeseva_One, Oswald, VT323, Courier_Prime, Caveat } from 'next/font/google'
import './globals.css'

const yeseva = Yeseva_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-yeseva',
})

const oswald = Oswald({
  weight: ['300', '400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-oswald',
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

const caveat = Caveat({
  weight: ['500', '700'],
  subsets: ['latin'],
  variable: '--font-caveat',
})

export const metadata: Metadata = {
  title: "L'Apérodrome — Ticket",
  description: 'Parie et bois !',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A231B',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${yeseva.variable} ${oswald.variable} ${vt323.variable} ${courier.variable} ${caveat.variable} font-body antialiased`}>
        {children}
      </body>
    </html>
  )
}
