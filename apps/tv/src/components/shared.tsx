'use client'

import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

/** Re-renders on an interval — for countdowns. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function usePhaseCountdown(phaseStartedAt: number, phaseDuration: number, serverNow: number): number {
  const now = useNow(200)
  const anchor = useMemo(() => ({ server: serverNow, local: Date.now() }), [serverNow])
  const estimatedServerNow = anchor.server + (now - anchor.local)
  return Math.max(0, Math.ceil((phaseStartedAt + phaseDuration - estimatedServerNow) / 1000))
}

export function mobileUrl(): string {
  if (typeof window === 'undefined') return ''
  if (process.env.NEXT_PUBLIC_MOBILE_URL) return process.env.NEXT_PUBLIC_MOBILE_URL
  const { protocol, hostname, port } = window.location
  const isDev = port === '3000' || port === '3003'
  // In production nginx serves the mobile app under /play
  return isDev ? `${protocol}//${hostname}:3002` : `${protocol}//${window.location.host}/play`
}

export function JoinQR({ size = 210, label = 'SCANNE & JOUE' }: { size?: number; label?: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => setUrl(mobileUrl()), [])
  if (!url) return null
  return (
    <div className="paper rounded-xl px-6 pb-4 pt-5 text-center rotate-1">
      <div className="font-headline text-2xl tracking-[0.25em] text-derby-coal">{label}</div>
      <div className="mx-auto mt-3 w-fit rounded-lg bg-derby-cream p-3">
        <QRCodeSVG value={url} size={size} bgColor="transparent" fgColor="#241A0F" level="M" />
      </div>
      <div className="mt-2 font-mono text-sm text-derby-coal/70">{url.replace(/^https?:\/\//, '')}</div>
    </div>
  )
}

export function Bulbs({ count = 24 }: { count?: number }) {
  return (
    <div className="bulbs">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={{ animationDelay: `${(i % 5) * 0.24}s` }} />
      ))}
    </div>
  )
}

export function SilkDot({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full border-2 border-derby-cream/80 shadow"
      style={{ width: size, height: size, background: color }}
    />
  )
}

const TICKER_ITEMS = [
  'LE GAGNANT DISTRIBUE LE DOUBLE DE LA COTE — LE CHEVAL DORÉ TRIPLE',
  'LES PERDANTS BOIVENT LA COTE DE LEUR CANASSON',
  'LESROLODES.COM — PARTENAIRE OFFICIEL',
  'TOUT ABUS EST FORTEMENT RECOMMANDÉ (AVEC MODÉRATION)',
  'PARIS FERMES 10 SECONDES AVANT LE DÉPART',
  "SELLERIE ROYALE HABILLE NOS JOCKEYS DEPUIS 1892",
]

export function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 overflow-hidden border-t-2 border-derby-gold/60 bg-derby-night/90 py-2">
      <div className="animate-ticker flex w-max gap-16 whitespace-nowrap font-terminal text-2xl tracking-wider text-derby-gold">
        {items.map((t, i) => (
          <span key={i}>★ {t}</span>
        ))}
      </div>
    </div>
  )
}
