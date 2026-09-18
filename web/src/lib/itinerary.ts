import { LOT_FOR_SITE, PARKING, PLACES, FORECAST_SITE, placeById, road, type Place } from './data'
import { capacityOf, dayForecast, levelOf, type Level } from './crowd'
import { freeOnArrival, occupancyAt } from './parking'
import { rankEateries, type Ranked } from './recommend'
import { roadKm } from './geo'
import { now, ymd } from './clock'
import type { Eatery } from './data'

/*
  Crowd-aware trip planner.
  1. Score places by interest match × importance (and step-free need).
  2. Pick each day's places greedily by utility per minute of detour, as long as a full tour fits
     the time window (a whole day, or "I have 6 hours" starting now).
  3. For each day, search every visiting order (≤ 7 stops → ≤ 5,040 orders) and keep the one with the
     lowest cost = travel time + crowd exposure (forecast model) + heat exposure on stairs + waiting
     at closed gates + arriving after closing, with a bonus for sunset at Agastya Lake.
  4. Add a lunch stop (recommender; family-friendly when travelling with children), parking forecast at
     each arrival, distance, CO2 and an estimated spend against the traveller's budget.
*/
export type Interest = 'heritage' | 'pilgrimage' | 'crafts' | 'nature'
export type Mobility = 'normal' | 'senior' | 'wheelchair'
export type Mode = 'car' | 'bus' | 'bike'
export type PlanInput = {
  start: Date; days: number; interests: Interest[]; mobility: Mobility; mode: Mode; people: number
  startFrom: string                // a place id or 'badami_bus_stand' / 'bagalkot_town'
  startMin?: number                // day 1 start time, minutes after midnight (default 7:00)
  hours?: number                   // day 1 time available (default: until sunset)
  kids?: number; budget?: number
}

const IMPORTANCE: Record<string, number> = {
  pattadakal: 1, badami_caves: 1, aihole: 0.95, bhutanatha: 0.8, kudalasangama: 0.7, mahakuta: 0.65, banashankari: 0.6,
  badami_fort: 0.6, aihole_meguti: 0.55, aihole_ravanaphadi: 0.55, badami_museum: 0.5, ilkal: 0.45, almatti: 0.4,
  guledgudda: 0.4, siddanakolla: 0.35, yadahalli: 0.35, amingad: 0.3,
}
export const INTEREST_TAGS: Record<Interest, string[]> = {
  heritage: ['cave', 'rock-cut', 'temple', 'architecture', 'unesco', 'sculpture', 'museum', 'inscription', 'history', 'fort'],
  pilgrimage: ['active-worship', 'pilgrimage', 'festival'],
  crafts: ['craft', 'textile', 'shopping', 'local-livelihood', 'sweets'],
  nature: ['nature', 'lake', 'sunset', 'wildlife', 'hike', 'viewpoint', 'birding', 'garden', 'river'],
}
const SPEED_KMH = { car: 40, bus: 28, bike: 38 }
const CO2_PER_KM = { car: 0.17, bus: 0.035, bike: 0.06 }   // kg: car per vehicle, bus per passenger, two-wheeler per vehicle
const RUPEES_PER_KM = { car: 9, bus: 1.3, bike: 3 }       // fuel/fare planning assumption: car per vehicle, bus per person
const DAY_START = 7 * 60, DAY_END = 18 * 60 + 30, LUNCH = 60

export function travel(a: string, b: string, mode: Mode) {
  if (a === b) return { km: 0, min: 0 }
  const r = road(a, b)
  if (r) return { km: r.km, min: mode === 'car' ? r.min : Math.round((r.km / SPEED_KMH[mode]) * 60) }
  const pa = placeById[a] ?? { lat: 15.9203, lng: 75.679 }, pb = placeById[b] ?? { lat: 15.9203, lng: 75.679 }
  const km = Math.round(roadKm(pa, pb) * 10) / 10
  return { km, min: Math.round((km / SPEED_KMH[mode]) * 60) }
}

export function utility(p: Place, inp: Pick<PlanInput, 'interests' | 'mobility' | 'kids'>) {
  const tags = new Set(p.tags)
  const hits = inp.interests.reduce((s, i) => s + (INTEREST_TAGS[i].some((t) => tags.has(t)) ? 1 : 0), 0)
  let u = (IMPORTANCE[p.id] ?? 0.3) * (0.4 + 0.6 * Math.min(1, hits))
  if (inp.mobility !== 'normal' && p.visit.stairs) u *= inp.mobility === 'wheelchair' ? 0 : 0.55
  if (inp.mobility === 'wheelchair' && p.visit.wheelchair === 'no') u = 0
  if (inp.kids && tags.has('family')) u *= 1.1
  return u
}

