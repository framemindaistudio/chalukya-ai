import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { crowdNow, dayForecast, levelOf, capacityOf, LEVEL_COLOR, type Level } from '../lib/crowd'
import { lotStatus } from '../lib/parking'
import { LOT_FOR_SITE, road } from '../lib/data'
import { useLang } from '../lib/i18n'
import { useNow } from '../lib/clock'
import MAP from '../data/circuit_map.json'

/*
  Signature element: a live map of the Chalukya circuit. The roads and the Malaprabha are the real
  OpenStreetMap geometry (ml/data/build_circuit_map.py), drawn offline with no map tiles. The route
  draws itself from Badami to Aihole, traffic flows along it, and a vehicle drives the circuit. Each
  site pin is a live gauge: the ring fills with the forecast crowd and takes the crowd level's colour.
*/
const MAIN = ['badami_caves', 'pattadakal', 'aihole'] as const
const SIDE = ['banashankari', 'mahakuta'] as const
const SHORT: Record<string, { en: string; kn: string; hi: string }> = {
  badami_caves: { en: 'Badami', kn: 'ಬಾದಾಮಿ', hi: 'बादामी' },
  pattadakal: { en: 'Pattadakal', kn: 'ಪಟ್ಟದಕಲ್ಲು', hi: 'पट्टदकल' },
  aihole: { en: 'Aihole', kn: 'ಐಹೊಳೆ', hi: 'ऐहोल' },
  banashankari: { en: 'Banashankari', kn: 'ಬನಶಂಕರಿ', hi: 'बनशंकरी' },
  mahakuta: { en: 'Mahakuta', kn: 'ಮಹಾಕೂಟ', hi: 'महाकूट' },
}
const RIVER = { en: 'Malaprabha', kn: 'ಮಲಪ್ರಭಾ', hi: 'मलप्रभा' }
// label placement around each pin, chosen so names clear the real roads and the river
const LABEL: Record<string, { dx: number; dy: number; anchor: 'start' | 'end' | 'middle' }> = {
  badami_caves: { dx: 15, dy: 5, anchor: 'start' }, pattadakal: { dx: 13, dy: 18, anchor: 'start' }, aihole: { dx: -15, dy: 5, anchor: 'end' },
  banashankari: { dx: 8, dy: 4, anchor: 'start' }, mahakuta: { dx: 8, dy: 4, anchor: 'start' },
}
const PIN_DELAY: Record<string, number> = { badami_caves: 0.15, pattadakal: 1.05, aihole: 1.65 }
const SITES = MAP.sites as unknown as Record<string, [number, number]>
const ROADS = [...MAP.roads].sort((a, b) => Number(a.main) - Number(b.main)) // side roads underneath the circuit

function siteStatus(id: string, at: Date) {
  const c = crowdNow(id, at)
  const lots = LOT_FOR_SITE[id] ?? []
  const free = lots.reduce((s, l) => s + lotStatus(l, at).free, 0)
  const cap = lots.reduce((s, l) => s + lotStatus(l, at).capacity, 0)
  const tomorrow = new Date(at); tomorrow.setDate(at.getDate() + 1); tomorrow.setHours(11)
  const tf = dayForecast(id, tomorrow)
  const tLevel: Level | null = tf ? levelOf(Math.max(...tf.hourly), capacityOf(id)) : null
  return { c, free, cap, tLevel }
}

/** The route animation waits for the boot screen to lift, so it plays where people can see it. */
function useAfterBoot() {
  const [go, setGo] = useState(false)
  useEffect(() => {
    let t = 0
    const check = () => { if (document.querySelector('.boot')) t = window.setTimeout(check, 200); else t = window.setTimeout(() => setGo(true), 150) }
    check()
    return () => clearTimeout(t)
  }, [])
  return go
}

function Pin({ id, ratio, level, open, onClick }: { id: string; ratio: number; level: Level | null; open: boolean; onClick: () => void }) {
  const [x, y] = SITES[id]
  const r = 10.5, circ = 2 * Math.PI * r
  const col = open && level ? LEVEL_COLOR[level] : '#9aa7a2'
  return (
    <g transform={`translate(${x} ${y})`} onClick={onClick} className="cursor-pointer">
      <g className="cm-pin" style={{ animationDelay: `${PIN_DELAY[id]}s` }}>
        {open && <circle r={r + 7} fill={col} opacity={0.22} className="cm-pulse" />}
        <circle r={r + 2.5} fill="#fff" filter="url(#cm-shadow)" />
        <circle r={r} fill="none" stroke="#e1e9e5" strokeWidth={3.4} />
        <circle r={r} fill="none" stroke={col} strokeWidth={3.4} strokeLinecap="round"
          strokeDasharray={`${circ * Math.min(1, Math.max(0.05, ratio))} ${circ}`} transform="rotate(-90)" style={{ transition: 'stroke-dasharray .6s ease' }} />
        <circle r={4.2} fill={col} />
      </g>
    </g>
  )
}

