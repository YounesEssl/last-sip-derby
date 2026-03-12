'use client'

interface HorseSVGProps {
  color: string
  isRunning: boolean
  isStunned?: boolean
  scale?: number
}

export function HorseSVG({ color, isRunning, isStunned = false, scale = 1 }: HorseSVGProps) {
  const w = 80 * scale
  const h = 60 * scale

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 80 60"
      fill="none"
      style={{
        filter: isStunned ? 'brightness(0.4) saturate(0.3)' : 'none',
      }}
    >
      {/* Body */}
      <ellipse cx="38" cy="28" rx="18" ry="11" fill={color} />

      {/* Neck */}
      <path d="M52 24 L60 12 L56 10 L50 20 Z" fill={color} />

      {/* Head */}
      <ellipse cx="62" cy="10" rx="8" ry="5" fill={color} />
      {/* Eye */}
      <circle cx="65" cy="9" r="1.5" fill="#08090D" />
      {/* Nostril */}
      <circle cx="69" cy="11" r="1" fill="#08090D" opacity="0.5" />

      {/* Ear */}
      <path d="M59 5 L61 1 L63 5" fill={color} stroke={color} strokeWidth="1" />

      {/* Mane */}
      <path
        d="M54 12 Q52 8 56 6 Q54 10 58 8 Q56 14 52 16"
        fill="none"
        stroke="#08090D"
        strokeWidth="2"
        opacity="0.3"
      />

      {/* Tail */}
      <path
        d="M20 24 Q12 20 10 28 Q14 24 16 30"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      >
        {isRunning && !isStunned && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-5 20 24; 10 20 24; -5 20 24"
            dur="0.4s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Front legs */}
      <g>
        {isRunning && !isStunned ? (
          <>
            {/* Front left - extending */}
            <line x1="48" y1="36" x2="56" y2="52" stroke={color} strokeWidth="4" strokeLinecap="round">
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="-15 48 36; 20 48 36; -15 48 36"
                dur="0.3s"
                repeatCount="indefinite"
              />
            </line>
            {/* Front right - offset */}
            <line x1="44" y1="36" x2="52" y2="52" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.7">
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="20 44 36; -15 44 36; 20 44 36"
                dur="0.3s"
                repeatCount="indefinite"
              />
            </line>
          </>
        ) : (
          <>
            <line x1="48" y1="36" x2="50" y2="54" stroke={color} strokeWidth="4" strokeLinecap="round" />
            <line x1="44" y1="36" x2="46" y2="54" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          </>
        )}
      </g>

      {/* Back legs */}
      <g>
        {isRunning && !isStunned ? (
          <>
            <line x1="30" y1="36" x2="22" y2="52" stroke={color} strokeWidth="4" strokeLinecap="round">
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="20 30 36; -15 30 36; 20 30 36"
                dur="0.3s"
                repeatCount="indefinite"
              />
            </line>
            <line x1="26" y1="36" x2="18" y2="52" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.7">
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="-15 26 36; 20 26 36; -15 26 36"
                dur="0.3s"
                repeatCount="indefinite"
              />
            </line>
          </>
        ) : (
          <>
            <line x1="30" y1="36" x2="28" y2="54" stroke={color} strokeWidth="4" strokeLinecap="round" />
            <line x1="26" y1="36" x2="24" y2="54" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          </>
        )}
      </g>

      {/* Hooves */}
      {!isRunning && (
        <>
          <rect x="48" y="52" width="5" height="3" rx="1" fill="#1A1F2E" />
          <rect x="44" y="52" width="5" height="3" rx="1" fill="#1A1F2E" opacity="0.7" />
          <rect x="26" y="52" width="5" height="3" rx="1" fill="#1A1F2E" />
          <rect x="22" y="52" width="5" height="3" rx="1" fill="#1A1F2E" opacity="0.7" />
        </>
      )}

      {/* Jockey - saddle area */}
      <ellipse cx="40" cy="20" rx="6" ry="4" fill="#08090D" opacity="0.6" />
      {/* Jockey body */}
      <ellipse cx="40" cy="14" rx="4" ry="5" fill={color} opacity="0.8" />
      {/* Jockey head */}
      <circle cx="40" cy="8" r="3" fill="#F0EDE4" />
      {/* Jockey helmet */}
      <path d="M37 7 Q40 3 43 7" fill={color} />

      {/* Bounce animation on whole horse when running */}
      {isRunning && !isStunned && (
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 0 -2; 0 0"
          dur="0.15s"
          repeatCount="indefinite"
        />
      )}

      {/* Stun indicator */}
      {isStunned && (
        <>
          <text x="30" y="6" fontSize="12" fill="#D4A843" fontWeight="bold">
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 40 6; 360 40 6"
              dur="1s"
              repeatCount="indefinite"
            />
            *
          </text>
          <text x="46" y="4" fontSize="10" fill="#D4A843" fontWeight="bold">
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="180 40 6; 540 40 6"
              dur="1.2s"
              repeatCount="indefinite"
            />
            *
          </text>
        </>
      )}
    </svg>
  )
}
