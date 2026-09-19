import { useMemo, useState } from 'react'
import { reveal } from '../lib/reveal'
import { ChevronDown, Leaf, MapPin, Star } from 'lucide-react'
import { Card, Chip, DemoTag, Eyebrow, PageHead } from '../components/ui'
import MapView from '../components/MapView'
import { useLang } from '../lib/i18n'
import { CUISINES, openNow, rankEateries, type Priority } from '../lib/recommend'
import { BIZ_ATTRIBUTION, placeById } from '../lib/data'
import { inr, fmtKm, mapsLink } from '../lib/geo'
import { useNow } from '../lib/clock'
import { NEAR } from './Stay'

const TX = {
  title: { en: 'Eat like a local', kn: 'ಸ್ಥಳೀಯರಂತೆ ಊಟ ಮಾಡಿ', hi: 'स्थानीय लोगों की तरह खाइए' },
  sub: { en: 'Jolada rotti, ennegai and shenga chutney: find North Karnataka meals and small local eateries, not just the big names.', kn: 'ಜೋಳದ ರೊಟ್ಟಿ, ಎಣ್ಣೆಗಾಯಿ, ಶೇಂಗಾ ಚಟ್ನಿ: ದೊಡ್ಡ ಹೆಸರುಗಳಷ್ಟೇ ಅಲ್ಲ, ಸ್ಥಳೀಯ ಖಾನಾವಳಿಗಳನ್ನೂ ಹುಡುಕಿ.', hi: 'जोलद रोट्टी, एण्णेगाई और शेंगा चटनी: बड़े नामों के साथ छोटे स्थानीय भोजनालय भी खोजिए।' },
  diet: { en: 'Food preference', kn: 'ಆಹಾರ ಆದ್ಯತೆ', hi: 'खाने की पसंद' }, budget: { en: 'Budget for two', kn: 'ಇಬ್ಬರಿಗೆ ಬಜೆಟ್', hi: 'दो लोगों का बजट' },
  near: { en: 'Near', kn: 'ಹತ್ತಿರ', hi: 'पास' }, cuisine: { en: 'Cuisine', kn: 'ಅಡುಗೆ ಶೈಲಿ', hi: 'व्यंजन' },
  local: { en: 'Serve jolada rotti meals', kn: 'ಜೋಳದ ರೊಟ್ಟಿ ಊಟ ಬೇಕು', hi: 'ज्वार रोटी वाला भोजन' }, open: { en: 'Open now', kn: 'ಈಗ ತೆರೆದಿದೆ', hi: 'अभी खुला' }, closed: { en: 'Closed now', kn: 'ಈಗ ಮುಚ್ಚಿದೆ', hi: 'अभी बंद' },
}

