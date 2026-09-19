import credits from '../data/photo_credits.json'
import { placeById } from '../lib/data'

type Credit = { title: string; artist: string; license: string; page: string }
const C = credits as Record<string, Credit>

/** Freely licensed photo with its credit, or a sandstone-strata placeholder with the Kannada name. */
export default function PlaceImage({ id, className = '', showCredit = false, sizes = '200px' }: { id: string; className?: string; showCredit?: boolean; sizes?: string }) {
  const c = C[id]
  if (!c) {
    const p = placeById[id]
    return (
      <div className={`relative overflow-hidden bg-[#b8633f] ${className}`} aria-hidden>
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 200 120">
          {[18, 38, 56, 77, 96].map((y, i) => <path key={i} d={`M0 ${y} C60 ${y - 6} 120 ${y + 6} 200 ${y - 2}`} stroke="#8f3f22" strokeWidth={i % 2 ? 9 : 4} fill="none" opacity={0.45} />)}
        </svg>
        <span className="display absolute bottom-2 left-3 text-[22px] text-white/90">{p?.name.kn}</span>
      </div>
    )
  }
  return (
    <div className={`relative overflow-hidden bg-line ${className}`}>
      <img src={`/img/places/${id}.jpg`} srcSet={`/img/places/${id}-400.webp 400w, /img/places/${id}-800.webp 800w`} sizes={sizes}
        alt={placeById[id]?.name.en ?? ''} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      {showCredit && (
        <a href={c.page} target="_blank" rel="noreferrer" className="absolute bottom-1.5 right-1.5 max-w-[80%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/90">
          {c.artist || 'Wikimedia Commons'} · {c.license}
        </a>
      )}
    </div>
  )
}
