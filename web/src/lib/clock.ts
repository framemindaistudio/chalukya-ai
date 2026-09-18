import { useEffect, useState } from 'react'

/*
  The app runs on real time by default. For a live demo you can pin a "demo clock"
  (e.g. a busy Sunday 11 AM) from the command centre, or with ?t=2026-09-27T11:00 in the URL.
*/
let offsetMs = 0
const listeners = new Set<() => void>()

try {
  const q = new URLSearchParams(location.search).get('t')
  const saved = q ?? sessionStorage.getItem('chalukya.demoClock')
  if (saved) {
    const d = new Date(saved)
    if (!isNaN(+d)) offsetMs = +d - Date.now()
    if (q) sessionStorage.setItem('chalukya.demoClock', q)
  }
} catch { /* storage blocked: real time only */ }

export const now = () => new Date(Date.now() + offsetMs)
export const isDemoClock = () => offsetMs !== 0

export function setDemoClock(iso: string | null) {
  offsetMs = iso ? +new Date(iso) - Date.now() : 0
  try { iso ? sessionStorage.setItem('chalukya.demoClock', iso) : sessionStorage.removeItem('chalukya.demoClock') } catch { /* ignore */ }
  listeners.forEach((f) => f())
}

/** Re-renders every `everyMs` and whenever the demo clock changes. */
export function useNow(everyMs = 30_000) {
  const [t, setT] = useState(now)
  useEffect(() => {
    const tick = () => setT(now())
    const id = setInterval(tick, everyMs)
    listeners.add(tick)
    return () => { clearInterval(id); listeners.delete(tick) }
  }, [everyMs])
  return t
}

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const hhmm = (mins: number) => {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60)
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`
}
export const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h >= 12 ? 'PM' : 'AM'}`