export default function Food() {
  const { L, lang } = useLang()
  const at = useNow()
  const [diet, setDiet] = useState<'any' | 'veg' | 'nonveg'>('veg')
  const [budget2, setBudget] = useState(400)
  const [near, setNear] = useState<string[]>(['badami_caves'])
  const [cz, setCz] = useState<string[]>([])
  const [localSpecial, setLocal] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const res = useMemo(() => rankEateries({ budget2, places: near, diet, cuisines: cz, priority: 'balanced' as Priority, localSpecial }), [budget2, near, diet, cz, localSpecial])
  const tog = <T,>(a: T[], x: T) => (a.includes(x) ? a.filter((y) => y !== x) : [...a, x])

  return (
    <div>
      <PageHead title={L(TX.title)} sub={L(TX.sub)} />
      <div className="space-y-4 px-4">
        <Card className="space-y-4 p-4">
          <div><Eyebrow>{L(TX.diet)}</Eyebrow><div className="mt-2 flex gap-2">
            <Chip active={diet === 'veg'} onClick={() => setDiet('veg')}><Leaf size={13} className="-mt-0.5 mr-1 inline" />{lang === 'kn' ? 'ಸಸ್ಯಾಹಾರ' : lang === 'hi' ? 'शाकाहारी' : 'Vegetarian'}</Chip>
            <Chip active={diet === 'nonveg'} onClick={() => setDiet('nonveg')}>{lang === 'kn' ? 'ಮಾಂಸಾಹಾರ' : lang === 'hi' ? 'मांसाहारी' : 'Non-veg'}</Chip>
            <Chip active={diet === 'any'} onClick={() => setDiet('any')}>{lang === 'kn' ? 'ಯಾವುದಾದರೂ' : lang === 'hi' ? 'कुछ भी' : 'Anything'}</Chip>
          </div></div>
          <div>
            <div className="flex items-baseline justify-between"><Eyebrow>{L(TX.budget)}</Eyebrow><span className="num text-[18px] font-bold">{inr(budget2)}</span></div>
            <input type="range" min={100} max={1000} step={50} value={budget2} onChange={(e) => setBudget(+e.target.value)} className="mt-2 w-full accent-lake" aria-label="Budget for two" />
          </div>
          <div><Eyebrow>{L(TX.near)}</Eyebrow><div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">{NEAR.map((id) => <Chip key={id} active={near.includes(id)} onClick={() => setNear((a) => (tog(a, id).length ? tog(a, id) : a))}>{L(placeById[id].name).split(':')[0]}</Chip>)}</div></div>
          <div><Eyebrow>{L(TX.cuisine)}</Eyebrow><div className="mt-2 flex flex-wrap gap-2">{CUISINES.map((c) => <Chip key={c} active={cz.includes(c)} onClick={() => setCz((a) => tog(a, c))}>{c}</Chip>)}</div></div>
          <label className="flex items-center gap-2 text-[14.5px]"><input type="checkbox" checked={localSpecial} onChange={(e) => setLocal(e.target.checked)} className="h-4 w-4 accent-lake" />{L(TX.local)}</label>
        </Card>

        <MapView height={200} pins={[...near.map((id) => ({ id, lat: placeById[id].lat, lng: placeById[id].lng, label: placeById[id].name.en, color: '#14211d', radius: 6 })), ...res.slice(0, 6).map((r, i) => ({ id: r.item.id, lat: r.item.lat, lng: r.item.lng, label: `${i + 1}. ${r.item.name}`, color: i === 0 ? '#c0562f' : '#1f5e57' }))]} />

        {res.map((r, i) => {
          const isOpen = openNow(r.item.hours, at)
          return (
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
                      <span className={r.item.diet === 'veg' ? 'font-semibold text-lake' : ''}>{r.item.diet}</span>
                      <span className="num">{inr(r.item.price_for_two)}/2</span>
                      <span className="inline-flex items-center gap-0.5"><Star size={12} className="fill-lamp text-lamp" />{r.item.rating}</span>
                      <span className="inline-flex items-center gap-0.5"><MapPin size={12} />{fmtKm(r.km)}</span>
                      <span className={isOpen ? 'text-lake' : 'text-sand'}>{isOpen ? L(TX.open) : L(TX.closed)}</span><DemoTag />
                    </div>
                    <div className="mt-1 text-[12.5px] text-ink-3">{r.item.cuisines.join(' · ')}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-lake">{lang === 'kn' ? 'ಏಕೆ ಇದು' : lang === 'hi' ? 'यह क्यों' : 'Why this'} <ChevronDown size={14} className={open === r.item.id ? 'rotate-180' : ''} /></div>
              </button>
              {open === r.item.id && (
                <div className="mt-2 border-t border-line pt-2">
                  <ul className="space-y-1">{r.reasons.map((x) => <li key={x.key} className="flex items-center gap-2 text-[13.5px]"><span className={`h-1.5 w-1.5 rounded-full ${x.good ? 'bg-lake' : 'bg-sand'}`} />{x.text}</li>)}</ul>
                  <a href={mapsLink(r.item.lat, r.item.lng)} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full bg-lake px-3.5 py-1.5 text-[13.5px] font-semibold text-white">Directions</a>
                </div>
              )}
            </Card>
          )
        })}
        <p className="px-1 pb-2 text-[11.5px] text-ink-3">Diet and cuisine are inferred from names where obvious (e.g. “Udupi” = vegetarian). {BIZ_ATTRIBUTION}</p>
      </div>
    </div>
  )
}
