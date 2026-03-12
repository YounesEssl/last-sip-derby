'use client'

import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'
import type { Horse as HorseType, Player } from '@last-sip-derby/shared'
import { HorseSVG } from './HorseSVG'

interface HorseProps {
  horse: HorseType
  trackWidth: number
  better?: Player
}

export function Horse({ horse, trackWidth, better }: HorseProps) {
  const horseRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!horseRef.current) return

    const targetX = (horse.position / 100) * (trackWidth - 100)

    gsap.to(horseRef.current, {
      x: targetX,
      duration: 0.1,
      ease: 'none',
    })
  }, [horse.position, trackWidth])

  return (
    <div
      ref={horseRef}
      className="absolute flex items-center"
      style={{ top: '50%', left: 0, transform: 'translateY(-50%)' }}
    >
      <HorseSVG
        color={horse.color}
        isRunning={horse.position > 0 && horse.position < 100}
        isStunned={horse.isStunned}
      />
      <div className="absolute -top-8 left-0 whitespace-nowrap">
        <span className="font-display text-[28px] text-derby-text leading-none">
          {horse.name.toUpperCase()}
        </span>
        {better && (
          <span className="font-body text-[20px] text-derby-gold ml-2">
            {better.pseudo} ({better.currentBet?.amount}G)
          </span>
        )}
      </div>
    </div>
  )
}
