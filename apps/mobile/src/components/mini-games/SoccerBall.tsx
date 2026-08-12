export function SoccerBall({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id="ball-shade" cx="34%" cy="28%" r="72%">
          <stop offset="0" stopColor="#fffdf4" />
          <stop offset=".7" stopColor="#e7e0cf" />
          <stop offset="1" stopColor="#8f887b" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#ball-shade)" stroke="#171411" strokeWidth="5" />
      <path d="m50 28 15 11-6 18H41l-6-18Z" fill="#171411" />
      <path d="M50 28 48 8M65 39l20-8M59 57l13 18M41 57 28 75M35 39l-20-8M48 8 27 17 15 14M48 8l24 17-7 14M85 31l4 24-30 2M72 75l-22 14-22-14M15 31l-4 24 30 2" fill="none" stroke="#171411" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  )
}
