'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface RulebookViewerProps {
  open: boolean
  onClose: () => void
}

export function RulebookViewer({ open, onClose }: RulebookViewerProps) {
  const [closing, setClosing] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const closeRetryRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) {
      if (closeRetryRef.current !== null) window.clearTimeout(closeRetryRef.current)
      closeRetryRef.current = null
      setClosing(false)
      return
    }

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 80)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setClosing(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => () => {
    if (closeRetryRef.current !== null) window.clearTimeout(closeRetryRef.current)
  }, [])

  const requestClose = useCallback(() => {
    if (!closing) setClosing(true)
  }, [closing])

  return (
    <AnimatePresence onExitComplete={() => {
      if (!closing) return
      onClose()
      closeRetryRef.current = window.setTimeout(() => setClosing(false), 1_000)
    }}>
      {open && !closing && (
        <motion.div
          key="rulebook-viewer"
          data-testid="rulebook-viewer"
          className="fixed inset-0 z-[200] flex cursor-default justify-end bg-black/72"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-label="Livret officiel des règles"
        >
          <motion.aside
            className="flex h-full w-full max-w-[880px] flex-col border-l-2 border-derby-gold/70 bg-[#d8d1c4] shadow-[-24px_0_70px_rgba(0,0,0,.65)]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-derby-gold/45 bg-derby-night px-5 text-derby-cream shadow-md">
              <div className="min-w-0">
                <div className="truncate font-headline text-lg tracking-[0.16em]">LIVRET OFFICIEL DES RÈGLES</div>
                <div className="font-body text-[10px] font-bold uppercase tracking-[0.15em] text-derby-gold">Partie en pause</div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                data-testid="rulebook-close"
                onClick={requestClose}
                aria-label="Fermer les règles et reprendre la partie"
                title="Fermer et reprendre · Échap"
                className="ml-4 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded border border-derby-gold/70 bg-derby-cream/10 font-headline text-2xl leading-none text-derby-cream transition-colors hover:bg-derby-red focus:outline-none focus:ring-2 focus:ring-derby-gold"
              >
                ×
              </button>
            </div>
            <iframe
              data-testid="rulebook-frame"
              title="Livret officiel des règles de L'Apérodrome"
              src="/rulebook/index.html?v=2026.08.14-odds-v2"
              className="min-h-0 flex-1 border-0 bg-[#d8d1c4]"
            />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