export type Stop = { id: string; arrive: number; depart: number; travelMin: number; km: number; level: Level | null; present: number | null; parkingFree: number | null; parkingCap: number | null; note?: string }
export type DayPlan = {
  date: string; start: number; stops: Stop[]; lunch: { afterIndex: number; at: number; eatery: Ranked<Eatery> | null } | null
  km: number; driveMin: number; co2: number; co2Bus: number; endAt: number
  cost: { travel: number; food: number; total: number }
}
type Win = { start: number; end: number; lunch: boolean }

function simulate(order: string[], date: Date, inp: PlanInput, win: Win, isToday: boolean, withModel = false) {
  let t = win.start, prev: string = inp.startFrom, cost = 0, km = 0, drive = 0
  const stops: Stop[] = []
  const month = date.getMonth() + 1, hot = month >= 3 && month <= 5
  let lunchDone = !win.lunch
  for (const id of order) {
    const p = placeById[id]
    const tv = travel(prev, id, inp.mode)
    t += tv.min; km += tv.km; drive += tv.min; cost += tv.min
    if (!lunchDone && t >= 13 * 60) { t += LUNCH; lunchDone = true }
    const [opens, closes] = openWindow(p)
    if (t < opens) { cost += (opens - t) * 0.8; t = opens }          // waiting at the gate is wasted time
    if (t + p.visit.minutes > closes) cost += (t + p.visit.minutes - closes) * 8
    const f = dayForecast(FORECAST_SITE[id] ?? id, date)
    const hIdx = Math.min(12, Math.max(0, Math.floor(t / 60) - 6))
    const present = f ? f.hourly[hIdx] : null
    const cap = capacityOf(id)
    const crowd = present != null ? present / cap : 0.3
    cost += 55 * crowd * (p.visit.minutes / 60)
    const midday = t >= 11 * 60 && t <= 15 * 60 + 30
    if (p.visit.stairs && midday) cost += (hot ? 60 : 18) * (inp.mobility === 'senior' ? 2 : inp.kids ? 1.4 : 1)
    if (inp.kids && p.visit.shade === 'low' && midday) cost += 10
    if (id === 'bhutanatha' && t >= 16 * 60 + 30) cost -= 25 // sunset at the lake
    const lots = LOT_FOR_SITE[FORECAST_SITE[id] ?? ''] ?? []
    let parkingFree: number | null = null, parkingCap: number | null = null
    if (lots.length && inp.mode !== 'bus') {
      const lot = lots[0]
      const arriveDate = new Date(date); arriveDate.setHours(Math.floor(t / 60), t % 60, 0, 0)
      // during the search use the sensor-day curve (fast); for the chosen route run the on-device model
      if (withModel && isToday) parkingFree = freeOnArrival(lot, now(), Math.max(0, (+arriveDate - +now()) / 60000))
      else parkingFree = Math.max(0, occupancyCap(lot) - occupancyAt(lot, arriveDate))
      parkingCap = occupancyCap(lot)
      if (parkingFree <= 2) cost += 30
    }
    const arrive = t
    t += p.visit.minutes
    stops.push({ id, arrive, depart: t, travelMin: tv.min, km: tv.km, level: present != null ? levelOf(present, cap) : null, present, parkingFree, parkingCap })
    prev = id
  }
  const back = travel(prev, inp.startFrom, inp.mode)
  t += back.min; km += back.km; drive += back.min; cost += back.min * 0.5
  if (t > win.end + 20) cost += (t - win.end - 20) * 8
  return { stops, cost, km, drive, endAt: t }
}
const occupancyCap = (lot: string) => PARKING.lots[lot].capacity

/** Nearest-neighbour tour length (travel + visits + lunch + return): a quick feasibility check. */
function tourMinutes(ids: string[], inp: PlanInput, win: Win) {
  let at: string = inp.startFrom, total = win.lunch ? LUNCH : 0
  const left = [...ids]
  while (left.length) {
    left.sort((a, b) => travel(at, a, inp.mode).min - travel(at, b, inp.mode).min)
    const nx = left.shift()!
    total += travel(at, nx, inp.mode).min + placeById[nx].visit.minutes
    at = nx
  }
  return total + travel(at, inp.startFrom, inp.mode).min
}
/** Opening window in minutes from midnight. Museums keep office hours; monuments run sunrise–sunset. */
function openWindow(p: Place): [number, number] {
  return p.kind === 'museum' ? [9 * 60, 17 * 60] : [6 * 60, 18 * 60 + 15]
}

