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
  { sprite: '/horse/Black_Horse.png', filter: '', color: '#1a1a1a' },
  { sprite: '/horse/Brown_Horse.png', filter: '', color: '#8B4513' },
  { sprite: '/horse/White_Horse.png', filter: '', color: '#d4cfc4' },
  { sprite: '/horse/horse_noir.png', filter: '', color: '#c46a2a' },
  { sprite: '/horse/horse_rouan.png', filter: '', color: '#5a7080' },
]

export function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function assignVariants(names: string[]): number[] {
  const used = new Set<number>()
  const result: number[] = new Array(names.length)
  for (let i = 0; i < names.length; i++) {
    const preferred = hashName(names[i]) % HORSE_VARIANTS.length
    if (!used.has(preferred)) {
      result[i] = preferred
      used.add(preferred)
    } else {
      result[i] = -1
    }
  }
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

const DISPLAY_W = 560
const DISPLAY_H = 434
const BG_W = 3360
const BG_H = 3472
const SCALE_X = DISPLAY_W / 128
const SCALE_Y = DISPLAY_H / 90

const IDLE_FRAMES: [number, number][] = [
  [0, 0], [-128, 0], [-256, 0], [-384, 0], [-512, 0], [-640, 0],
  [0, -90], [-128, -90],
]

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
  const pos = frames[frame % frames.length] ?? frames[0]

  let combinedFilter = variant.filter
  if (isStunned) {
    combinedFilter = 'grayscale(0.6) brightness(0.6)'
  }

  return (
    <div
      style={{
        width: DISPLAY_W,
        height: DISPLAY_H,
        transform: `scale(${scale})`,
        transformOrigin: 'bottom center',
        ...(combinedFilter && { filter: combinedFilter }),
        overflow: 'visible',
        background: 'transparent',
      }}
    >
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
