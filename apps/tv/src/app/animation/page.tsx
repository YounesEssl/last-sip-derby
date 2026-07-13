'use client'

import Link from 'next/link'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { GALLOP_LIMBS, isLegInContact, wrapCycle } from '@/race/gait'
import { drawHorse, type Coat } from '@/race/horse'

const FRAME_COUNT = 12
const MUYBRIDGE_FRAME_COUNT = 15
const REAL_GALLOP_HZ = 2.1
const COAT: Coat = { body: '#8C5A33', dark: '#6B4224', light: '#A5714A', mane: '#3E2A1A' }
const MUYBRIDGE_SOURCE = 'https://commons.wikimedia.org/wiki/File:Muybridge_race_horse_animated.gif'
const MUYBRIDGE_PLATE = 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Muybridge_race_horse_gallop.jpg'
const MUYBRIDGE_GIF = 'https://upload.wikimedia.org/wikipedia/commons/d/dd/Muybridge_race_horse_animated.gif'

const FRAME_NAMES = [
  'impact du postérieur traînant',
  'charge des postérieurs',
  'propulsion arrière',
  'transition vers les antérieurs',
  'impact de l’antérieur traînant',
  'appui de l’antérieur traînant',
  'impact de l’antérieur menant',
  'propulsion antérieure',
  'début de la suspension',
  'suspension étendue',
  'regroupement des postérieurs',
  'préparation de l’impact',
] as const

const SPEEDS = [
  { value: 0.1, label: '× 0,1' },
  { value: 0.25, label: '× 0,25' },
  { value: 0.5, label: '× 0,5' },
  { value: 1, label: 'TEMPS RÉEL' },
] as const

const frameFromPhase = (phase: number) => Math.floor(wrapCycle(phase) * FRAME_COUNT + 1e-6) % FRAME_COUNT

function paintStage(
  canvas: HTMLCanvasElement,
  phase: number,
  debugHind: boolean,
  compact = false,
) {
  const rect = canvas.getBoundingClientRect()
  const width = Math.max(1, rect.width)
  const height = Math.max(1, rect.height)
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const pixelWidth = Math.round(width * dpr)
  const pixelHeight = Math.round(height * dpr)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const sky = ctx.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#153D2D')
  sky.addColorStop(0.7, '#0E2A20')
  sky.addColorStop(0.701, '#B57848')
  sky.addColorStop(1, '#85502F')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  const groundY = compact ? height * 0.82 : height * 0.84
  ctx.strokeStyle = 'rgba(244,232,206,0.2)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  ctx.lineTo(width, groundY)
  ctx.stroke()

  if (!compact) {
    ctx.setLineDash([5, 8])
    ctx.strokeStyle = 'rgba(217,169,63,0.17)'
    for (let x = width * 0.12; x < width; x += width * 0.095) {
      ctx.beginPath()
      ctx.moveTo(x, groundY - 18)
      ctx.lineTo(x, groundY + 18)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }

  const scale = compact
    ? Math.min(width / 205, height / 145)
    : Math.min(width / 430, height / 195)
  ctx.save()
  ctx.translate(width * (compact ? 0.48 : 0.5), groundY)
  ctx.scale(scale, scale)
  drawHorse(ctx, {
    coat: COAT,
    silk: '#C63C2E',
    number: 1,
    phase,
    speedNorm: 1,
    time: phase / REAL_GALLOP_HZ,
    fall: 0,
    jockeyFall: 0,
    dizzy: false,
    debugHind,
  })
  ctx.restore()
}

function HorseStage({ phase, debugHind }: { phase: number; debugHind: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [resizeTick, setResizeTick] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => setResizeTick((value) => value + 1))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (canvasRef.current) paintStage(canvasRef.current, phase, debugHind)
  }, [phase, debugHind, resizeTick])

  return <canvas ref={canvasRef} className="block h-full w-full" aria-label="Cheval au galop, pose sélectionnée" />
}

const PoseThumbnail = memo(function PoseThumbnail({
  index,
  active,
  onSelect,
}: {
  index: number
  active: boolean
  onSelect: (index: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) paintStage(canvasRef.current, index / FRAME_COUNT, false, true)
  }, [index])

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      aria-label={`Afficher l’image ${index + 1}`}
      aria-pressed={active}
      className={`group relative min-w-0 cursor-pointer overflow-hidden border text-left transition ${
        active
          ? 'border-derby-gold bg-derby-gold/15 shadow-gold-glow'
          : 'border-derby-gold/20 bg-black/20 hover:border-derby-gold/60'
      }`}
    >
      <canvas ref={canvasRef} className="block aspect-[1.72/1] w-full" />
      <div className="absolute left-1.5 top-1.5 rounded-sm bg-derby-night/85 px-1.5 py-0.5 font-terminal text-sm text-derby-cream">
        {String(index + 1).padStart(2, '0')}
      </div>
    </button>
  )
})

