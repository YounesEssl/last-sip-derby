'use client'

import { useState } from 'react'

export function JoinScreen({ onJoin, connected }: { onJoin: (pseudo: string) => void; connected: boolean }) {
  const [name, setName] = useState('')
  const valid = name.trim().length >= 2

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-8">
      <div className="text-center animate-rise">
        <div className="font-headline text-sm font-light tracking-[0.5em] text-derby-parch/80">
          ✦ HIPPODROME DU DERNIER VERRE ✦
        </div>
        <h1 className="text-engraved mt-2 font-display text-5xl leading-tight">
          Last Sip
          <br />
          Derby
        </h1>
        <div className="mt-2 font-hand text-xl text-derby-parch/70 -rotate-1">
          courses truquées &amp; gorgées garanties
        </div>
      </div>

      <form
        className="paper ticket-edge w-full max-w-sm rounded-lg px-6 py-7 animate-rise"
        style={{ animationDelay: '0.12s' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onJoin(name.trim())
        }}
      >
        <label className="block text-center font-headline text-lg tracking-[0.3em] text-derby-coal">
          TON BLAZE DE TURFISTE
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 16))}
          placeholder="Ex: Dédé la Chance"
          autoFocus
          className="mt-3 w-full rounded-md border-2 border-dashed border-derby-coal/40 bg-transparent px-4 py-3 text-center font-body text-2xl font-bold text-derby-coal outline-none placeholder:text-derby-coal/30 focus:border-derby-red"
        />
        <button
          type="submit"
          disabled={!valid || !connected}
          className="btn-big mt-5 w-full rounded-lg bg-derby-red py-4 font-headline text-2xl tracking-[0.2em] text-derby-cream shadow-lg disabled:opacity-40"
        >
          {connected ? 'ENTRER À L’HIPPODROME' : 'CONNEXION...'}
        </button>
        <p className="mt-3 text-center font-body text-xs text-derby-coal/60">
          En entrant, tu acceptes de boire tes défaites.
        </p>
      </form>
    </div>
  )
}
