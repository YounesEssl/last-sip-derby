type FeedbackKind = 'GOAL' | 'MISS' | 'LOCK' | 'SUCCESS'

let audioContext: AudioContext | null = null

/** Short, synthesized cues: no asset download and no long-lived oscillator. */
export function playGameFeedback(kind: FeedbackKind) {
  if (typeof window === 'undefined') return
  try {
    const AudioContextConstructor = window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return
    audioContext ??= new AudioContextConstructor()
    const context = audioContext
    void context.resume()
    const tones = kind === 'GOAL' || kind === 'SUCCESS'
      ? [{ frequency: 520, delay: 0, duration: .11 }, { frequency: 760, delay: .1, duration: .16 }]
      : kind === 'MISS'
        ? [{ frequency: 155, delay: 0, duration: .2 }]
        : [{ frequency: 390, delay: 0, duration: .1 }]

    for (const tone of tones) {
      const start = context.currentTime + tone.delay
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = kind === 'MISS' ? 'sawtooth' : 'triangle'
      oscillator.frequency.setValueAtTime(tone.frequency, start)
      gain.gain.setValueAtTime(.0001, start)
      gain.gain.exponentialRampToValueAtTime(.075, start + .012)
      gain.gain.exponentialRampToValueAtTime(.0001, start + tone.duration)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + tone.duration + .02)
    }
  } catch {
    // Audio may be blocked by the browser; visual and haptic feedback remain.
  }
}