function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a]
  const out: T[][] = []
  a.forEach((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).forEach((p) => out.push([x, ...p])))
  return out
}

export function plan(inp: PlanInput): DayPlan[] {
  const cand = PLACES.map((p) => ({ p, u: utility(p, inp) })).filter((c) => c.u > 0.2).sort((a, b) => b.u - a.u)
  const used = new Set<string>()
  const days: DayPlan[] = []
  const todayKey = ymd(now())
  const people = Math.max(1, inp.people)
  for (let d = 0; d < inp.days; d++) {
    const date = new Date(inp.start); date.setDate(date.getDate() + d)
    const start = d === 0 && inp.startMin != null ? Math.max(6 * 60, inp.startMin) : DAY_START
    const end = d === 0 && inp.hours ? Math.min(DAY_END + 30, start + inp.hours * 60) : DAY_END
    const win: Win = { start, end, lunch: start <= 12 * 60 + 30 && end >= 14 * 60 }
    const budgetMin = end - start
    // Geography-aware greedy: add the place with the best utility per minute of detour while a full tour still fits.
    const chosen: string[] = []
    const pool = cand.filter((c) => !used.has(c.p.id))
    while (chosen.length < 6) {
      let pick: (typeof pool)[number] | null = null, pickScore = -Infinity
      for (const c of pool) {
        if (chosen.includes(c.p.id)) continue
        const detour = chosen.length ? Math.min(...chosen.map((id) => travel(id, c.p.id, inp.mode).min)) : travel(inp.startFrom, c.p.id, inp.mode).min
        const score = c.u / (1 + detour / 25)
        if (score > pickScore && tourMinutes([...chosen, c.p.id], inp, win) <= budgetMin) { pick = c; pickScore = score }
      }
      if (!pick) break
      chosen.push(pick.p.id)
    }
    // Absorb pass: a place within ~6 minutes of a chosen stop joins the same day if the tour still fits
    for (const c of pool) {
      if (chosen.includes(c.p.id) || chosen.length >= 7) continue
      const near = chosen.some((id) => travel(id, c.p.id, inp.mode).min <= 6)
      if (near && tourMinutes([...chosen, c.p.id], inp, win) <= budgetMin - 20) chosen.push(c.p.id)
    }
    if (!chosen.length) break
    chosen.forEach((id) => used.add(id))
    const isToday = ymd(date) === todayKey
    let best: ReturnType<typeof simulate> | null = null, bestOrder: string[] = chosen
    for (const order of permutations(chosen)) {
      const s = simulate(order, date, inp, win, isToday)
      if (!best || s.cost < best.cost) { best = s; bestOrder = order }
    }
    const b = simulate(bestOrder, date, inp, win, isToday, true)
    let lunch: DayPlan['lunch'] = null, food = 0
    if (win.lunch) {
      let afterIndex = b.stops.findIndex((s) => s.depart >= 12 * 60 + 30)
      if (afterIndex < 0) afterIndex = b.stops.length - 1
      const near = b.stops[afterIndex]?.id
      const opts = near ? rankEateries({ budget2: inp.budget ? Math.max(200, Math.min(800, inp.budget / 4)) : 400, places: [near], diet: 'veg', cuisines: ['North Karnataka meals'], priority: 'close', localSpecial: true }) : []  // 'veg' keeps places that serve veg, safe for any group
      const eatery = (inp.kids ? opts.find((o) => o.item.family) : null) ?? opts[0] ?? null
      lunch = { afterIndex, at: Math.max(13 * 60, b.stops[afterIndex]?.depart ?? 13 * 60), eatery }
      food = eatery ? Math.round((eatery.item.price_for_two / 2) * people) : 0
    }
    const travelCost = Math.round(inp.mode === 'bus' ? RUPEES_PER_KM.bus * b.km * people : RUPEES_PER_KM[inp.mode] * b.km)
    days.push({
      date: ymd(date), start, stops: b.stops, lunch, km: Math.round(b.km), driveMin: b.drive, endAt: b.endAt,
      co2: Math.round((inp.mode === 'bus' ? CO2_PER_KM.bus * people : CO2_PER_KM[inp.mode]) * b.km * 10) / 10,
      co2Bus: Math.round(CO2_PER_KM.bus * people * b.km * 10) / 10,
      cost: { travel: travelCost, food, total: travelCost + food },
    })
  }
  return days
}
