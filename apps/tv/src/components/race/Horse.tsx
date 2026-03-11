'use client'

import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'
import type { Horse as HorseType } from '@last-sip-derby/shared'

interface HorseProps {
  horse: HorseType
  trackWidth: number
}

export function Horse({ horse, trackWidth }: HorseProps) {
  const horseRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!horseRef.current) return

    const targetX = (horse.position / 100) * (trackWidth - 60)

    gsap.to(horseRef.current, {
      x: targetX,
      duration: 0.1,
      ease: 'none',
    })
  }, [horse.position, trackWidth])

  const gallopSpeed = horse.isStunned ? 0 : 0.1 + (horse.speed / 10) * 0.2

  return (
    <div
      ref={horseRef}
      className="absolute flex items-center gap-2"
      style={{ top: 0, left: 0 }}
    >
      <div className="relative">
        {/* Horse emoji as placeholder for spritesheet */}
        <span
          className="text-3xl inline-block"
          style={{
            animation: horse.isStunned
              ? 'none'
              : `gallop-bounce ${gallopSpeed}s ease-in-out infinite alternate`,
            filter: horse.isStunned ? 'grayscale(1) brightness(0.5)' : 'none',
          }}
        >
          🏇
        </span>
        {horse.isStunned && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg animate-bounce">
            💫
          </span>
        )}
      </div>
      <span
        className="text-xs font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
        style={{ backgroundColor: horse.color, color: '#0A0A0F' }}
      >
        {horse.name}
      </span>
    </div>
  )
}
