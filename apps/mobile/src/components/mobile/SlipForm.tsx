import { useState } from 'react'

export const SlipForm = ({ onJoin }: { onJoin: (pseudo: string) => void }) => {
  const [pseudo, setPseudo] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pseudo.trim()) onJoin(pseudo.trim().toUpperCase())
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative">
      <div className="paper-texture"></div>

      {/* TICKET HEADER */}
      <h1 className="font-display text-4xl text-center text-pmu-alert mb-2 drop-shadow-md transform -rotate-2">
        LAST SIP DERBY
      </h1>
      <div className="text-pmu-dark font-body text-sm tracking-widest border-b-4 border-pmu-dark pb-2 mb-6 text-center uppercase font-bold w-full max-w-xs">
        PMU OFFICIEL - ENREGISTREMENT
      </div>

      {/* FORM AREA */}
      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-5">
        <div>
          <label className="block font-mono text-base text-pmu-wood mb-2 uppercase font-bold">
            NOM DU PARIEUR :
          </label>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="w-full bg-transparent border-4 border-pmu-wood p-3 font-mono text-xl uppercase outline-none text-pmu-dark placeholder-pmu-wood/50 shadow-inner"
            placeholder="EX: DUDULE"
            maxLength={12}
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-pmu-alert text-white py-4 border-b-6 border-r-6 border-[#a02020] active:border-0 active:translate-y-2 active:translate-x-2 font-display text-3xl uppercase tracking-widest shadow-xl transition-all"
        >
          ENTRER
        </button>
      </form>

      {/* TICKET DECORATION */}
      <div className="absolute bottom-10 opacity-30 pointer-events-none text-center font-mono text-xs">
        <p>NO 984-123-456</p>
        <p className="border-t-2 border-black border-dashed mt-2 pt-2">SOUMIS À LA RÉGLEMENTATION</p>
      </div>
    </div>
  )
}
