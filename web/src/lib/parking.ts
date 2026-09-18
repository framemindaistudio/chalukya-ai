import modelRaw from '../data/parking_model.json'
import calRaw from '../data/calendar.json'
import { PARKING, FOOTFALL, type Lot } from './data'
import { ymd } from './clock'

/*
  Live parking = IoT slot sensors reporting every 10 minutes. With no hardware attached, the
  "sensors" replay the queue simulation for today (same model the ML was trained on) with small
  jitter. A connected ESP32 or the backend overrides these values (see liveOverride).
  Prediction = the trained gradient-boosted trees (LightGBM, exported to JSON) evaluated here on the phone.
*/
type Tree = number | [number, number, Tree, Tree]
const MODEL = modelRaw as unknown as { features: string[]; lots: string[]; horizons: Record<string, { trees: Tree[] }> }
const CAL = calRaw as unknown as { days: Record<string, number[]> }
const STEP = PARKING.step_min, START_H = PARKING.start_hour

const liveOverride: Record<string, { occupied: number; at: number }> = {}
export function setLiveOccupancy(lot: string, occupied: number) { liveOverride[lot] = { occupied, at: Date.now() } }

function seriesFor(lot: Lot, date: Date): number[] {
  const key = ymd(date)
  if (lot.days[key]) return lot.days[key]
  // Outside the simulated window: reuse the same weekday, scaled by the footfall forecast
  const entries = Object.entries(lot.days)
  const same = entries.find(([d]) => new Date(d).getDay() === date.getDay()) ?? entries[0]
  const fd = FOOTFALL.sites[lot.site]?.forecast
  const a = fd?.find((f) => f.d === key)?.p50, b = fd?.find((f) => f.d === same[0])?.p50
  const k = a && b ? a / b : 1
  return same[1].map((v) => Math.min(lot.capacity, Math.round(v * k)))
}

function stepIndex(date: Date) { return Math.floor(((date.getHours() - START_H) * 60 + date.getMinutes()) / STEP) }

/** Current occupancy of a lot. Night hours read as nearly empty. */
export function occupancyAt(lotId: string, date: Date): number {
  const o = liveOverride[lotId]
  if (o && Date.now() - o.at < 5 * 60_000) return o.occupied
  const lot = PARKING.lots[lotId]
  const s = seriesFor(lot, date)
  const i = stepIndex(date)
  if (i < 0 || i >= s.length) return Math.round(lot.capacity * 0.04)
  const jitter = Math.round(Math.sin(date.getMinutes() * 1.7 + lotId.length) * 1.2)
  return Math.max(0, Math.min(lot.capacity, s[i] + jitter))
}

function evalTree(t: Tree, x: number[]): number {
  let n: Tree = t
  while (Array.isArray(n)) n = x[n[0]] <= n[1] ? n[2] : n[3]
  return n as number
}

function features(lotId: string, date: Date) {
  const lot = PARKING.lots[lotId]
  const occ = occupancyAt(lotId, date) / lot.capacity
  const past = occupancyAt(lotId, new Date(+date - 30 * 60_000)) / lot.capacity
  const cal = CAL.days[ymd(date)] ?? [ (date.getDay() + 6) % 7, +(date.getDay() % 6 === 0), 0, 0, 0, 0 ]
  const fd = FOOTFALL.sites[lot.site]?.forecast.find((f) => f.d === ymd(date))
  const vals: Record<string, number> = {
    occ_frac: occ, trend30: occ - past, minute_of_day: date.getHours() * 60 + date.getMinutes(),
    dow: cal[0], weekend: cal[1], holiday: cal[2], long_weekend: cal[3], school_vacation: cal[4], festival: cal[5],
    day_visitors_k: (fd?.p50 ?? 800) / 1000, capacity: lot.capacity, lot_idx: MODEL.lots.indexOf(lotId),
  }
  return MODEL.features.map((f) => vals[f])
}

/** Predicted free slots `minutes` ahead (30, 60 or 120), from the on-device model. */
export function predictFree(lotId: string, date: Date, minutes: 30 | 60 | 120): number {
  const lot = PARKING.lots[lotId]
  const h = new Date(+date + minutes * 60_000).getHours()
  if (h < START_H || h >= 19) return lot.capacity
  const x = features(lotId, date)
  const y = MODEL.horizons[String(minutes)].trees.reduce<number>((s, t) => s + evalTree(t, x), 0)
  const occ = Math.min(1, Math.max(0, y))
  return Math.max(0, Math.round(lot.capacity * (1 - occ)))
}

/** Free slots expected when you arrive in `inMin` minutes (interpolates between model horizons). */
export function freeOnArrival(lotId: string, date: Date, inMin: number): number {
  const lot = PARKING.lots[lotId]
  const nowFree = lot.capacity - occupancyAt(lotId, date)
  if (inMin <= 5) return nowFree
  const pts: [number, number][] = [[0, nowFree], [30, predictFree(lotId, date, 30)], [60, predictFree(lotId, date, 60)], [120, predictFree(lotId, date, 120)]]
  const m = Math.min(inMin, 120)
  for (let i = 1; i < pts.length; i++) {
    if (m <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
      return Math.round(y0 + ((y1 - y0) * (m - x0)) / (x1 - x0))
    }
  }
  return pts[3][1]
}

export function lotStatus(lotId: string, date: Date) {
  const lot = PARKING.lots[lotId]
  const occ = occupancyAt(lotId, date)
  return { id: lotId, ...lot, occupied: occ, free: lot.capacity - occ, ratio: occ / lot.capacity }
}

export const LOT_IDS = Object.keys(PARKING.lots)
