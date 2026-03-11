import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Last Sip Derby',
  description: 'Course de chevaux - Jeu a boire',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="font-mono antialiased">{children}</body>
    </html>
  )
}
