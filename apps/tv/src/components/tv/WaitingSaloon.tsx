import { QRCodeSVG } from 'qrcode.react'

export const WaitingSaloon = () => {
  // Try to use window location, fallback if server rendering
  const joinUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : ''

  return (
    <div className="flex flex-col items-center justify-center h-full text-pmu-board">
      <h1 className="font-display text-8xl mb-4 led-glow animate-pulse">
        INSERT COIN
      </h1>
      
      <p className="font-terminal text-4xl mb-12">
        AWAITING PLAYERS...
      </p>

      {/* QR Code container with chunky border */}
      <div className="bg-pmu-board p-4 border-8 border-pmu-dark shadow-2xl mt-4">
        {joinUrl ? (
          <QRCodeSVG value={joinUrl} size={300} bgColor="#39FF14" fgColor="#0f0a07" />
        ) : (
          <div className="w-[300px] h-[300px] bg-[#0f0a07]" />
        )}
      </div>

      <p className="font-body text-2xl mt-8 p-3 border-2 border-pmu-board uppercase tracking-widest">
        Scan to enter the Derby
      </p>
    </div>
  )
}