export default function AnimationLabPage() {
  const [phase, setPhase] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(0.25)
  const [debugHind, setDebugHind] = useState(true)

  const selectedFrame = frameFromPhase(phase)
  // Our phase zero is Muybridge exposure 4: the first rear impact. Keeping
  // that offset visible makes comparison against the 15-photo plate direct.
  const muybridgeFrame = (Math.floor(wrapCycle(phase) * MUYBRIDGE_FRAME_COUNT + 1e-6) + 3) % MUYBRIDGE_FRAME_COUNT + 1
  const hindTrail = GALLOP_LIMBS.find((leg) => leg.id === 'hindTrail')!
  const hindLead = GALLOP_LIMBS.find((leg) => leg.id === 'hindLead')!
  const trailContact = isLegInContact(hindTrail.id, phase + hindTrail.phaseOffset)
  const leadContact = isLegInContact(hindLead.id, phase + hindLead.phaseOffset)

  useEffect(() => {
    if (!playing) return
    let animationFrame = 0
    let previous = performance.now()
    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000)
      previous = now
      setPhase((value) => wrapCycle(value + dt * REAL_GALLOP_HZ * speed))
      animationFrame = requestAnimationFrame(animate)
    }
    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [playing, speed])

  const selectFrame = useCallback((index: number) => {
    setPlaying(false)
    setPhase(wrapCycle(index / FRAME_COUNT))
  }, [])

  const stepFrame = useCallback((direction: number) => {
    setPlaying(false)
    setPhase((value) => {
      const current = frameFromPhase(value)
      return wrapCycle((current + direction) / FRAME_COUNT)
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') stepFrame(-1)
      if (event.key === 'ArrowRight') stepFrame(1)
      if (event.key === ' ') {
        event.preventDefault()
        setPlaying((value) => !value)
      }
      if (event.key === 'Home') selectFrame(0)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectFrame, stepFrame])

  return (
    <main
      className="bg-hippodrome relative h-full cursor-default overflow-y-auto px-5 py-4 text-derby-cream md:px-8"
      style={{ cursor: 'default' }}
    >
      <div className="relative z-10 mx-auto flex min-h-full max-w-[1700px] flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-derby-gold/35 pb-3">
          <div>
            <div className="font-headline text-sm tracking-[0.42em] text-derby-gold">ATELIER BIOMÉCANIQUE · CANVAS 2D</div>
            <h1 className="font-display text-3xl text-engraved md:text-5xl">Laboratoire du galop</h1>
          </div>
          <Link
            href="/"
            className="cursor-pointer border border-derby-gold/50 bg-derby-night/70 px-4 py-2 font-headline tracking-[0.2em] text-derby-cream transition hover:border-derby-gold hover:text-derby-gold"
          >
            ← RETOUR À LA COURSE
          </Link>
        </header>

        <section className="grid min-h-[390px] flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="panel-gold relative min-h-[350px] overflow-hidden">
            <HorseStage phase={phase} debugHind={debugHind} />
            <div className="pointer-events-none absolute left-4 top-4 bg-derby-night/80 px-3 py-2">
              <div className="font-terminal text-xl text-derby-gold">
                IMAGE {String(selectedFrame + 1).padStart(2, '0')} / {FRAME_COUNT}
              </div>
              <div className="font-headline text-lg uppercase tracking-[0.12em] text-derby-cream">
                {FRAME_NAMES[selectedFrame]}
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 font-terminal text-lg text-derby-parch/75">
              PHASE {wrapCycle(phase).toFixed(3)}
            </div>
          </div>

          <aside className="panel-gold flex flex-col gap-4 p-4">
            <div>
              <div className="font-headline text-sm tracking-[0.3em] text-derby-gold">POSTÉRIEURS</div>
              <div className="mt-2 space-y-2 font-mono text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#65D5E8]" /> Lointain · traînant</span>
                  <span className={trailContact ? 'text-[#F7D154]' : 'text-derby-smoke'}>{trailContact ? 'APPUI' : 'AIR'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" /> Proche · menant</span>
                  <span className={leadContact ? 'text-[#F7D154]' : 'text-derby-smoke'}>{leadContact ? 'APPUI' : 'AIR'}</span>
                </div>
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 border-y border-derby-gold/20 py-3 font-headline tracking-[0.12em]">
              RADIOGRAPHIE ARRIÈRE
              <input
                type="checkbox"
                checked={debugHind}
                onChange={(event) => setDebugHind(event.target.checked)}
                className="h-5 w-5 cursor-pointer accent-derby-red"
              />
            </label>

            <div className="font-mono text-xs leading-relaxed text-derby-parch/75">
              <p><b className="text-derby-cream">H</b> hanche · <b className="text-derby-cream">G</b> grasset · <b className="text-derby-cream">J</b> jarret</p>
              <p><b className="text-derby-cream">B</b> boulet · <b className="text-derby-cream">S</b> sabot</p>
              <p className="mt-2 text-[#F7D154]">Le sabot devient jaune pendant son appui.</p>
            </div>

            <div className="mt-auto border-t border-derby-gold/20 pt-3 font-terminal text-lg text-derby-smoke">
              ← → image précédente/suivante<br />
              ESPACE lecture/pause · HOME début
            </div>
          </aside>
        </section>

        <section className="panel-gold grid gap-4 p-3 md:grid-cols-[minmax(0,1fr)_300px] md:p-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="font-headline text-sm tracking-[0.3em] text-derby-gold">RÉFÉRENCE PHOTOGRAPHIQUE RÉELLE</div>
                <h2 className="font-display text-2xl text-derby-cream">Annie G. · Muybridge · 1887</h2>
              </div>
              <div className="border border-derby-gold/35 bg-black/30 px-3 py-1 font-terminal text-lg text-derby-gold">
                NOTRE POSE {String(selectedFrame + 1).padStart(2, '0')} ≈ PHOTO {String(muybridgeFrame).padStart(2, '0')} / 15
              </div>
            </div>
            <a href={MUYBRIDGE_SOURCE} target="_blank" rel="noreferrer" className="block cursor-pointer overflow-hidden border border-derby-gold/25 bg-[#E8E4DC]">
              <img
                src={MUYBRIDGE_PLATE}
                alt="Les quinze photographies successives du galop d’Annie G. par Eadweard Muybridge"
                className="block max-h-[360px] w-full object-contain mix-blend-multiply"
                referrerPolicy="no-referrer"
              />
            </a>
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="mb-2 font-headline text-sm tracking-[0.3em] text-derby-gold">MOUVEMENT ORIGINAL</div>
            <a href={MUYBRIDGE_SOURCE} target="_blank" rel="noreferrer" className="flex flex-1 cursor-pointer items-center justify-center border border-derby-gold/25 bg-[#EEEAE1] p-2">
              <img
                src={MUYBRIDGE_GIF}
                alt="Animation photographique réelle d’un cheval de course au galop"
                width={300}
                height={200}
                className="block h-auto w-full mix-blend-multiply"
                referrerPolicy="no-referrer"
              />
            </a>
            <p className="mt-2 font-mono text-xs leading-relaxed text-derby-parch/70">
              Référence domaine public · 15 poses de la planche 626. La comparaison est calée sur le premier impact postérieur.
            </p>
          </div>
        </section>

        <section className="panel-gold p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => stepFrame(-1)}
              className="cursor-pointer border border-derby-gold/40 bg-black/30 px-4 py-2 font-headline tracking-[0.16em] hover:border-derby-gold"
            >
              ← IMAGE
            </button>
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              aria-pressed={playing}
              className="min-w-32 cursor-pointer bg-derby-red px-5 py-2 font-headline tracking-[0.18em] text-white shadow-deep transition hover:brightness-110"
            >
              {playing ? '❚❚ PAUSE' : '▶ LIRE'}
            </button>
            <button
              type="button"
              onClick={() => stepFrame(1)}
              className="cursor-pointer border border-derby-gold/40 bg-black/30 px-4 py-2 font-headline tracking-[0.16em] hover:border-derby-gold"
            >
              IMAGE →
            </button>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {SPEEDS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSpeed(option.value)}
                  aria-pressed={speed === option.value}
                  className={`cursor-pointer border px-3 py-2 font-terminal text-lg transition ${
                    speed === option.value
                      ? 'border-derby-gold bg-derby-gold text-derby-night'
                      : 'border-derby-gold/30 bg-black/25 text-derby-parch hover:border-derby-gold'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-3 flex items-center gap-3 font-terminal text-lg text-derby-smoke">
            0
            <input
              aria-label="Phase précise du cycle"
              type="range"
              min={0}
              max={1199}
              value={Math.round(wrapCycle(phase) * 1199)}
              onChange={(event) => {
                setPlaying(false)
                setPhase(Number(event.target.value) / 1199)
              }}
              className="h-2 flex-1 cursor-pointer accent-derby-red"
            />
            1
          </label>
        </section>

        <section>
          <div className="mb-2 flex items-end justify-between">
            <h2 className="font-headline text-lg tracking-[0.3em] text-derby-gold">PLANCHE DES 12 POSES</h2>
            <span className="hidden font-terminal text-lg text-derby-smoke md:block">CLIQUER POUR ISOLER UNE IMAGE</span>
          </div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6 xl:grid-cols-12">
            {Array.from({ length: FRAME_COUNT }, (_, index) => (
              <PoseThumbnail key={index} index={index} active={selectedFrame === index} onSelect={selectFrame} />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
