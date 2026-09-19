import { useMemo, useState } from 'react'
import { reveal } from '../lib/reveal'
import { BedDouble, ChevronDown, MapPin, Star } from 'lucide-react'
import { Card, Chip, DemoTag, Eyebrow, PageHead } from '../components/ui'
import MapView from '../components/MapView'
import { useLang } from '../lib/i18n'
import { AMENITIES, pretty, rankStays, type Priority } from '../lib/recommend'
import { BIZ_ATTRIBUTION, placeById } from '../lib/data'
import { inr, fmtKm, mapsLink } from '../lib/geo'

const TX = {
  title: { en: 'Where to stay', kn: 'ಎಲ್ಲಿ ಉಳಿಯಬೇಕು', hi: 'कहाँ ठहरें' },
  sub: { en: 'Ranked for you, with the reasons shown. Locally owned stays get a small boost.', kn: 'ನಿಮಗಾಗಿ ಶ್ರೇಣೀಕರಿಸಲಾಗಿದೆ, ಕಾರಣಗಳೊಂದಿಗೆ. ಸ್ಥಳೀಯರ ಮಾಲೀಕತ್ವದ ವಸತಿಗಳಿಗೆ ಸ್ವಲ್ಪ ಆದ್ಯತೆ.', hi: 'आपके लिए क्रम में, कारणों के साथ। स्थानीय मालिकों वाली जगहों को थोड़ी प्राथमिकता।' },
  budget: { en: 'Budget per night', kn: 'ರಾತ್ರಿಗೆ ಬಜೆಟ್', hi: 'प्रति रात बजट' }, near: { en: 'Close to', kn: 'ಇದರ ಹತ್ತಿರ', hi: 'इसके पास' },
  must: { en: 'Must have', kn: 'ಬೇಕೇ ಬೇಕು', hi: 'ज़रूरी' }, prio: { en: 'What matters most', kn: 'ಯಾವುದು ಮುಖ್ಯ', hi: 'सबसे ज़रूरी क्या' },
}
const PRIO: { id: Priority; en: string; kn: string; hi: string }[] = [
  { id: 'balanced', en: 'Balanced', kn: 'ಸಮತೋಲನ', hi: 'संतुलित' }, { id: 'cheap', en: 'Lowest price', kn: 'ಕಡಿಮೆ ಬೆಲೆ', hi: 'सबसे सस्ता' },
  { id: 'close', en: 'Closest', kn: 'ಅತಿ ಹತ್ತಿರ', hi: 'सबसे पास' }, { id: 'rated', en: 'Best rated', kn: 'ಉತ್ತಮ ರೇಟಿಂಗ್', hi: 'सबसे अच्छी रेटिंग' },
]
export const NEAR = ['badami_caves', 'pattadakal', 'aihole', 'banashankari', 'kudalasangama']

export default function Stay() {
  const { L, lang } = useLang()
  const [budget, setBudget] = useState(2500)
  const [near, setNear] = useState<string[]>(['badami_caves'])
  const [must, setMust] = useState<string[]>(['parking'])
  const [prio, setPrio] = useState<Priority>('balanced')
  const [open, setOpen] = useState<string | null>(null)
  const res = useMemo(() => rankStays({ budget, places: near, amenities: must, priority: prio }), [budget, near, must, prio])
  const tog = <T,>(a: T[], x: T) => (a.includes(x) ? a.filter((y) => y !== x) : [...a, x])

  return (
    <div>
      <PageHead title={L(TX.title)} sub={L(TX.sub)} />
      <div className="space-y-4 px-4">
        <Card className="space-y-4 p-4">
          <div>
            <div className="flex items-baseline justify-between"><Eyebrow>{L(TX.budget)}</Eyebrow><span className="num text-[18px] font-bold">{inr(budget)}</span></div>
            <input type="range" min={600} max={6000} step={100} value={budget} onChange={(e) => setBudget(+e.target.value)} className="mt-2 w-full accent-lake" aria-label="Budget" />
          </div>
          <div><Eyebrow>{L(TX.near)}</Eyebrow><div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">{NEAR.map((id) => <Chip key={id} active={near.includes(id)} onClick={() => setNear((a) => (tog(a, id).length ? tog(a, id) : a))}>{L(placeById[id].name).split(':')[0]}</Chip>)}</div></div>
          <div><Eyebrow>{L(TX.must)}</Eyebrow><div className="mt-2 flex flex-wrap gap-2">{AMENITIES.map((a) => <Chip key={a} active={must.includes(a)} onClick={() => setMust((m) => tog(m, a))}>{pretty(a)}</Chip>)}</div></div>
          <div><Eyebrow>{L(TX.prio)}</Eyebrow><div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">{PRIO.map((p) => <Chip key={p.id} active={prio === p.id} onClick={() => setPrio(p.id)}>{p[lang]}</Chip>)}</div></div>
        </Card>

        <MapView height={210} pins={[...near.map((id) => ({ id, lat: placeById[id].lat, lng: placeById[id].lng, label: placeById[id].name.en, color: '#14211d', radius: 6 })), ...res.slice(0, 6).map((r, i) => ({ id: r.item.id, lat: r.item.lat, lng: r.item.lng, label: `${i + 1}. ${r.item.name}`, color: i === 0 ? '#c0562f' : '#1f5e57' }))]} />

        {res.map((r, i) => (
          <Card key={r.item.id} className="p-4">
            <button className="w-full text-left" onClick={(e) => { const card = e.currentTarget.parentElement; if (open !== r.item.id) reveal(() => card); setOpen(open === r.item.id ? null : r.item.id) }} aria-expanded={open === r.item.id}>
              <div className="flex items-start gap-3">
                <div className="num grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lake-soft text-[15px] font-bold text-lake">{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[16.5px] font-semibold leading-snug">{r.item.name}</div>
                    <div className="text-right"><div className="num text-[18px] font-bold text-lake">{r.match}%</div><div className="text-[10.5px] text-ink-3">match</div></div>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-2">
                    <span className="num font-semibold text-ink">{inr(r.item.price)}</span>
                    <span className="inline-flex items-center gap-0.5"><Star size={12} className="fill-lamp text-lamp" />{r.item.rating}</span>
                    <span className="inline-flex items-center gap-0.5"><MapPin size={12} />{fmtKm(r.km)}</span>
                    <span>{r.item.town}</span><DemoTag />
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-lake">{lang === 'kn' ? 'ಏಕೆ ಇದು' : lang === 'hi' ? 'यह क्यों' : 'Why this'} <ChevronDown size={14} className={open === r.item.id ? 'rotate-180' : ''} /></div>
            </button>
            {open === r.item.id && (
              <div className="mt-2 border-t border-line pt-2">
                <ul className="space-y-1">{r.reasons.map((x) => <li key={x.key} className="flex items-center gap-2 text-[13.5px]"><span className={`h-1.5 w-1.5 rounded-full ${x.good ? 'bg-lake' : 'bg-sand'}`} />{x.text}</li>)}</ul>
                <div className="mt-2 flex flex-wrap gap-1.5">{r.item.amenities.map((a) => <span key={a} className="rounded-md bg-mist px-2 py-0.5 text-[12px] text-ink-2">{pretty(a)}</span>)}</div>
                <a href={mapsLink(r.item.lat, r.item.lng)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-lake px-3.5 py-1.5 text-[13.5px] font-semibold text-white"><BedDouble size={14} />Directions</a>
              </div>
            )}
          </Card>
        ))}
        <p className="px-1 pb-2 text-[11.5px] text-ink-3">{BIZ_ATTRIBUTION}</p>
      </div>
    </div>
  )
}
