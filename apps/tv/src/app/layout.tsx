import type { Metadata } from 'next'
import { Yeseva_One, Oswald, Courier_Prime, VT323, Caveat } from 'next/font/google'
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

const courier = Courier_Prime({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-courier',
})

const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-vt323',
})

const caveat = Caveat({
  weight: ['500', '700'],
  subsets: ['latin'],
  variable: '--font-caveat',
})

export const metadata: Metadata = {
  title: 'Last Sip Derby — TV',
  description: 'Course de chevaux Last Sip Derby',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${yeseva.variable} ${oswald.variable} ${courier.variable} ${vt323.variable} ${caveat.variable} font-body antialiased`}>
        <div className="tv-frame">
          {children}
          <div className="grain" />
          <div className="stage-frame" />
        </div>
      </body>
    </html>
  )
}
