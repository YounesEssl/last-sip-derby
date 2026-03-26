interface Props {
  horseName?: string
}

export const RaceRemote = ({ horseName }: Props) => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#1c1613] text-white p-6 relative overflow-hidden">

      {/* BACKGROUND DECORATION */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
           style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 10px, transparent 10px, transparent 20px)' }}>
      </div>

      <div className="z-10 text-center w-full max-w-xs px-4">
        <h2 className="text-2xl font-display tracking-widest text-pmu-amber mb-4 drop-shadow-lg">
          LA COURSE EST EN COURS
        </h2>
        {horseName ? (
          <p className="text-base font-mono text-gray-300">
            VOTRE CHEVAL: <span className="font-bold text-white text-xl block mt-2">{horseName}</span>
          </p>
        ) : (
          <p className="text-base font-mono text-pmu-alert font-bold">VOUS N'AVEZ PAS PARIE</p>
        )}
        <p className="mt-8 text-base font-mono text-gray-500 animate-pulse">REGARDE L'ECRAN...</p>
      </div>
    </div>
  )
}
