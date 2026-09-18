import { EATERIES, STAYS, placeById, type Eatery, type Stay } from './data'
import { inr, roadKm, fmtKm } from './geo'

/*
  Hybrid, explainable recommenders.
  score = Σ weight_i × factor_i, each factor in [0, 1]:
    budget fit · distance to the places you'll visit · amenity / cuisine match · Bayesian rating
  + a small inclusive-growth boost for locally owned businesses, and a diversity re-rank (MMR)
  so the top results are not all from one street or one chain.
  Every result carries the factors that put it there, shown to the user as "why this".
*/

export type Priority = 'balanced' | 'cheap' | 'close' | 'rated'
const W: Record<Priority, { budget: number; dist: number; match: number; rating: number }> = {
  balanced: { budget: 0.3, dist: 0.25, match: 0.25, rating: 0.2 },
  cheap: { budget: 0.5, dist: 0.2, match: 0.15, rating: 0.15 },
  close: { budget: 0.2, dist: 0.5, match: 0.15, rating: 0.15 },
  rated: { budget: 0.2, dist: 0.2, match: 0.15, rating: 0.45 },
}

export type Reason = { key: string; text: string; good: boolean }
export type Ranked<T> = { item: T; score: number; match: number; km: number; reasons: Reason[] }

const bayes = (r: number, n: number, prior = 3.8, m = 60) => (n * r + m * prior) / (n + m)
const ratingFactor = (r: number, n: number) => Math.max(0, Math.min(1, (bayes(r, n) - 3.2) / 1.4))
const budgetFactor = (price: number, budget: number) => (price <= budget ? 1 - 0.25 * (1 - price / budget) : Math.max(0, 1 - (price - budget) / (0.6 * budget)))
const distFactor = (km: number) => Math.exp(-km / 9)

function anchorsOf(placeIds: string[]) {
  const pts = placeIds.map((id) => placeById[id]).filter(Boolean)
  return pts.length ? pts : [placeById.badami_caves]
}
function nearest(item: { lat: number; lng: number }, placeIds: string[]) {
  let best = { km: Infinity, name: '' }
  for (const p of anchorsOf(placeIds)) {
    const km = roadKm(item, p)
    if (km < best.km) best = { km, name: p.name.en }
  }
  return best
}

function mmr<T extends { id: string; town: string; owner: string }>(ranked: Ranked<T>[], k = 8, lambda = 0.8) {
  const out: Ranked<T>[] = []
  const pool = [...ranked]
  while (out.length < k && pool.length) {
    let bi = 0, bv = -Infinity
    pool.forEach((c, i) => {
      const sim = Math.max(0, ...out.map((o) => (o.item.town === c.item.town ? 0.35 : 0) + (o.item.owner === c.item.owner && c.item.owner !== 'local' ? 0.5 : 0)))
      const v = lambda * c.score - (1 - lambda) * sim
      if (v > bv) { bv = v; bi = i }
    })
    out.push(pool.splice(bi, 1)[0])
  }
  return out
}

export type StayQuery = { budget: number; places: string[]; amenities: string[]; priority: Priority }
export function rankStays(q: StayQuery): Ranked<Stay>[] {
  const w = W[q.priority]
  const ranked = STAYS.map((s) => {
    const near = nearest(s, q.places)
    const have = q.amenities.filter((a) => s.amenities.includes(a))
    const match = q.amenities.length ? have.length / q.amenities.length : 1
    const f = { budget: budgetFactor(s.price, q.budget), dist: distFactor(near.km), match, rating: ratingFactor(s.rating, s.reviews) }
    const score = w.budget * f.budget + w.dist * f.dist + w.match * f.match + w.rating * f.rating + (s.owner === 'local' ? 0.04 : 0)
    const reasons: Reason[] = [
      { key: 'budget', text: s.price <= q.budget ? `${inr(s.price)}/night, within budget` : `${inr(s.price)}/night, ${inr(s.price - q.budget)} over`, good: s.price <= q.budget },
      { key: 'dist', text: `${fmtKm(near.km)} from ${near.name}`, good: near.km < 5 },
      ...(q.amenities.length ? [{ key: 'match', text: have.length ? `Has ${have.map(pretty).join(', ')}` : 'None of your must-haves', good: match >= 0.99 }] : []),
      { key: 'rating', text: `Rated ${s.rating} (${s.reviews})`, good: s.rating >= 4 },
      ...(s.owner === 'local' ? [{ key: 'local', text: 'Locally owned', good: true }] : []),
    ]
    return { item: s, score, match: Math.round(score * 100), km: near.km, reasons }
  }).sort((a, b) => b.score - a.score)
  return mmr(ranked)
}

