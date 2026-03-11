'use client'

import { useEffect, useState } from 'react'

export function useNoSleep() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let noSleep: { enable: () => void; disable: () => void } | null = null

    const init = async () => {
      const NoSleep = (await import('nosleep.js')).default
      noSleep = new NoSleep()

      const enableNoSleep = () => {
        noSleep?.enable()
        setEnabled(true)
      }

      document.addEventListener('touchstart', enableNoSleep, { once: true })
      document.addEventListener('click', enableNoSleep, { once: true })
    }

    init()

    return () => {
      noSleep?.disable()
    }
  }, [])

  return enabled
}
