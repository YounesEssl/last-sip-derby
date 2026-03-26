'use client'

import { useState, useEffect, useRef } from 'react'

interface RaceHorseProps {
  number: number
  variantIndex: number
  speed: number
  isRacing: boolean
  isFrozen: boolean
  isStunned: boolean
  isLeading: boolean
  colorIndex: number
  scale: number
}

// Exactly 5 variants = 5 horses per race → all always appear
export const HORSE_VARIANTS = [
  { sprite: '/horse/Black_Horse.png', filter: '' },
  { sprite: '/horse/Brown_Horse.png', filter: '' },
  { sprite: '/horse/White_Horse.png', filter: 'hue-rotate(0deg) saturate(3)' },          // rouge
  { sprite: '/horse/White_Horse.png', filter: 'hue-rotate(200deg) saturate(3)' },         // bleu
  { sprite: '/horse/White_Horse.png', filter: 'hue-rotate(90deg) saturate(3)' },          // vert
]

// Deterministic hash from horse name → always same preferred variant
export function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/** Assign unique variant indices for a list of horse names (no duplicates) */
export function assignVariants(names: string[]): number[] {
  const used = new Set<number>()
  const result: number[] = new Array(names.length)

  // First pass: assign preferred variant from hash
  for (let i = 0; i < names.length; i++) {
    const preferred = hashName(names[i]) % HORSE_VARIANTS.length
    if (!used.has(preferred)) {
      result[i] = preferred
      used.add(preferred)
    } else {
      result[i] = -1 // needs reassignment
    }
  }

  // Second pass: fill collisions with unused variants
  for (let i = 0; i < names.length; i++) {
    if (result[i] === -1) {
      for (let v = 0; v < HORSE_VARIANTS.length; v++) {
        if (!used.has(v)) {
          result[i] = v
          used.add(v)
          break
        }
      }
    }
  }

  return result
}

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

export const RaceHorse = ({ number, variantIndex, speed, isRacing, isFrozen, isStunned, isLeading, colorIndex, scale }: RaceHorseProps) => {
  const [frame, setFrame] = useState(0)
  const speedRef = useRef(speed)
  const stunnedRef = useRef(isStunned)
  speedRef.current = speed
  stunnedRef.current = isStunned

  const variant = HORSE_VARIANTS[variantIndex % HORSE_VARIANTS.length]

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
      // Exponential curve: speed 1 = 160ms (trot), speed 5 = 55ms, speed 10 = 15ms (blur)
      const ms = 200 * Math.pow(0.75, s)
      return stunnedRef.current ? ms * 4 : ms
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

  // Combine variant filter with stunned state
  let combinedFilter = variant.filter
  if (isStunned) {
    combinedFilter = 'grayscale(0.6) brightness(0.6)'
  }

  return (
    <div
      style={{
        width: DISPLAY_W,
        height: DISPLAY_H,
        transform: `scale(${effectiveScale})`,
        transformOrigin: 'bottom center',
        ...(combinedFilter && { filter: combinedFilter }),
        overflow: 'visible',
        background: 'transparent',
      }}
    >
      {/* Horse sprite */}
      <div
        style={{
          width: DISPLAY_W,
          height: DISPLAY_H,
          backgroundImage: `url(${variant.sprite})`,
          backgroundSize: `${BG_W}px ${BG_H}px`,
          backgroundRepeat: 'no-repeat',
          backgroundPositionX: pos[0] * SCALE_X,
          backgroundPositionY: pos[1] * SCALE_Y,
        }}
      />
    </div>
  )
}