export type FoodQuery = { budget2: number; places: string[]; diet: 'any' | 'veg' | 'nonveg'; cuisines: string[]; priority: Priority; localSpecial: boolean }
export function rankEateries(q: FoodQuery): Ranked<Eatery>[] {
  const w = W[q.priority]
  const pool = EATERIES.filter((e) => q.diet === 'any' || (q.diet === 'veg' ? e.diet !== 'non-veg' : e.diet !== 'veg'))
  const ranked = pool.map((e) => {
    const near = nearest(e, q.places)
    const cz = q.cuisines.length ? q.cuisines.filter((c) => e.cuisines.includes(c)).length / q.cuisines.length : 1
    const special = q.localSpecial ? (e.jolada_rotti ? 1 : 0.2) : 1
    const pureVeg = q.diet === 'veg' && e.diet === 'veg' ? 1 : q.diet === 'veg' ? 0.7 : 1
    const match = cz * 0.5 + special * 0.3 + pureVeg * 0.2
    const f = { budget: budgetFactor(e.price_for_two, q.budget2), dist: distFactor(near.km), match, rating: ratingFactor(e.rating, e.reviews) }
    const score = w.budget * f.budget + w.dist * f.dist + w.match * f.match + w.rating * f.rating + (e.owner === 'local' ? 0.04 : 0)
    const reasons: Reason[] = [
      { key: 'diet', text: e.diet === 'veg' ? 'Pure vegetarian' : e.diet === 'non-veg' ? 'Non-veg specialist' : 'Veg & non-veg', good: q.diet === 'any' || (q.diet === 'veg' && e.diet === 'veg') || (q.diet === 'nonveg' && e.diet !== 'veg') },
      { key: 'dist', text: `${fmtKm(near.km)} from ${near.name}`, good: near.km < 5 },
      { key: 'budget', text: `${inr(e.price_for_two)} for two`, good: e.price_for_two <= q.budget2 },
      ...(e.jolada_rotti ? [{ key: 'local', text: 'Serves North Karnataka meals', good: true }] : []),
      { key: 'rating', text: `Rated ${e.rating} (${e.reviews})`, good: e.rating >= 4 },
    ]
    return { item: e, score, match: Math.round(score * 100), km: near.km, reasons }
  }).sort((a, b) => b.score - a.score)
  return mmr(ranked)
}

const PRETTY: Record<string, string> = { ac: 'AC', wifi: 'Wi-Fi', parking: 'parking', restaurant: 'restaurant', family_rooms: 'family rooms', hot_water: 'hot water', wheelchair: 'wheelchair access', pure_veg: 'pure-veg kitchen', lift: 'lift', pool: 'pool' }
export const pretty = (a: string) => PRETTY[a] ?? a
export const AMENITIES = ['ac', 'parking', 'wifi', 'family_rooms', 'restaurant', 'wheelchair', 'pure_veg']
export const CUISINES = ['North Karnataka meals', 'South Indian', 'North Indian', 'Andhra meals', 'Chinese', 'Snacks & chats']

export function openNow(hours: string, d: Date) {
  const [a, b] = hours.split('-').map((s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m })
  const t = d.getHours() * 60 + d.getMinutes()
  return t >= a && t <= b
}
