'use client'

import { useState, useEffect, useRef } from 'react'
import { HORSE_COLORS } from '@last-sip-derby/shared'

interface RaceHorseProps {
  number: number
  speed: number
  isRacing: boolean
  isFrozen: boolean
  isStunned: boolean
  isLeading: boolean
  colorIndex: number
  scale: number
}

// Filter applied on the outermost wrapper — hue-rotate + high saturate
// so the color is visible even on a near-white sprite
const HORSE_FILTERS = [
  'hue-rotate(200deg) saturate(3)',                    // bleu
  'hue-rotate(90deg) saturate(3)',                     // vert
  'hue-rotate(270deg) saturate(3)',                    // violet
  'hue-rotate(45deg) saturate(3) brightness(1.1)',     // jaune/doré
  'hue-rotate(0deg) saturate(3)',                      // rouge
]

// Base display size: 560×434 (upscaled from 128×90 frames)
const DISPLAY_W = 560
const DISPLAY_H = 434
// Spritesheet scaled to match
const BG_W = 3360
const BG_H = 3472
// Frame offsets scaled from original 128×90 grid
const SCALE_X = DISPLAY_W / 128
const SCALE_Y = DISPLAY_H / 90

// Idle animation: 8 frames
const IDLE_FRAMES: [number, number][] = [
  [0, 0], [-128, 0], [-256, 0], [-384, 0], [-512, 0], [-640, 0],
  [0, -90], [-128, -90],
]

// Run animation: 6 frames
const RUN_FRAMES: [number, number][] = [
  [-640, -270],
  [0, -360],
  [-128, -360],
  [-256, -360],
  [-384, -360],
  [-512, -360],
]

export const RaceHorse = ({ number, speed, isRacing, isFrozen, isStunned, isLeading, colorIndex, scale }: RaceHorseProps) => {
  const [frame, setFrame] = useState(0)
  const speedRef = useRef(speed)
  const stunnedRef = useRef(isStunned)
  speedRef.current = speed
  stunnedRef.current = isStunned

  useEffect(() => {
    if (isFrozen) return
    setFrame(0)
  }, [isRacing, isFrozen])

  useEffect(() => {
    if (isFrozen) return

    let lastTime = 0
    let accumulated = 0

    const getIntervalMs = () => {
      if (!isRacing) return 150
      const s = Math.max(1, Math.min(10, speedRef.current))
      const ms = 140 - (s / 10) * 110
      return stunnedRef.current ? ms * 3 : ms
    }

    const tick = (time: number) => {
      if (lastTime > 0) {
        accumulated += time - lastTime
        const interval = getIntervalMs()
        if (accumulated >= interval) {
          const frameCount = isRacing ? RUN_FRAMES.length : IDLE_FRAMES.length
          setFrame((f) => (f + 1) % frameCount)
          accumulated = 0
        }
      }
      lastTime = time
      rafId = requestAnimationFrame(tick)
    }

    let rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isRacing, isFrozen])

  const frames = (isRacing || isFrozen) ? RUN_FRAMES : IDLE_FRAMES
  const safeFrame = frame % frames.length
  const pos = frames[safeFrame] ?? frames[0]

  const effectiveScale = scale

  let colorFilter = ''
  if (isStunned) {
    colorFilter = 'grayscale(0.6) brightness(0.6)'
  }

  return (
    <div
      style={{
        width: DISPLAY_W,
        height: DISPLAY_H,
        transform: `scale(${effectiveScale})`,
        transformOrigin: 'bottom center',
        ...(colorFilter && { filter: colorFilter }),
        overflow: 'visible',
        background: 'transparent',
      }}
    >
      {/* Horse sprite — mix-blend-mode: lighten removes the black bg */}
      <div
        style={{
          width: DISPLAY_W,
          height: DISPLAY_H,
          backgroundImage: 'url(/horse/White_Horse.png)',
          backgroundSize: `${BG_W}px ${BG_H}px`,
          backgroundRepeat: 'no-repeat',
          backgroundPositionX: pos[0] * SCALE_X,
          backgroundPositionY: pos[1] * SCALE_Y,
        }}
      />


    </div>
  )
}
