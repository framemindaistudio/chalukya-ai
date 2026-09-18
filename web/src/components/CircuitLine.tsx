import { useNavigate } from 'react-router'
import { crowdNow, dayForecast, levelOf, capacityOf, LEVEL_COLOR, type Level } from '../lib/crowd'
import { lotStatus } from '../lib/parking'
import { LOT_FOR_SITE, road } from '../lib/data'
import { useLang } from '../lib/i18n'
import { useNow } from '../lib/clock'

/*
  Signature element: the three great Chalukyan sites strung along the Malaprabha valley at their
  real road distances, each node a live gauge: the ring fills with the forecast crowd, the colour
  is the crowd level, and the number underneath is free parking from the slot sensors.
*/
const MAIN = ['badami_caves', 'pattadakal', 'aihole'] as const
const X = { badami_caves: 32, pattadakal: 204, aihole: 308 }
const SHORT: Record<string, { en: string; kn: string; hi: string }> = {
  badami_caves: { en: 'Badami', kn: 'ಬಾದಾಮಿ', hi: 'बादामी' },
  pattadakal: { en: 'Pattadakal', kn: 'ಪಟ್ಟದಕಲ್ಲು', hi: 'पट्टदकल' },
  aihole: { en: 'Aihole', kn: 'ಐಹೊಳೆ', hi: 'ऐहोल' },
  banashankari: { en: 'Banashankari', kn: 'ಬನಶಂಕರಿ', hi: 'बनशंकरी' },
  mahakuta: { en: 'Mahakuta', kn: 'ಮಹಾಕೂಟ', hi: 'महाकूट' },
}

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

function Gauge({ x, ratio, level, open }: { x: number; ratio: number; level: Level | null; open: boolean }) {
  const r = 17, circ = 2 * Math.PI * r
  const col = open && level ? LEVEL_COLOR[level] : '#9aa7a2'
  return (
    <g transform={`translate(${x} 46)`}>
      {open && <circle r={r} fill={col} opacity={0.18} className="live-pulse" />}
      <circle r={r} fill="#fff" stroke="#d6e0db" strokeWidth={5} />
      <circle r={r} fill="none" stroke={col} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${circ * Math.min(1, Math.max(0.04, ratio))} ${circ}`} transform="rotate(-90)" style={{ transition: 'stroke-dasharray .6s ease' }} />
      <circle r={5.5} fill={col} />
    </g>
  )
}

export default function CircuitLine() {
  const { t, lang } = useLang()
  const at = useNow(20_000)
  const nav = useNavigate()
  const sites = Object.fromEntries(MAIN.map((id) => [id, siteStatus(id, at)])) as Record<string, ReturnType<typeof siteStatus>>
  const side = ['banashankari', 'mahakuta'].map((id) => ({ id, ...siteStatus(id, at), km: road('badami_caves', id)?.km }))
  const d1 = road('badami_caves', 'pattadakal')?.km ?? 22, d2 = road('pattadakal', 'aihole')?.km ?? 14
  const open = !!sites.badami_caves.c

  return (
    <section aria-label={t('circuit')} className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t('circuit')}</div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold ${open ? 'text-lake' : 'text-ink-3'}`}>
          <span className={`h-2 w-2 rounded-full ${open ? 'bg-lake' : 'bg-ink-3'}`} />{open ? 'LIVE' : t('closedNow')}
        </span>
      </div>

      <svg viewBox="0 0 340 92" className="mt-1 block w-full" role="img" aria-label="Badami to Pattadakal to Aihole">
        {/* the Malaprabha valley: the river runs past Pattadakal and Aihole */}
        <path d="M120 84 C160 70 180 76 205 66 S 260 52 340 58" fill="none" stroke="#bcd9d2" strokeWidth={7} strokeLinecap="round" opacity={0.7} />
        <text x={262} y={82} fontSize={9.5} fontStyle="italic" fill="#6f9c93" className="display">Malaprabha</text>
        <path d={`M${X.badami_caves} 46 C 90 30, 140 60, ${X.pattadakal} 46 S 270 34, ${X.aihole} 46`} fill="none" stroke="#1f5e57" strokeWidth={2.2} strokeDasharray="1 6" strokeLinecap="round" />
        <text x={(X.badami_caves + X.pattadakal) / 2} y={30} textAnchor="middle" fontSize={11} fill="#4a5a54" className="num" fontWeight={600}>{d1} {t('km')}</text>
        <text x={(X.pattadakal + X.aihole) / 2} y={30} textAnchor="middle" fontSize={11} fill="#4a5a54" className="num" fontWeight={600}>{d2} {t('km')}</text>
        {MAIN.map((id) => <Gauge key={id} x={X[id]} ratio={sites[id].c?.ratio ?? 0} level={sites[id].c?.level ?? sites[id].tLevel} open={!!sites[id].c} />)}
      </svg>

      <div className="relative -mt-1 h-[84px]">
        {MAIN.map((id, i) => {
          const s = sites[id]
          const pos = i === 0 ? 'left-2 text-left' : i === 2 ? 'right-2 text-right' : 'left-[60%] -translate-x-1/2 text-center'
          return (
            <button key={id} onClick={() => nav(`/place/${id}`)} className={`absolute top-0 max-w-[36%] rounded-xl px-2 py-1 hover:bg-mist ${pos}`}>
              <div className="display text-[17px] leading-tight text-ink">{SHORT[id][lang]}</div>
              <div className="mt-0.5 text-[13px] font-semibold" style={{ color: s.c ? LEVEL_COLOR[s.c.level] : s.tLevel ? LEVEL_COLOR[s.tLevel] : '#7b8a84' }}>
                {s.c ? t(s.c.level) : `${t('tomorrow')}: ${s.tLevel ? t(s.tLevel) : '—'}`}
              </div>
              <div className="num mt-0.5 text-[13px] text-ink-2">P · <b className="text-ink">{s.free}</b>/{s.cap} {t('free')}</div>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-line px-4 py-2.5 text-[12.5px] text-ink-2">
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
