import { useEffect, useState } from 'react'

/*
  "Add to home screen". Chrome and Edge on Android fire beforeinstallprompt once, early, so this module
  is imported at start-up to catch it. iPhones have no prompt: the card shows the two taps instead.
*/
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferred: PromptEvent | null = null
const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as PromptEvent; notify() })
  window.addEventListener('appinstalled', () => { deferred = null; notify() })
}

export const isStandalone = () => typeof window !== 'undefined' &&
  (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)

export async function promptInstall() {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null; notify()
  return outcome === 'accepted'
}

export function useInstall() {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick((x) => x + 1); subs.add(f); return () => { subs.delete(f) } }, [])
  const standalone = isStandalone()
  return { canPrompt: !!deferred && !standalone, iosHint: isIOS() && !standalone, standalone }
}
