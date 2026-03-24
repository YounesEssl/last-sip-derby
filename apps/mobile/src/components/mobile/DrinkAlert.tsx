interface Props {
  notification: { sips: number; reason: string } | null
}

export const DrinkAlert = ({ notification }: Props) => {
  if (!notification) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: '#1a0000' }}
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center">

        {/* Big sips number */}
        <div className="relative mb-6">
          <div className="text-[120px] font-display leading-none text-red-500"
            style={{ textShadow: '0 0 40px rgba(239,68,68,0.5)' }}
          >
            {notification.sips}
          </div>
          <p className="text-2xl font-mono text-red-300 uppercase tracking-widest -mt-2">
            gorgee{notification.sips > 1 ? 's' : ''}
          </p>
        </div>

        {/* BOIS header */}
        <div className="w-full py-3 mb-6"
          style={{ background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.3)', borderRadius: 12 }}
        >
          <h2 className="font-display text-5xl text-red-400 tracking-widest">BOIS !</h2>
        </div>

        {/* Reason */}
        <p className="font-mono text-base text-white/50 leading-relaxed px-4 mb-8">
          {notification.reason}
        </p>

        {/* Info */}
        <p className="font-mono text-sm text-white/30 animate-pulse">
          Les autres joueurs vont valider...
        </p>
      </div>
    </div>
  )
}
