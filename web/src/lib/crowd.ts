import { FOOTFALL, FORECAST_SITE, type ForecastDay } from './data'
import { ymd } from './clock'

export type Level = 'low' | 'moderate' | 'busy' | 'packed'
export const OPEN_H = 6, CLOSE_H = 18 // hourly arrays cover 06:00–18:00 (13 slots)

export function levelOf(present: number, capacity: number): Level {
  const r = present / capacity
  return r < 0.35 ? 'low' : r < 0.65 ? 'moderate' : r < 0.9 ? 'busy' : 'packed'
}
export const LEVEL_COLOR: Record<Level, string> = { low: '#2b776e', moderate: '#d9a441', busy: '#c0562f', packed: '#8f2a17' }

export function dayForecast(placeOrSite: string, date: Date): ForecastDay | null {
  const site = FORECAST_SITE[placeOrSite] ?? placeOrSite
  const s = FOOTFALL.sites[site]
  if (!s) return null
  const key = ymd(date)
  return s.forecast.find((f) => f.d === key) ?? null
}

export function capacityOf(placeOrSite: string) {
  const site = FORECAST_SITE[placeOrSite] ?? placeOrSite
  return FOOTFALL.sites[site]?.capacity ?? 500
}

export function isOpen(date: Date) {
  const h = date.getHours() + date.getMinutes() / 60
  return h >= OPEN_H && h < CLOSE_H + 0.5
}

/** People on site at a given time (linear between hourly points). null when closed or no forecast. */
export function presentAt(placeOrSite: string, date: Date): number | null {
  const f = dayForecast(placeOrSite, date)
  if (!f || !isOpen(date)) return null
  const x = Math.min(Math.max(date.getHours() + date.getMinutes() / 60 - OPEN_H, 0), f.hourly.length - 1)
  const i = Math.floor(x), fr = x - i
  const a = f.hourly[i], b = f.hourly[Math.min(i + 1, f.hourly.length - 1)]
  return Math.round(a + (b - a) * fr)
}

export function crowdNow(placeOrSite: string, date: Date) {
  const present = presentAt(placeOrSite, date)
  if (present == null) return null
  const cap = capacityOf(placeOrSite)
  return { present, capacity: cap, level: levelOf(present, cap), ratio: present / cap }
}

/** Best and worst hours of a day, skipping hot midday in the hot season. */
export function bestHours(placeOrSite: string, date: Date, fromHour = OPEN_H) {
  const f = dayForecast(placeOrSite, date)
  if (!f) return null
  const month = date.getMonth() + 1
  const hot = month >= 3 && month <= 5
  const hours = f.hourly.map((v, i) => ({ h: OPEN_H + i, v, heat: hot && OPEN_H + i >= 11 && OPEN_H + i <= 15 }))
  const usable = hours.filter((x) => x.h >= fromHour && x.h <= CLOSE_H - 1)
  const pool = usable.length ? usable : hours
  const quiet = [...pool].sort((a, b) => (a.v + (a.heat ? 1e6 : 0)) - (b.v + (b.heat ? 1e6 : 0)))[0]
  const busy = [...hours].sort((a, b) => b.v - a.v)[0]
  return { quiet, busy, day: f }
}

export function upcomingEvents(date: Date, days = 60) {
  const out: { d: string; tag: string }[] = []
  const s = FOOTFALL.sites.badami_caves.forecast
  const bs = FOOTFALL.sites.banashankari.forecast
  const start = ymd(date)
  let last = ''
  for (const f of [...s, ...bs].sort((a, b) => a.d.localeCompare(b.d))) {
    if (f.d < start || !f.tag || f.tag === 'School vacation' || f.tag === last) continue
    out.push({ d: f.d, tag: f.tag }); last = f.tag
    if (out.length > 8) break
  }
  return out.filter((e) => (+new Date(e.d) - +date) / 864e5 <= days)
}
