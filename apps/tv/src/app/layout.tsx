import type { Metadata } from 'next'
import { Rye, Bebas_Neue, DM_Mono, Courier_Prime, VT323 } from 'next/font/google'
import './globals.css'

const rye = Rye({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-rye',
})

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
})

const dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-dm-mono',
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
  title: 'Last Sip Derby - TV',
  description: 'Course de chevaux Last Sip Derby',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${rye.variable} ${bebasNeue.variable} ${dmMono.variable} ${vt323.variable} ${courier.variable} font-sans antialiased bg-black text-white`}>
        {children}
      </body>
    </html>
  )
}
