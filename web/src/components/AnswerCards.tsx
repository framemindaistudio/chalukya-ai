import { Link } from 'react-router'
import { ArrowRight, BedDouble, CarFront, MapPin, Phone, Siren, UtensilsCrossed } from 'lucide-react'
import { hhmm } from '../lib/clock'
import { LEVEL_COLOR } from '../lib/crowd'
import type { Card as C } from '../lib/assistant'
import { placeById, sculptureById, HOSPITALS } from '../lib/data'
import { useLang } from '../lib/i18n'
import { bestHours } from '../lib/crowd'
import { lotStatus, freeOnArrival } from '../lib/parking'
import { useNow } from '../lib/clock'
import { HourBars } from '../pages/Home'
import { DemoTag, LevelBadge } from './ui'
import { inr, fmtKm } from '../lib/geo'
import { crowdNow } from '../lib/crowd'
import PlaceImage from './PlaceImage'

export default function AnswerCards({ cards }: { cards: C[] }) {
  return <div className="mt-2 space-y-2">{cards.map((c, i) => <One key={i} c={c} />)}</div>
}

function One({ c }: { c: C }) {
  const { L, t, lang } = useLang()
  const at = useNow()
  switch (c.type) {
    case 'place': {
      const p = placeById[c.id]; if (!p) return null
      return (
        <Link to={`/place/${p.id}`} className="flex overflow-hidden rounded-2xl border border-line bg-paper">
          <PlaceImage id={p.id} className="h-auto w-24 shrink-0" />
          <div className="p-3">
            <div className="display text-[16px] leading-tight">{L(p.name)}</div>
            <div className="mt-0.5 text-[12.5px] text-ink-3">{p.period} · {p.visit.minutes} {t('min')}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-lake">{lang === 'kn' ? 'ವಿವರ' : lang === 'hi' ? 'विवरण' : 'Details'} <ArrowRight size={14} /></div>
          </div>
        </Link>
      )
    }
    case 'sculpture': {
      const s = sculptureById[c.id]; if (!s) return null
      return <div className="rounded-2xl border border-line bg-paper p-3 text-[13px] text-ink-2"><b className="text-ink">{L(s.name)}</b> · {s.group}</div>
    }
    case 'crowd': {
      const b = bestHours(c.site, at, Math.max(6, at.getHours()))
      const now = crowdNow(c.site, at)
      if (!b) return null
      return (
        <div className="rounded-2xl border border-line bg-paper p-3">
          <div className="flex items-center justify-between text-[13px]"><span className="font-semibold">{L(placeById[c.site]?.name)}</span>{now && <LevelBadge level={now.level} />}</div>
          <HourBars hourly={b.day.hourly} highlight={b.quiet.h} nowH={at.getHours()} />
        </div>
      )
    }
    case 'parking':
      return (
        <div className="rounded-2xl border border-line bg-paper p-3">
          {c.lots.map((id) => {
            const s = lotStatus(id, at)
            return (
              <div key={id} className="flex items-center gap-3 py-1">
                <CarFront size={18} className="text-lake" />
                <div className="flex-1 text-[14px]"><b>{s.name}</b><div className="text-[12px] text-ink-3">+1 h: ~{freeOnArrival(id, at, 60)} {t('free')}</div></div>
                <div className="num text-[20px] font-bold">{s.free}<span className="text-[12px] font-normal text-ink-3">/{s.capacity}</span></div>
              </div>
            )
          })}
        </div>
      )
    case 'stays':
      return (
        <div className="space-y-2">
          {c.items.map((r) => (
            <div key={r.item.id} className="rounded-2xl border border-line bg-paper p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2"><BedDouble size={17} className="text-lake" /><b className="text-[14.5px]">{r.item.name}</b></div>
                <span className="num text-[13px] font-bold text-lake">{r.match}%</span>
              </div>
              <div className="mt-1 text-[12.5px] text-ink-2">{inr(r.item.price)}/night · ★ {r.item.rating} · {fmtKm(r.km)} <DemoTag className="ml-1" /></div>
            </div>
          ))}
        </div>
      )
    case 'food':
      return (
        <div className="space-y-2">
          {c.items.map((r) => (
            <div key={r.item.id} className="rounded-2xl border border-line bg-paper p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2"><UtensilsCrossed size={16} className="text-lake" /><b className="text-[14.5px]">{r.item.name}</b></div>
                <span className="num text-[13px] font-bold text-lake">{r.match}%</span>
              </div>
              <div className="mt-1 text-[12.5px] text-ink-2">{r.item.diet} · {r.item.cuisines.slice(0, 2).join(', ')} · {inr(r.item.price_for_two)}/2 · {fmtKm(r.km)} <DemoTag className="ml-1" /></div>
            </div>
          ))}
        </div>
      )
    case 'route':
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-3">
          <MapPin size={18} className="text-lake" />
          <div className="flex-1 text-[14px]"><b>{L(placeById[c.to]?.name)}</b></div>
          <div className="num text-right text-[14px]"><b>{c.km} km</b><div className="text-[12px] text-ink-3">~{c.min} min</div></div>
        </div>
      )
    case 'emergency':
      return (
        <div className="rounded-2xl border border-sos/30 bg-[#fdecef] p-3">
          <Link to="/safety" className="flex items-center justify-center gap-2 rounded-xl bg-sos py-2.5 text-[15px] font-bold text-white"><Siren size={18} /> SOS</Link>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[13px]">
            {[['112', 'Emergency'], ['108', 'Ambulance'], ['1091', 'Women']].map(([n, l]) => (
              <a key={n} href={`tel:${n}`} className="rounded-lg bg-paper py-1.5"><Phone size={13} className="mx-auto mb-0.5 text-sos" /><b className="num text-[16px]">{n}</b><div className="text-[11px] text-ink-3">{l}</div></a>
            ))}
          </div>
          <div className="mt-2 text-[12px] text-ink-2">{HOSPITALS[0].name} · {HOSPITALS[1].name}</div>
        </div>
      )
    case 'events':
      return (
        <ul className="rounded-2xl border border-line bg-paper px-3 py-1">
          {c.events.map((e) => <li key={e.d} className="flex justify-between border-b border-line py-1.5 text-[13.5px] last:border-0"><span>{e.tag}</span><span className="num text-ink-2">{e.d.slice(5)}</span></li>)}
        </ul>
      )
    case 'plan': {
      const d = c.day
      return (
        <div className="rounded-2xl border border-line bg-paper p-3">
          <div className="flex flex-wrap gap-1.5">{c.understood.filter((u) => u.key !== 'transport').map((u) => <span key={u.key} className="rounded-md bg-mist px-2 py-0.5 text-[11.5px] text-ink-2">{u.key}: <b className="text-ink">{u.value}</b></span>)}</div>
          <ol className="mt-2.5 space-y-1.5">
            {d.stops.map((st, i) => (
              <li key={st.id} className="flex items-start gap-2 text-[13.5px]">
                <span className="num w-[62px] shrink-0 text-ink-3">{hhmm(st.arrive)}</span>
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: st.level ? LEVEL_COLOR[st.level] : '#1f5e57' }} />
                <span className="flex-1"><b>{L(placeById[st.id]?.name)}</b>{d.lunch && d.lunch.afterIndex === i && d.lunch.eatery && <span className="block text-[12px] text-[#8a6412]">Lunch: {d.lunch.eatery.item.name}</span>}</span>
              </li>
            ))}
          </ol>
          <div className="num mt-2 flex flex-wrap gap-x-3 border-t border-line pt-2 text-[12.5px] text-ink-2">
            <span>{d.km} km</span><span>≈ ₹{d.cost.total.toLocaleString('en-IN')}</span><span>back {hhmm(d.endAt)}</span><span>{d.co2} kg CO₂</span>
          </div>
          <Link to={`/plan?q=${encodeURIComponent(c.query)}`} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-lake">{lang === 'kn' ? 'ನಕ್ಷೆಯೊಂದಿಗೆ ಪೂರ್ಣ ಯೋಜನೆ' : lang === 'hi' ? 'नक्शे के साथ पूरी योजना' : 'Full plan with map'} <ArrowRight size={14} /></Link>
        </div>
      )
    }
    case 'link':
      return <Link to={c.to} className="inline-flex items-center gap-1.5 rounded-full border border-lake px-3.5 py-1.5 text-[13.5px] font-semibold text-lake">{c.label[lang]} <ArrowRight size={14} /></Link>
  }
}
