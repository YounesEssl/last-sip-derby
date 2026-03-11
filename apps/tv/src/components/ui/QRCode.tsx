'use client'

import { useEffect, useRef } from 'react'

interface QRCodeProps {
  url: string
  size?: number
}

export function QRCode({ url, size = 200 }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Simple QR code placeholder - in production use a library
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw a styled placeholder with the URL
    canvas.width = size
    canvas.height = size

    ctx.fillStyle = '#C9A84C'
    ctx.fillRect(0, 0, size, size)

    ctx.fillStyle = '#0A0A0F'
    ctx.fillRect(4, 4, size - 8, size - 8)

    // Draw QR-like pattern
    const cellSize = Math.floor(size / 25)
    ctx.fillStyle = '#C9A84C'

    // Corner markers
    const drawCorner = (x: number, y: number) => {
      ctx.fillRect(x, y, cellSize * 7, cellSize * 7)
      ctx.fillStyle = '#0A0A0F'
      ctx.fillRect(x + cellSize, y + cellSize, cellSize * 5, cellSize * 5)
      ctx.fillStyle = '#C9A84C'
      ctx.fillRect(x + cellSize * 2, y + cellSize * 2, cellSize * 3, cellSize * 3)
    }

    drawCorner(cellSize * 2, cellSize * 2)
    drawCorner(cellSize * 16, cellSize * 2)
    drawCorner(cellSize * 2, cellSize * 16)

    // Random pattern in the middle for visual effect
    for (let i = 9; i < 16; i++) {
      for (let j = 2; j < 23; j++) {
        if (Math.random() > 0.5) {
          ctx.fillStyle = '#C9A84C'
          ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize)
        }
      }
    }
  }, [url, size])

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        className="rounded-lg border-2 border-derby-gold/30"
        style={{ width: size, height: size }}
      />
      <p className="text-derby-gold/70 text-xs font-mono break-all max-w-[200px] text-center">
        {url}
      </p>
    </div>
  )
}
