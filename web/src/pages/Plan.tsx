import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Accessibility, Bike, Bus, Car, Clock, Leaf, Mic, Sparkles, UtensilsCrossed, Wallet } from 'lucide-react'
import { parseTrip } from '../lib/tripParse'
import { canListen, listen } from '../lib/speech'
import { Card, Chip, Eyebrow, LevelBadge, PageHead } from '../components/ui'
import MapView from '../components/MapView'
import { useLang } from '../lib/i18n'
import { hhmm, now } from '../lib/clock'
import { plan, type Interest, type Mobility, type Mode, type PlanInput } from '../lib/itinerary'
import { placeById, HUB_COORDS } from '../lib/data'
import { LEVEL_COLOR } from '../lib/crowd'
import { inr } from '../lib/geo'

const TX = {
  title: { en: 'Plan a crowd-smart trip', kn: 'ಜನಸಂದಣಿ ತಪ್ಪಿಸುವ ಪ್ರವಾಸ ಯೋಜನೆ', hi: 'भीड़ से बचने वाली यात्रा योजना' },
  sub: { en: 'The planner tries every visiting order and picks the one with the least travel, crowds and midday heat on stairs.', kn: 'ಪ್ರತಿಯೊಂದು ಭೇಟಿ ಕ್ರಮವನ್ನೂ ಪರೀಕ್ಷಿಸಿ, ಕಡಿಮೆ ಪ್ರಯಾಣ, ಕಡಿಮೆ ಜನಸಂದಣಿ ಮತ್ತು ಮಧ್ಯಾಹ್ನದ ಬಿಸಿಲಿನಲ್ಲಿ ಕಡಿಮೆ ಮೆಟ್ಟಿಲು ಇರುವ ಕ್ರಮವನ್ನು ಆರಿಸುತ್ತದೆ.', hi: 'प्लानर हर क्रम आज़माकर वह चुनता है जिसमें सबसे कम यात्रा, भीड़ और दोपहर की धूप में सीढ़ियाँ हों।' },
  when: { en: 'Starting', kn: 'ಆರಂಭ', hi: 'शुरुआत' }, days: { en: 'Days', kn: 'ದಿನಗಳು', hi: 'दिन' },
  interests: { en: 'I love', kn: 'ನನಗೆ ಇಷ್ಟ', hi: 'मुझे पसंद है' }, who: { en: 'Who is travelling', kn: 'ಯಾರು ಪ್ರಯಾಣಿಸುತ್ತಿದ್ದಾರೆ', hi: 'कौन यात्रा कर रहा है' },
  how: { en: 'Getting around', kn: 'ಪ್ರಯಾಣದ ವಿಧಾನ', hi: 'आने-जाने का तरीका' }, go: { en: 'Build my plan', kn: 'ಯೋಜನೆ ರಚಿಸಿ', hi: 'योजना बनाएँ' },
  day: { en: 'Day', kn: 'ದಿನ', hi: 'दिन' }, lunch: { en: 'Lunch', kn: 'ಮಧ್ಯಾಹ್ನದ ಊಟ', hi: 'दोपहर का खाना' },
  back: { en: 'Back to base', kn: 'ಮರಳಿ ತಂಗುದಾಣಕ್ಕೆ', hi: 'वापस ठहरने की जगह' }, parking: { en: 'Parking on arrival', kn: 'ತಲುಪಿದಾಗ ಪಾರ್ಕಿಂಗ್', hi: 'पहुँचने पर पार्किंग' },
  describe: { en: 'Describe your trip in your own words', kn: 'ನಿಮ್ಮ ಪ್ರವಾಸವನ್ನು ನಿಮ್ಮದೇ ಮಾತಿನಲ್ಲಿ ಹೇಳಿ', hi: 'अपनी यात्रा अपने शब्दों में बताइए' },
  example: { en: 'I am in Badami. I have 6 hours, ₹3,000 budget, two children, and I like history.', kn: 'ನಾನು ಬಾದಾಮಿಯಲ್ಲಿದ್ದೇನೆ. 6 ಗಂಟೆ ಇದೆ, ₹3000 ಬಜೆಟ್, ಇಬ್ಬರು ಮಕ್ಕಳು, ಇತಿಹಾಸ ಇಷ್ಟ.', hi: 'मैं बादामी में हूँ। मेरे पास 6 घंटे हैं, ₹3000 बजट, दो बच्चे, इतिहास पसंद है।' },
  fromText: { en: 'Plan it', kn: 'ಯೋಜಿಸಿ', hi: 'योजना बनाएँ' }, orForm: { en: 'Or choose options', kn: 'ಅಥವಾ ಆಯ್ಕೆಗಳನ್ನು ಆರಿಸಿ', hi: 'या विकल्प चुनें' },
  tryEx: { en: 'Try example', kn: 'ಉದಾಹರಣೆ', hi: 'उदाहरण' },
  understood: { en: 'Understood', kn: 'ಅರ್ಥವಾದದ್ದು', hi: 'समझा गया' }, spend: { en: 'Estimated spend (food + travel; entry tickets extra)', kn: 'ಅಂದಾಜು ಖರ್ಚು (ಊಟ + ಪ್ರಯಾಣ; ಪ್ರವೇಶ ಟಿಕೆಟ್ ಪ್ರತ್ಯೇಕ)', hi: 'अनुमानित खर्च (खाना + यात्रा; प्रवेश टिकट अलग)' },
  greener: { en: 'Taking the KSRTC bus instead would emit about', kn: 'ಕೆಎಸ್‌ಆರ್‌ಟಿಸಿ ಬಸ್‌ನಲ್ಲಿ ಹೋದರೆ ಸುಮಾರು', hi: 'केएसआरटीसी बस से जाने पर लगभग' },
}
const INTERESTS: { id: Interest; en: string; kn: string; hi: string }[] = [
  { id: 'heritage', en: 'Temples & sculpture', kn: 'ದೇವಾಲಯ ಮತ್ತು ಶಿಲ್ಪ', hi: 'मंदिर और मूर्तिकला' }, { id: 'pilgrimage', en: 'Pilgrimage', kn: 'ತೀರ್ಥಯಾತ್ರೆ', hi: 'तीर्थयात्रा' },
  { id: 'crafts', en: 'Crafts & food', kn: 'ಕರಕುಶಲ ಮತ್ತು ಆಹಾರ', hi: 'हस्तशिल्प और खाना' }, { id: 'nature', en: 'Nature & views', kn: 'ಪ್ರಕೃತಿ ಮತ್ತು ನೋಟ', hi: 'प्रकृति और नज़ारे' },
]
const MOB: { id: Mobility; en: string; kn: string; hi: string }[] = [
  { id: 'normal', en: 'Everyone walks fine', kn: 'ಎಲ್ಲರೂ ಆರಾಮವಾಗಿ ನಡೆಯುತ್ತಾರೆ', hi: 'सब आराम से चल सकते हैं' },
  { id: 'senior', en: 'With elders', kn: 'ಹಿರಿಯರೊಂದಿಗೆ', hi: 'बुज़ुर्गों के साथ' }, { id: 'wheelchair', en: 'Wheelchair', kn: 'ಗಾಲಿಕುರ್ಚಿ', hi: 'व्हीलचेयर' },
]

