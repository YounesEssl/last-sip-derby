'use client'

import { useRef, useState, useEffect } from 'react'
import type { Horse as HorseType } from '@last-sip-derby/shared'
import { Horse } from './Horse'

interface TrackProps {
  horses: HorseType[]
}

export function Track({ horses }: TrackProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(800)

  useEffect(() => {
    const updateWidth = () => {
      if (trackRef.current) {
        setTrackWidth(trackRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  return (
    <div ref={trackRef} className="relative w-full">
      {/* Sky layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2e] to-[#1a1a3e] opacity-30 rounded-lg" />

      {/* Track lanes */}
      <div className="relative">
        {horses.map((horse, i) => (
          <div
            key={horse.id}
            className="relative h-14 border-b border-gray-800/50"
            style={{
              background: i % 2 === 0
                ? 'rgba(45, 106, 79, 0.1)'
                : 'rgba(45, 106, 79, 0.05)',
            }}
          >
            {/* Lane number */}
            <div className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center text-gray-600 font-mono text-xs border-r border-gray-800/30">
              {i + 1}
            </div>

            {/* Finish line */}
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20" />

            {/* Horse */}
            <div className="absolute left-10 top-1/2 -translate-y-1/2 w-[calc(100%-50px)]">
              <Horse horse={horse} trackWidth={trackWidth - 50} />
            </div>
          </div>
        ))}

        {/* Start line */}
        <div className="absolute left-10 top-0 bottom-0 w-0.5 bg-white/30" />

        {/* Finish line */}
        <div className="absolute right-2 top-0 bottom-0 w-1">
          <div className="h-full w-full bg-[repeating-linear-gradient(0deg,white_0px,white_4px,black_4px,black_8px)]" />
        </div>
      </div>
    </div>
  )
}