export default function CircuitLine() {
  const { t, lang } = useLang()
  const at = useNow(20_000)
  const nav = useNavigate()
  const go = useAfterBoot()
  const [drive, setDrive] = useState(false)
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => { if (!go || reduced) return; const id = setTimeout(() => setDrive(true), 1900); return () => clearTimeout(id) }, [go, reduced])

  const sites = Object.fromEntries(MAIN.map((id) => [id, siteStatus(id, at)])) as Record<string, ReturnType<typeof siteStatus>>
  const side = SIDE.map((id) => ({ id, ...siteStatus(id, at), km: road('badami_caves', id)?.km }))
  const open = !!sites.badami_caves.c
  const legs = MAP.roads.filter((r) => r.main)
  const W = MAP.w, H = MAP.h, km5 = MAP.pxPerKm * 5
  const halo = { paintOrder: 'stroke' as const, stroke: '#fff', strokeWidth: 3.5, strokeLinejoin: 'round' as const }

  return (
    <section aria-label={t('circuit')} className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t('circuit')}</div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold ${open ? 'text-lake' : 'text-ink-3'}`}>
          <span className={`h-2 w-2 rounded-full ${open ? 'live-dot bg-lake' : 'bg-ink-3'}`} />{open ? 'LIVE' : t('closedNow')}
        </span>
      </div>

      <div className={`relative mx-3 mt-2.5 overflow-hidden rounded-[18px] border border-line/80 bg-[#eef2ea] ${go ? 'cm-go' : ''} ${reduced ? 'cm-static' : ''}`}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
          aria-label={`Map: Badami to Pattadakal ${legs[0]?.km} km, Pattadakal to Aihole ${legs[1]?.km} km, along the Malaprabha river`}>
          <defs>
            <pattern id="cm-grid" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".9" fill="#1f5e57" opacity=".08" /></pattern>
            <filter id="cm-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="#14211d" floodOpacity=".22" /></filter>
            <radialGradient id="cm-car"><stop offset="0" stopColor="#f3c56b" stopOpacity=".55" /><stop offset="1" stopColor="#f3c56b" stopOpacity="0" /></radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#cm-grid)" />

          {/* the Malaprabha (OpenStreetMap) */}
          {MAP.river.map((d, i) => <path key={`rc${i}`} d={d} fill="none" stroke="#d3e9ec" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />)}
          {MAP.river.map((d, i) => <path key={`r${i}`} d={d} fill="none" stroke="#9ccfd9" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />)}
          {/* river name beside its straight southern stretch, in open map */}
          <text x={147} y={183} fontSize={9.5} fontStyle="italic" letterSpacing=".04em" fill="#4f8f9c" style={halo}>{RIVER[lang]}</text>

          {/* roads: grey casing and white core, like a road map; side roads first so the circuit sits on top */}
          {ROADS.map((r) => <path key={`c${r.to}`} d={r.d} fill="none" stroke="#cdd6d1" strokeWidth={r.main ? 8.5 : 5.5} strokeLinecap="round" strokeLinejoin="round" />)}
          {ROADS.map((r) => <path key={`k${r.to}`} d={r.d} fill="none" stroke="#fff" strokeWidth={r.main ? 5.8 : 3.4} strokeLinecap="round" strokeLinejoin="round" />)}

          {/* the circuit route draws itself, then traffic flows along it */}
          <path d={MAP.circuit} pathLength={1} className="cm-draw" fill="none" stroke="#1f5e57" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
          <path d={MAP.circuit} className="cm-flow" fill="none" stroke="#bfeee4" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* a vehicle driving the circuit, pointing the way it travels */}
          {drive && (
            <g>
              <circle r={9} fill="url(#cm-car)" />
              <path d="M-5.5 -4.2 L5.5 0 L-5.5 4.2 L-3 0 Z" fill="#fff" stroke="#1f5e57" strokeWidth={1.6} strokeLinejoin="round" filter="url(#cm-shadow)" />
              <animateMotion dur="7.5s" repeatCount="indefinite" path={MAP.circuit} rotate="auto" />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.9;1" dur="7.5s" repeatCount="indefinite" />
            </g>
          )}

          {/* side sites */}
          {SIDE.map((id) => {
            const [x, y] = SITES[id], L = LABEL[id], s = side.find((q) => q.id === id)!
            return (
              <g key={id} onClick={() => nav(`/place/${id}`)} className="cursor-pointer">
                <circle cx={x} cy={y} r={4.8} fill="#fff" stroke={s.c ? LEVEL_COLOR[s.c.level] : '#9aa7a2'} strokeWidth={2.6} />
                <text x={x + L.dx} y={y + L.dy} textAnchor={L.anchor} fontSize={10.5} fontWeight={600} fill="#4a5a54" style={halo}>{SHORT[id][lang]}</text>
              </g>
            )
          })}

          {/* distance chips on the road itself */}
          {legs.map((r, i) => {
            const rd = road(r.from, r.to), label = `${rd?.km ?? r.km} ${t('km')} · ${rd?.min ?? r.min} ${t('min')}`
            const w = label.length * 5.3 + 14, x = Math.min(W - w / 2 - 5, Math.max(w / 2 + 5, r.mid[0]))  // never clipped at the edges
            return (
              <g key={r.to} transform={`translate(${x} ${r.mid[1]})`}>
                <g className="cm-chip" style={{ animationDelay: `${1.3 + i * 0.35}s` }}>
                  <rect x={-w / 2} y={-9.5} width={w} height={19} rx={9.5} fill="#fff" stroke="#d6e0db" filter="url(#cm-shadow)" />
                  <text y={3.8} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#14211d" className="num">{label}</text>
                </g>
              </g>
            )
          })}

          {/* the three great sites: live gauges */}
          {MAIN.map((id) => <Pin key={id} id={id} ratio={sites[id].c?.ratio ?? 0} level={sites[id].c?.level ?? sites[id].tLevel} open={!!sites[id].c} onClick={() => nav(`/place/${id}`)} />)}
          {MAIN.map((id) => {
            const [x, y] = SITES[id], L = LABEL[id]
            return <text key={`l${id}`} x={x + L.dx} y={y + L.dy} textAnchor={L.anchor} fontSize={13} fontWeight={700} fill="#14211d" className="cm-label" style={{ ...halo, strokeWidth: 4, animationDelay: `${PIN_DELAY[id] + 0.15}s` }}>{SHORT[id][lang]}</text>
          })}

          {/* north arrow and a true scale bar */}
          <g transform="translate(16 18)" opacity={0.75}>
            <path d="M0 -8 L4.5 4 L0 1.5 L-4.5 4 Z" fill="#1f5e57" />
            <text y={14} textAnchor="middle" fontSize={8} fontWeight={700} fill="#1f5e57">N</text>
          </g>
          <g transform="translate(30 19)" opacity={0.8}>
            <path d={`M0 -3 V0 H${km5} V-3`} fill="none" stroke="#4a5a54" strokeWidth={1.3} />
            <text x={km5 + 5} y={1} fontSize={8.5} fill="#4a5a54" className="num">5 km</text>
          </g>
        </svg>
        <span className="pointer-events-none absolute bottom-1 right-2 text-[9px] text-ink-3">© OpenStreetMap</span>
      </div>

      <div className="grid grid-cols-3 gap-1 px-2 pt-2.5">
        {MAIN.map((id, i) => {
          const s = sites[id]
          const align = i === 0 ? 'text-left' : i === 2 ? 'text-right' : 'text-center'
          return (
            <button key={id} onClick={() => nav(`/place/${id}`)} className={`min-w-0 rounded-xl px-2 py-1.5 hover:bg-mist ${align}`}>
              <div className="display truncate text-[15.5px] leading-tight text-ink">{SHORT[id][lang]}</div>
              <div className="mt-0.5 truncate text-[12.5px] font-semibold" style={{ color: s.c ? LEVEL_COLOR[s.c.level] : s.tLevel ? LEVEL_COLOR[s.tLevel] : '#7b8a84' }}>
                {s.c ? t(s.c.level) : `${t('tomorrow')}: ${s.tLevel ? t(s.tLevel) : '—'}`}
              </div>
              <div className="num mt-0.5 text-[12.5px] text-ink-2">P <b className="text-ink">{s.free}</b>/{s.cap}</div>
            </button>
          )
        })}
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-2 border-t border-line px-4 py-2.5 text-[12.5px] text-ink-2">
        {side.map((s) => (
          <button key={s.id} onClick={() => nav(`/place/${s.id}`)} className="flex min-w-0 items-center gap-2 rounded-lg text-left">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.c ? LEVEL_COLOR[s.c.level] : '#9aa7a2' }} />
            <span className="truncate"><b className="font-semibold text-ink">{SHORT[s.id][lang]}</b> · {s.km} {t('km')} · P {s.free}</span>
          </button>
        ))}
      </div>
      <p className="px-4 pb-3 text-[11.5px] text-ink-3">{t('circuitNote')}</p>
    </section>
  )
}
