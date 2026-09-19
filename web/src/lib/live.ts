import { useEffect, useState } from 'react'
import { setLiveOccupancy } from './parking'
import { isStaticHost } from './server'

/*
  Live events between tourists and the district control room: SOS, geofence breaches,
  overcrowding, heat and sensor alerts. Transport:
    • the backend WebSocket (/api/ws) when the laptop server is running (works across devices)
    • BroadcastChannel otherwise, so a tourist tab and a control-room tab on one machine still talk.
*/
export type Alert = {
  id: string; type: 'sos' | 'geofence' | 'crowd' | 'heat' | 'sensor' | 'parking' | 'checkin' | 'anomaly' | 'review'
  severity: 'info' | 'warn' | 'critical'; title: string; detail?: string; lat?: number; lng?: number; place?: string
  at: number; ack?: boolean; source: 'tourist' | 'iot' | 'model' | 'cctv'; data?: Record<string, unknown>
}

/* Usage analytics for the Tourism Department dashboard: what tourists ask, in which language,
   about which places. Anonymous counts only: no names, no phone numbers, no location trail. */
export type Stat = { kind: 'ask' | 'scan' | 'plan' | 'lang'; key: string; lang?: string; place?: string; at: number }
const statListeners = new Set<(s: Stat) => void>()
export function track(s: Omit<Stat, 'at'>) {
  const full = { ...s, at: Date.now() }
  statListeners.forEach((f) => f(full))
  bc?.postMessage({ __stat: full })
  if (wsOk && ws) ws.send(JSON.stringify({ kind: 'stat', stat: full }))
}
export function onStat(f: (s: Stat) => void) { statListeners.add(f); return () => { statListeners.delete(f) } }

const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('chalukya-live') : null
const listeners = new Set<(a: Alert) => void>()
let ws: WebSocket | null = null
let wsOk = false
let retry = 4000
const seen = new Set<string>()

function deliver(a: Alert) {
  if (seen.has(a.id + (a.ack ? ':ack' : ''))) return
  seen.add(a.id + (a.ack ? ':ack' : ''))
  listeners.forEach((f) => f(a))
}

async function connect() {
  if (await isStaticHost()) return  // static hosting (e.g. Vercel): alerts stay on this device and its tabs
  try {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${location.host}/api/ws`)
    ws.onopen = () => { wsOk = true; retry = 4000; flushOutbox() }
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data)
        if (m.kind === 'alert') deliver(m.alert)
        if (m.kind === 'stat') statListeners.forEach((f) => f(m.stat))
        // real (or simulated) ESP32 slot sensors override the replayed occupancy
        if (m.kind === 'iot' && m.reading?.node?.startsWith('p_') && m.reading.occupied != null) setLiveOccupancy(m.reading.node, m.reading.occupied)
      } catch { /* ignore */ }
    }
    ws.onclose = () => { const was = wsOk; wsOk = false; retry = was ? 3000 : Math.min(60000, retry * 2); setTimeout(connect, retry) }
    ws.onerror = () => ws?.close()
  } catch { /* no server */ }
}
if (typeof window !== 'undefined') connect()
bc?.addEventListener('message', (e) => { if (e.data?.__stat) statListeners.forEach((f) => f(e.data.__stat)); else deliver(e.data as Alert) })

/*
  Delivery to the control room. 'server' = the district server has it; 'queued' = no connection, so it is
  kept on the phone and re-sent automatically when the signal returns; 'device' = this site has no control
  room (static hosting), so only this phone's own tabs see it and the tourist must call 112.
*/
export type Delivery = 'server' | 'queued' | 'device'
const deliveryListeners = new Set<(id: string, d: Delivery) => void>()
export function onDelivery(f: (id: string, d: Delivery) => void) { deliveryListeners.add(f); return () => { deliveryListeners.delete(f) } }
const report = (id: string, d: Delivery) => deliveryListeners.forEach((f) => f(id, d))

const OUTBOX = 'chalukya.outbox'
const readOutbox = (): Alert[] => { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]') } catch { return [] } }
const writeOutbox = (l: Alert[]) => { try { localStorage.setItem(OUTBOX, JSON.stringify(l.slice(-20))) } catch { /* storage off */ } }

async function send(full: Alert): Promise<Delivery> {
  // the phone knows it has no network before a half-dead socket does
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'queued'
  if (wsOk && ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ kind: 'alert', alert: full })); return 'server' }
  if (await isStaticHost()) return 'device'
  try {
    const r = await fetch('/api/alerts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(full), signal: AbortSignal.timeout(5000) })
    if (!r.ok) throw new Error(String(r.status))
    return 'server'
  } catch { return 'queued' }
}

/** Re-send anything that could not reach the control room (called when the phone comes back online). */
export async function flushOutbox() {
  const pending = readOutbox()
  if (!pending.length) return
  const left: Alert[] = []
  for (const a of pending) { const d = await send(a); if (d === 'queued') left.push(a); else report(a.id, d) }
  writeOutbox(left)
}
if (typeof window !== 'undefined') { window.addEventListener('online', () => { flushOutbox() }); setTimeout(flushOutbox, 3000) }

export function publish(a: Omit<Alert, 'id' | 'at'> & { id?: string; at?: number }) {
  const full: Alert = { id: a.id ?? Math.random().toString(36).slice(2, 10), at: a.at ?? Date.now(), ...a } as Alert
  deliver(full)
  bc?.postMessage(full)
  send(full).then((d) => {
    if (d === 'queued' && full.severity !== 'info') writeOutbox([...readOutbox().filter((x) => x.id !== full.id), full])
    report(full.id, d)
  })
  return full
}

export function onAlert(f: (a: Alert) => void) { listeners.add(f); return () => { listeners.delete(f) } }
export const serverConnected = () => wsOk

export function useAlerts(max = 40) {
  const [list, setList] = useState<Alert[]>([])
  useEffect(() => onAlert((a) => setList((l) => {
    const i = l.findIndex((x) => x.id === a.id)
    if (i >= 0) { const c = [...l]; c[i] = { ...c[i], ...a }; return c }
    return [a, ...l].slice(0, max)
  })), [max])
  return [list, setList] as const
}
