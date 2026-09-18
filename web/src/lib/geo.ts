export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, p = Math.PI / 180
  const x = Math.sin(((b.lat - a.lat) * p) / 2) ** 2 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(((b.lng - a.lng) * p) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
/** Straight-line distance to a rough road distance for this terrain. */
export const roadKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => haversineKm(a, b) * 1.3
export const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`)
export const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
export const inr = (n: number) => '₹' + n.toLocaleString('en-IN')