export default function Plan() {
  const { L, lang, t } = useLang()
  const [startIn, setStartIn] = useState(0)
  const [days, setDays] = useState(1)
  const [interests, setInterests] = useState<Interest[]>(['heritage'])
  const [mobility, setMobility] = useState<Mobility>('normal')
  const [mode, setMode] = useState<Mode>('car')
  const [people, setPeople] = useState(4)
  const [go, setGo] = useState(0)
  const [params] = useSearchParams()
  const [desc, setDesc] = useState(params.get('q') ?? '')
  const [nl, setNl] = useState<{ input: PlanInput; understood: { key: string; value: string }[] } | null>(null)
  const [rec, setRec] = useState(false)

  function planFromText(text = desc) {
    if (!text.trim()) return
    const p = parseTrip(text)
    setNl(p); setDays(p.input.days); setInterests(p.input.interests); setMobility(p.input.mobility); setMode(p.input.mode); setPeople(p.input.people)
    setGo((g) => g + 1)
  }
  useEffect(() => { if (params.get('q')) planFromText(params.get('q')!) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(() => {
    if (!go) return null
    const start = now(); start.setDate(start.getDate() + startIn)
    const t0 = performance.now()
    const r = plan(nl ? nl.input : { start, days, interests, mobility, mode, people, startFrom: 'badami_bus_stand' })
    return { days: r, ms: Math.round(performance.now() - t0), budget: nl?.input.budget }
  }, [go]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (i: Interest) => setInterests((a) => (a.includes(i) ? (a.length > 1 ? a.filter((x) => x !== i) : a) : [...a, i]))
  const base = HUB_COORDS.badami_bus_stand

  return (
    <div>
      <PageHead title={L(TX.title)} sub={L(TX.sub)} />
      <div className="space-y-4 px-4">
        <Card className="p-4">
          <Eyebrow>{L(TX.describe)}</Eyebrow>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder={L(TX.example)}
            className="mt-2 w-full resize-none rounded-xl border border-line bg-paper p-3 text-[15px] outline-none focus:border-lake" />
          <div className="mt-2 flex gap-2">
            <button onClick={() => planFromText()} disabled={!desc.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lake py-3 text-[15px] font-semibold text-white disabled:opacity-50"><Sparkles size={17} />{L(TX.fromText)}</button>
            <button type="button" disabled={!canListen()} aria-label="Speak your trip" onClick={() => { if (rec) return; setRec(true); listen(lang, (tx, fin) => { setDesc(tx); if (fin) { setRec(false); planFromText(tx) } }, () => setRec(false)) }}
              className={`grid w-12 place-items-center rounded-xl text-white ${rec ? 'bg-sand' : 'bg-ink'} disabled:bg-ink-3`}><Mic size={19} /></button>
            <button type="button" onClick={() => { setDesc(L(TX.example)); planFromText(L(TX.example)) }} className="rounded-xl border border-line px-3 text-[13px] font-semibold text-ink-2">{L(TX.tryEx)}</button>
          </div>
          {nl && <div className="mt-3 flex flex-wrap gap-1.5"><span className="text-[12px] font-semibold text-ink-3">{L(TX.understood)}:</span>{nl.understood.map((u) => <span key={u.key} className="rounded-md bg-mist px-2 py-0.5 text-[12px] text-ink-2">{u.key}: <b className="text-ink">{u.value}</b></span>)}</div>}
        </Card>

        <Card className="space-y-4 p-4">
          <Eyebrow>{L(TX.orForm)}</Eyebrow>
          <div>
            <Eyebrow>{L(TX.when)}</Eyebrow>
            <div className="mt-2 flex gap-2">{[0, 1, 2].map((d) => <Chip key={d} active={startIn === d} onClick={() => setStartIn(d)}>{d === 0 ? t('today') : d === 1 ? t('tomorrow') : new Date(+now() + 2 * 864e5).toLocaleDateString(lang === 'kn' ? 'kn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric' })}</Chip>)}</div>
          </div>
          <div>
            <Eyebrow>{L(TX.days)}</Eyebrow>
            <div className="mt-2 flex gap-2">{[1, 2, 3].map((d) => <Chip key={d} active={days === d} onClick={() => setDays(d)}>{d}</Chip>)}</div>
          </div>
          <div>
            <Eyebrow>{L(TX.interests)}</Eyebrow>
            <div className="mt-2 flex flex-wrap gap-2">{INTERESTS.map((i) => <Chip key={i.id} active={interests.includes(i.id)} onClick={() => toggle(i.id)}>{i[lang]}</Chip>)}</div>
          </div>
          <div>
            <Eyebrow>{L(TX.who)}</Eyebrow>
            <div className="mt-2 flex flex-wrap gap-2">{MOB.map((m) => <Chip key={m.id} active={mobility === m.id} onClick={() => setMobility(m.id)}>{m.id === 'wheelchair' && <Accessibility size={14} className="-mt-0.5 mr-1 inline" />}{m[lang]}</Chip>)}</div>
            <div className="mt-2 flex items-center gap-3 text-[14px] text-ink-2">
              <span>👥</span>
              <input type="range" min={1} max={12} value={people} onChange={(e) => setPeople(+e.target.value)} className="flex-1 accent-lake" aria-label="People" />
              <span className="num w-6 text-right font-bold text-ink">{people}</span>
            </div>
          </div>
          <div>
            <Eyebrow>{L(TX.how)}</Eyebrow>
            <div className="mt-2 flex flex-wrap gap-2">
              {([['car', Car, 'Car / taxi'], ['bus', Bus, 'KSRTC bus'], ['bike', Bike, 'Two-wheeler']] as const).map(([id, Icon, label]) => (
                <Chip key={id} active={mode === id} onClick={() => setMode(id)}><Icon size={15} className="-mt-0.5 mr-1 inline" />{label}</Chip>
              ))}
            </div>
          </div>
          <button onClick={() => { setNl(null); setGo((g) => g + 1) }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-lake py-3.5 text-[16px] font-semibold text-white"><Sparkles size={18} />{L(TX.go)}</button>
        </Card>

        {result?.days.map((d, di) => {
          const line: [number, number][] = [[base[0], base[1]], ...d.stops.map((s) => [placeById[s.id].lat, placeById[s.id].lng] as [number, number]), [base[0], base[1]]]
          return (
            <Card key={d.date} className="rise overflow-hidden">
              <div className="flex items-baseline justify-between px-4 pt-4">
                <h2 className="display text-[22px]">{L(TX.day)} {di + 1}</h2>
                <span className="num text-[14px] text-ink-2">{new Date(d.date).toLocaleDateString(lang === 'kn' ? 'kn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="num mt-1 flex gap-4 px-4 text-[13px] text-ink-2">
                <span><b className="text-ink">{d.km}</b> km</span><span><b className="text-ink">{Math.round(d.driveMin / 6) / 10}</b> h driving</span>
                <span className="inline-flex items-center gap-1"><Leaf size={13} className="text-lake" /><b className="text-ink">{d.co2}</b> kg CO₂</span>
              </div>
              <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl bg-mist px-3 py-2 text-[13px]">
                <Wallet size={15} className="text-lake" /><span className="flex-1 text-ink-2">{L(TX.spend)}</span>
                <b className={`num text-[15px] ${result.budget && d.cost.total > result.budget ? 'text-sand' : 'text-ink'}`}>₹{d.cost.total.toLocaleString('en-IN')}{result.budget ? ` / ₹${result.budget.toLocaleString('en-IN')}` : ''}</b>
              </div>
              <div className="px-4 pt-3"><MapView height={200} pins={[{ id: 'base', lat: base[0], lng: base[1], label: 'Badami (base)', color: '#14211d', radius: 6 }, ...d.stops.map((s, i) => ({ id: s.id, lat: placeById[s.id].lat, lng: placeById[s.id].lng, label: `${i + 1}. ${placeById[s.id].name.en}`, color: s.level ? LEVEL_COLOR[s.level] : '#1f5e57' }))]} line={line} /></div>
              <ol className="relative mx-4 mt-3 border-l-2 border-dashed border-lake-soft pb-2">
                {d.stops.map((s, i) => (
                  <li key={s.id} className="relative pb-4 pl-5">
                    <span className="absolute -left-[9px] top-1 grid h-4 w-4 place-items-center rounded-full bg-lake text-[9px] font-bold text-white">{i + 1}</span>
                    <div className="num text-[12.5px] font-semibold text-ink-3"><Clock size={12} className="-mt-0.5 mr-1 inline" />{hhmm(s.arrive)} – {hhmm(s.depart)} · {s.travelMin} {t('min')} drive</div>
                    <Link to={`/place/${s.id}`} className="display text-[18px] leading-tight text-ink">{L(placeById[s.id].name)}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]">
                      {s.level && <LevelBadge level={s.level} />}
                      {s.present != null && <span className="text-ink-3">~{s.present} people on site</span>}
                      {s.parkingFree != null && <span className="rounded-full bg-mist px-2 py-0.5 text-ink-2">P {L(TX.parking)}: <b className="num">{s.parkingFree}/{s.parkingCap}</b></span>}
                    </div>
                    {d.lunch && d.lunch.afterIndex === i && d.lunch.eatery && (
                      <div className="mt-3 rounded-xl bg-lamp-soft px-3 py-2 text-[13.5px]">
                        <UtensilsCrossed size={14} className="-mt-0.5 mr-1.5 inline text-[#8a6412]" /><b>{L(TX.lunch)}</b>: {d.lunch.eatery.item.name} · {inr(d.lunch.eatery.item.price_for_two)}/2 · {d.lunch.eatery.item.cuisines[0]}
                      </div>
                    )}
                  </li>
                ))}
                <li className="pl-5 text-[13px] text-ink-3">{L(TX.back)} · ~{hhmm(d.endAt)}</li>
              </ol>
              {mode !== 'bus' && <p className="mx-4 mb-4 rounded-xl bg-lake-soft/60 px-3 py-2 text-[13px] text-lake"><Leaf size={13} className="-mt-0.5 mr-1 inline" />{L(TX.greener)} <b>{d.co2Bus} kg</b> CO₂ ({people} people).</p>}
            </Card>
          )
        })}
        {result && <p className="num px-1 pb-2 text-center text-[11.5px] text-ink-3">Optimised on this phone in {result.ms} ms · crowd = LightGBM forecast · parking = on-device model · roads = OSM</p>}
      </div>
    </div>
  )
}
