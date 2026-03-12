interface ParallaxBackgroundProps {
  isRacing: boolean
  raceProgress: number
  isFinished: boolean
}

const LAYERS: Array<{
  src: string
  zIndex: number
  racingDuration: string
  posY: string
}> = [
  { src: '/bg/6.png', zIndex: 0, racingDuration: '14s', posY: 'top' },
  { src: '/bg/5.png', zIndex: 1, racingDuration: '8s', posY: 'top' },
  { src: '/bg/4.png', zIndex: 2, racingDuration: '5.5s', posY: 'bottom' },
  { src: '/bg/3.png', zIndex: 3, racingDuration: '3.5s', posY: 'bottom' },
  { src: '/bg/2.png', zIndex: 4, racingDuration: '2s', posY: 'bottom' },
  { src: '/bg/1.png', zIndex: 5, racingDuration: '1s', posY: 'bottom' },
]

export const ParallaxBackground = ({ isRacing, raceProgress, isFinished }: ParallaxBackgroundProps) => {
  const showFinish = (isRacing && raceProgress > 80) || isFinished
  const finishLeft = isFinished
    ? 0
    : showFinish
      ? 100 - ((raceProgress - 80) / 20) * 100
      : 100

  // Freeze = pause animation in place (not remove it)
  const playState = isFinished ? 'paused' : isRacing ? 'running' : 'paused'

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {LAYERS.map((layer) => (
        <div
          key={layer.src}
          className="absolute inset-0 bg-scroll"
          style={{
            backgroundImage: `url('${layer.src}')`,
            backgroundPositionY: layer.posY,
            zIndex: layer.zIndex,
            animationDuration: layer.racingDuration,
            animationPlayState: playState,
          }}
        />
      ))}

      {/* 7.png slides in over 2.png, freezes on finish */}
      {showFinish && (
        <div
          className="absolute top-0 h-full"
          style={{
            zIndex: 4,
            width: '100vw',
            left: `${finishLeft}vw`,
            backgroundImage: "url('/bg/7.png')",
            backgroundSize: '100vw auto',
            backgroundRepeat: 'no-repeat',
            backgroundPositionY: 'bottom',
          }}
        />
      )}
    </div>
  )
}
