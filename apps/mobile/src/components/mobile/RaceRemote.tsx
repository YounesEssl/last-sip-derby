interface Props {
  boostWindow: { horseId: string; durationMs: number } | null
  onTapBoost: () => void
  horseLane?: number
}

export const RaceRemote = ({ boostWindow, onTapBoost, horseLane }: Props) => {
  const canBoost = !!boostWindow

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#1c1613] text-white p-6 relative overflow-hidden">
      
      {/* BACKGROUND DECORATION */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 10px, transparent 10px, transparent 20px)' }}>
      </div>

      <div className="z-10 text-center w-full max-w-sm">
        <div className="mb-12">
          <h2 className="text-4xl font-display tracking-widest text-pmu-amber mb-2 drop-shadow-lg">LA COURSE EST EN COURS</h2>
          {horseLane ? (
            <p className="text-2xl font-mono text-gray-300">VOTRE CHEVAL: <span className="font-bold text-white text-4xl ml-2">{horseLane}</span></p>
          ) : (
            <p className="text-2xl font-mono text-pmu-alert font-bold">VOUS N'AVEZ PAS PARIÉ</p>
          )}
        </div>

        {/* MASSIVE BUTTON */}
        <button
          disabled={!canBoost}
          onClick={onTapBoost}
          className={`
            w-full aspect-square rounded-full flex items-center justify-center flex-col transition-all duration-75 relative
            ${canBoost 
              ? 'bg-pmu-alert border-b-[20px] border-[#8a1c1c] active:border-b-0 active:translate-y-[20px] shadow-[0_0_50px_rgba(232,59,59,0.5)]' 
              : 'bg-gray-700 border-b-[20px] border-gray-900 opacity-50 cursor-not-allowed'}
          `}
        >
          {canBoost && <div className="absolute inset-0 rounded-full border-[10px] border-white/20 animate-ping"></div>}
          <span className="font-display text-7xl font-bold tracking-wider drop-shadow-md">
            COUP
          </span>
          <span className="font-display text-5xl font-bold tracking-wider drop-shadow-md">
            DE FOUET
          </span>
        </button>

        <p className={`mt-16 text-2xl font-mono font-bold ${canBoost ? 'animate-pulse text-pmu-board' : 'text-gray-500'}`}>
          {canBoost ? "MARTÈLE LE BOUTON !" : "EN ATTENTE..."}
        </p>

      </div>
    </div>
  )
}
