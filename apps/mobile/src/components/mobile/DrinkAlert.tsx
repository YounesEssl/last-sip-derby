interface Props {
  notification: { sips: number; reason: string } | null
  onConfirm: () => void
}

export const DrinkAlert = ({ notification, onConfirm }: Props) => {
  if (!notification) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-pmu-alert animate-[blink-3x_0.5s_infinite]">
      <div className="bg-black text-white w-full max-w-sm h-3/4 flex flex-col items-center justify-between p-8 border-8 border-white shadow-2xl relative overflow-hidden">
        
        {/* Flashy stripes background inside */}
        <div className="absolute inset-0 opacity-20"
           style={{ backgroundImage: 'repeating-linear-gradient(45deg, #E83B3B 0, #E83B3B 20px, transparent 20px, transparent 40px)' }}>
        </div>

        <div className="z-10 text-center w-full mt-12">
          <h2 className="font-display text-9xl text-pmu-alert mb-4 tracking-widest" style={{ textShadow: '4px 4px 0 #fff' }}>
            BOIS !
          </h2>
          <div className="font-mono text-8xl font-bold text-pmu-board mb-6 bg-black px-4 py-2 inline-block border-4 border-white transform rotate-3">
            {notification.sips} GORGÉE{notification.sips > 1 ? 'S' : ''}
          </div>
          <p className="font-mono text-3xl uppercase font-bold text-center mt-8 px-4 bg-black">
            {notification.reason}
          </p>
        </div>

        <button
          onClick={onConfirm}
          className="z-10 w-full bg-white text-black py-6 border-b-8 border-r-8 border-gray-400 active:border-0 active:translate-y-2 active:translate-x-2 font-display text-5xl font-bold uppercase tracking-widest mb-4"
        >
          J'AI BU
        </button>
      </div>
    </div>
  )
}
