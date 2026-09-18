import placesRaw from '../data/places.json'
import sculpturesRaw from '../data/sculptures.json'
import businessesRaw from '../data/businesses.json'
import distancesRaw from '../data/distances.json'
import footfallRaw from '../data/footfall.json'
import parkingRaw from '../data/parking.json'
import metricsRaw from '../data/metrics.json'
import type { Tri } from './i18n'

export type Place = {
  id: string; town: string; kind: string; lat: number; lng: number
  name: Tri; period: string; dynasty: string; summary: Tri; facts: (Tri & { src?: string })[]
  visit: { minutes: number; stairs: boolean; wheelchair: string; shade: string; entry: string }
  tags: string[]; src?: string
}
export type Faq = { id: string; q: Tri; a: Tri; tags: string[]; src?: string }
export type Sculpture = { id: string; place: string; group: string; deity: string; name: Tri; text: Tri }
export type Stay = {
  id: string; name: string; lat: number; lng: number; town: string; type: string; price: number; rating: number
  reviews: number; amenities: string[]; owner: string
}
export type Eatery = {
  id: string; name: string; lat: number; lng: number; town: string; type: string; diet: 'veg' | 'non-veg' | 'veg & non-veg'
  cuisines: string[]; price_for_two: number; rating: number; reviews: number; hours: string; jolada_rotti: boolean; family: boolean; owner: string
}
export type ForecastDay = { d: string; p50: number; p10: number; p90: number; tag: string | null; hourly: number[] }
export type SiteForecast = { capacity: number; calibrated_to_asi: boolean; recent: { d: string; v: number }[]; forecast: ForecastDay[] }
export type Lot = { site: string; name: string; capacity: number; lat: number; lng: number; days: Record<string, number[]> }

const kb = placesRaw as unknown as { places: Place[]; practical: Faq[]; sources: { id: string; title: string }[] }
export const PLACES = kb.places
export const FAQS = kb.practical
export const SOURCES = kb.sources
export const placeById = Object.fromEntries(PLACES.map((p) => [p.id, p])) as Record<string, Place>

export const SCULPTURES = (sculpturesRaw as unknown as { classes: Sculpture[] }).classes
export const sculptureById = Object.fromEntries(SCULPTURES.map((s) => [s.id, s])) as Record<string, Sculpture>

const biz = businessesRaw as unknown as { attribution: string; stays: Stay[]; eateries: Eatery[] }
export const STAYS = biz.stays
export const EATERIES = biz.eateries
export const BIZ_ATTRIBUTION = biz.attribution

const dist = distancesRaw as unknown as { ids: string[]; km: number[][]; min: number[][]; coords: Record<string, [number, number]> }
export const ROAD_FACTOR_TIME = 1.35 // OSRM free-flow times are optimistic on district roads
export function road(a: string, b: string): { km: number; min: number } | null {
  const i = dist.ids.indexOf(a), j = dist.ids.indexOf(b)
  if (i < 0 || j < 0) return null
  return { km: dist.km[i][j], min: Math.round(dist.min[i][j] * ROAD_FACTOR_TIME) }
}
export const DIST_IDS = dist.ids
export const HUB_COORDS = dist.coords

export const FOOTFALL = footfallRaw as unknown as { generated_for: string; model: string; sites: Record<string, SiteForecast> }
export const PARKING = parkingRaw as unknown as { step_min: number; start_hour: number; lots: Record<string, Lot> }
export const METRICS = metricsRaw as Record<string, any>

// Which forecast site covers each place (the ASI ticket counts cover the whole monument cluster)
export const FORECAST_SITE: Record<string, string> = {
  badami_caves: 'badami_caves', bhutanatha: 'badami_caves', badami_fort: 'badami_caves', badami_museum: 'badami_caves',
  pattadakal: 'pattadakal', aihole: 'aihole', aihole_meguti: 'aihole', aihole_ravanaphadi: 'aihole',
  banashankari: 'banashankari', mahakuta: 'mahakuta', kudalasangama: 'kudalasangama',
}
export const LOT_FOR_SITE: Record<string, string[]> = {
  badami_caves: ['p_badami_caves', 'p_badami_museum'], pattadakal: ['p_pattadakal'], aihole: ['p_aihole'],
  banashankari: ['p_banashankari'], mahakuta: ['p_mahakuta'],
}

// Public health facilities from OpenStreetMap, used by the safety features
export const HOSPITALS = [
  { name: 'Government Hospital, Badami', lat: 15.9217, lng: 75.6779, town: 'Badami' },
  { name: 'Primary Health Centre, Pattadakal', lat: 15.9492, lng: 75.8075, town: 'Pattadakal' },
  { name: 'Hungund Government Hospital', lat: 16.0669, lng: 76.0597, town: 'Hungund' },
  { name: 'Government Hospital, Ilkal', lat: 15.9629, lng: 76.1235, town: 'Ilkal' },
  { name: 'Govt. Hospital, Aminagad', lat: 16.0554, lng: 75.9531, town: 'Amingad' },
  { name: 'District Hospital, Bagalkot', lat: 16.1654, lng: 75.6606, town: 'Bagalkot' },
]
export const POLICE = [{ name: 'Bagalkot Police Station', lat: 16.1813, lng: 75.6918 }]
