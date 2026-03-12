'use client'

import { QRCodeSVG } from 'qrcode.react'

interface QRCodeProps {
  url: string
  size?: number
}

export function QRCode({ url, size = 250 }: QRCodeProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="p-4 rounded-lg glow-gold"
        style={{ background: '#D4A843' }}
      >
        <QRCodeSVG
          value={url}
          size={size}
          bgColor="#D4A843"
          fgColor="#08090D"
          level="M"
        />
      </div>
      <p className="font-mono text-sm text-derby-muted break-all max-w-[280px] text-center">
        {url}
      </p>
    </div>
  )
}
