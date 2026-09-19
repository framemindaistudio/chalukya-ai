import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Accessibility, ArrowRight, BedDouble, Camera, CarFront, ChevronRight, Cpu, HandHeart, LayoutDashboard, Mic, Search, ShieldCheck, Sparkles, Sun, UtensilsCrossed } from 'lucide-react'
import CircuitLine from '../components/CircuitLine'
import InstallCard from '../components/InstallCard'
import { Card, Eyebrow } from '../components/ui'
import PlaceImage from '../components/PlaceImage'
import { useLang, type Lang } from '../lib/i18n'
import { useNow } from '../lib/clock'
import { bestHours, crowdNow, upcomingEvents } from '../lib/crowd'
import { heatAdvice, useWeather } from '../lib/weather'
import { placeById } from '../lib/data'
import { timeWord } from '../lib/assistant'
import { canListen, listen } from '../lib/speech'
import credits from '../data/photo_credits.json'

const FEATURED = ['badami_caves', 'pattadakal', 'aihole', 'bhutanatha', 'mahakuta', 'kudalasangama', 'banashankari', 'ilkal']
// 4K photographs AI-enhanced from real Commons photos (architecture kept exactly), in two lights:
// the hero follows the clock: dawn light in the morning, golden hour after that.
const HEROES = [
  { slug: 'badami', key: 'hero_badami', place: { en: 'Bhutanatha temples, Badami', kn: 'ಭೂತನಾಥ ದೇವಾಲಯಗಳು, ಬಾದಾಮಿ', hi: 'भूतनाथ मंदिर, बादामी' } },
  { slug: 'pattadakal', key: 'hero_pattadakal', place: { en: 'Pattadakal, UNESCO World Heritage', kn: 'ಪಟ್ಟದಕಲ್ಲು, ಯುನೆಸ್ಕೋ ವಿಶ್ವ ಪರಂಪರೆ', hi: 'पट्टदकल, यूनेस्को विश्व धरोहर' } },
  { slug: 'aihole', key: 'hero_aihole', place: { en: 'Durga temple, Aihole', kn: 'ದುರ್ಗಾ ದೇವಾಲಯ, ಐಹೊಳೆ', hi: 'दुर्गा मंदिर, ऐहोल' } },
]
const EXAMPLES: Record<Lang, string[]> = {
  en: ['I have 6 hours in Badami with two kids…', 'Is Pattadakal crowded right now?', 'Veg lunch near Aihole under ₹300', 'Who is the 18-armed Nataraja?'],
  kn: ['ಬಾದಾಮಿಯಲ್ಲಿ 5 ಗಂಟೆ ಇದೆ, ಮಕ್ಕಳೊಂದಿಗೆ…', 'ಪಟ್ಟದಕಲ್ಲು ಈಗ ರಶ್ ಇದೆಯಾ?', 'ಐಹೊಳೆ ಹತ್ತಿರ ಸಸ್ಯಾಹಾರಿ ಊಟ', '18 ಕೈಗಳ ನಟರಾಜ ಯಾರು?'],
  hi: ['बादामी में 6 घंटे हैं, बच्चों के साथ…', 'क्या पट्टदकल में अभी भीड़ है?', 'ऐहोल के पास शाकाहारी खाना', '18 भुजाओं वाले नटराज कौन हैं?'],
}
const HERO_TX = {
  askLabel: { en: 'Ask anything, or describe your trip', kn: 'ಏನಾದರೂ ಕೇಳಿ ಅಥವಾ ನಿಮ್ಮ ಪ್ರವಾಸ ವಿವರಿಸಿ', hi: 'कुछ भी पूछें या अपनी यात्रा बताएँ' },
  plan: { en: 'Plan my day', kn: 'ನನ್ನ ದಿನ ಯೋಜಿಸಿ', hi: 'मेरा दिन प्लान करें' },
  planSub: { en: 'Tell it your hours, budget and who is with you', kn: 'ಸಮಯ, ಬಜೆಟ್, ಜೊತೆಯಲ್ಲಿ ಯಾರು ಎಂದು ಹೇಳಿ', hi: 'समय, बजट और साथ कौन है, बताइए' },
  access: { en: 'Accessible', kn: 'ಸುಗಮ ಪ್ರವೇಶ', hi: 'सुगम पहुँच' },
  busyDays: { en: 'Busy days coming up', kn: 'ಮುಂಬರುವ ಜನದಟ್ಟಣೆಯ ದಿನಗಳು', hi: 'आने वाले भीड़ वाले दिन' },
  aiPhoto: { en: 'AI-enhanced from photo', kn: 'AI ಸುಧಾರಿತ, ಮೂಲ ಫೋಟೋ', hi: 'AI से निखारा, मूल फ़ोटो' },
}

export default function Home() {
  const { t, lang, L } = useLang()
  const nav = useNavigate()
  const at = useNow()
  const w = useWeather()
  const [hero, setHero] = useState(0)
  const [ex, setEx] = useState(0)
  const [q, setQ] = useState('')
  const [rec, setRec] = useState(false)
  useEffect(() => {
    const a = setInterval(() => setHero((h) => (h + 1) % HEROES.length), 7000)
    const b = setInterval(() => setEx((e) => e + 1), 3200)
    return () => { clearInterval(a); clearInterval(b) }
  }, [])

  const h = at.getHours()
  const greet = h < 12 ? t('greetMorning') : h < 17 ? t('greetAfternoon') : t('greetEvening')
  const openNow = !!crowdNow('badami_caves', at)
  const planDay = new Date(at); if (!openNow && h >= 17) planDay.setDate(at.getDate() + 1)
  const best = bestHours('badami_caves', planDay, openNow ? h : 6)
  const events = upcomingEvents(at, 75).slice(0, 3)
  const adv = w ? heatAdvice(w.feelsC) : null
  const credit = (credits as Record<string, { artist: string; license: string; ai?: string }>)[HEROES[hero].key]
  const light = h < 11 ? 'dawn' : 'gold'

  const submit = (text: string) => { if (text.trim()) nav(`/ask?q=${encodeURIComponent(text.trim())}`) }
  const mic = () => {
    if (rec) return
    setRec(true)
    listen(lang, (tx, fin) => { setQ(tx); if (fin) { setRec(false); submit(tx) } }, () => setRec(false))
  }

  const tiles = [
    { to: '/stay', icon: BedDouble, label: t('stay'), bg: 'bg-lake-soft', fg: 'text-lake' },
    { to: '/food', icon: UtensilsCrossed, label: t('food'), bg: 'bg-lamp-soft', fg: 'text-[#9a6b12]' },
    { to: '/parking', icon: CarFront, label: t('parking'), bg: 'bg-[#e3ecf7]', fg: 'text-[#2f5f93]' },
    { to: '/local', icon: HandHeart, label: t('local'), bg: 'bg-sand-soft', fg: 'text-sand' },
    { to: '/access', icon: Accessibility, label: L(HERO_TX.access), bg: 'bg-[#ece6f6]', fg: 'text-[#6a4c9c]' },
    { to: '/safety', icon: ShieldCheck, label: t('safety'), bg: 'bg-[#fbe3e6]', fg: 'text-sos' },
  ]

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative -mt-[57px] h-[460px] overflow-hidden bg-night">
        {HEROES.map((x, i) => (
          <img key={x.slug} alt="" aria-hidden decoding="async" fetchPriority={i === 0 ? 'high' : 'auto'}
            src={`/img/hero/${x.slug}-${light}-960.webp`} srcSet={`/img/hero/${x.slug}-${light}-960.webp 960w, /img/hero/${x.slug}-${light}-1440.webp 1440w`}
            sizes="(max-width: 520px) 100vw, 520px" className={`hero-img h-full w-full object-cover ${i === hero ? 'on' : ''}`} />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,20,17,.55)_0%,rgba(9,20,17,.15)_32%,rgba(9,20,17,.35)_62%,rgba(238,243,240,1)_100%)]" />
        <div className="relative flex h-full flex-col justify-end px-4 pb-16">
          <p className="rise text-[15px] font-medium text-white/85">{greet}</p>
          <h1 className="rise mt-1 text-[34px] font-bold leading-[1.05] tracking-[-0.03em] text-white [text-shadow:0_2px_20px_rgba(0,0,0,.35)]">{t('whereTo')}</h1>
          {w && adv && (
            <div className="glass rise mt-3 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[13.5px] text-white">
              <Sun size={15} /><span className="num font-bold">{w.tempC}°C</span><span className="text-white/85">· {adv[lang].split('.')[0]}</span>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); submit(q) }} className="glass rise mt-4 flex items-center gap-2 rounded-2xl p-1.5 pl-3.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,.5)]" aria-label={L(HERO_TX.askLabel)}>
            <Search size={19} className="shrink-0 text-white/80" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={EXAMPLES[lang][ex % EXAMPLES[lang].length]}
              className="h-11 min-w-0 flex-1 bg-transparent text-[15.5px] text-white outline-none placeholder:text-white/70" />
            <button type="button" onClick={mic} disabled={!canListen()} aria-label="Speak"
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${rec ? 'bg-sand' : 'bg-lake'} disabled:bg-white/20`}>
              {rec ? <span className="relative grid place-items-center"><span className="live-pulse absolute h-7 w-7 rounded-full bg-white/40" /><Mic size={19} /></span> : <Mic size={19} />}
            </button>
          </form>
        </div>
        <div className="absolute bottom-[72px] right-3 flex items-center gap-1.5">
          {HEROES.map((x, i) => <button key={x.slug} aria-label={x.place.en} onClick={() => setHero(i)} className={`h-1.5 rounded-full transition-all ${i === hero ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />)}
        </div>
        <div className="absolute left-4 top-[66px] max-w-[70%] truncate text-[11px] text-white/70">{L(HEROES[hero].place)}{credit ? ` · ${credit.ai ? `${L(HERO_TX.aiPhoto)} ` : ''}© ${credit.artist}, ${credit.license}` : ''}</div>
      </section>

      <div className="relative z-10 -mt-12 space-y-4 px-4">
        <CircuitLine />

        <div className="grid grid-cols-2 gap-3">
          <Link to="/plan" className="card relative overflow-hidden bg-[linear-gradient(145deg,#1f5e57,#2b776e_55%,#3c8f7f)] p-4 text-white">
            <Sparkles size={24} strokeWidth={1.9} />
            <div className="mt-6 text-[19px] font-bold leading-tight tracking-[-0.02em] [overflow-wrap:anywhere]">{L(HERO_TX.plan)}</div>
            <div className="mt-1 text-[12.5px] leading-snug text-white/80">{L(HERO_TX.planSub)}</div>
            <svg className="absolute -right-5 -top-5 h-24 w-24 text-white/10" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="3 5" /></svg>
          </Link>
          <Link to="/scan" className="card relative overflow-hidden bg-[linear-gradient(145deg,#c0562f,#d7773f_60%,#e39a52)] p-4 text-white">
            <Camera size={24} strokeWidth={1.9} />
            <div className="mt-6 text-[19px] font-bold leading-tight tracking-[-0.02em] [overflow-wrap:anywhere]">{t('scan')}</div>
            <div className="mt-1 text-[12.5px] leading-snug text-white/85">{t('scanSub')}</div>
            <svg className="absolute -right-3 -top-3 h-20 w-20 text-white/15" viewBox="0 0 40 40"><path d="M4 12V4h8M28 4h8v8M36 28v8h-8M12 36H4v-8" stroke="currentColor" strokeWidth="2.5" fill="none" /></svg>
          </Link>
        </div>

        <InstallCard />

        <div className="grid grid-cols-3 gap-2.5">
          {tiles.map(({ to, icon: Icon, label, bg, fg }) => (
            <Link key={to} to={to} className="card flex flex-col items-center gap-2 px-2 py-3.5 text-center active:scale-[0.97]">
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${bg} ${fg}`}><Icon size={21} strokeWidth={2} /></span>
              <span className="text-[13.5px] font-semibold leading-tight text-ink">{label}</span>
            </Link>
          ))}
        </div>

        {best && (
          <Card className="p-4">
            <Eyebrow>{planDay.getDate() === at.getDate() ? t('bestTimeToday') : `${t('tomorrow')} · ${t('bestTimeToday').replace(/today|ಇಂದು|आज/i, '').trim()}`}</Eyebrow>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <div className="text-[20px] font-bold leading-tight tracking-[-0.02em]">{L(placeById.badami_caves.name)}</div>
                <div className="mt-1 text-[14px] text-ink-2">
                  {t('quietest')}: <b className="text-lake">{timeWord(best.quiet.h, lang)}</b> · {t('busiest')}: <b className="text-sand">{timeWord(best.busy.h, lang)}</b>
                </div>
              </div>
              <div className="text-right">
                <div className="num text-[28px] font-bold leading-none text-ink">{best.day.p50.toLocaleString('en-IN')}</div>
                <div className="text-[11.5px] text-ink-3">{t('expected')}</div>
              </div>
            </div>
            <HourBars hourly={best.day.hourly} highlight={best.quiet.h} nowH={planDay.getDate() === at.getDate() ? h : -1} />
          </Card>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between"><Eyebrow>{t('explore')}</Eyebrow></div>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {FEATURED.map((id) => (
              <Link key={id} to={`/place/${id}`} className="relative h-[210px] w-[170px] shrink-0 snap-start overflow-hidden rounded-[20px] shadow-[0_10px_28px_-14px_rgba(20,33,29,.55)]">
                <PlaceImage id={id} className="absolute inset-0 h-full w-full" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(9,20,17,.85)_100%)]" />
                <div className="absolute inset-x-3 bottom-3 text-white">
                  <div className="text-[15.5px] font-bold leading-tight tracking-[-0.01em]">{L(placeById[id].name).split(':')[0]}</div>
                  <div className="mt-0.5 text-[11.5px] text-white/75">{placeById[id].period}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {events.length > 0 && (
          <Card className="p-4">
            <Eyebrow>{L(HERO_TX.busyDays)}</Eyebrow>
            <ul className="mt-2 divide-y divide-line">
              {events.map((e) => (
                <li key={e.d} className="flex items-center justify-between py-2.5 text-[14.5px]">
                  <span className="font-medium">{e.tag}</span>
                  <span className="num rounded-full bg-mist px-2.5 py-0.5 text-[13px] text-ink-2">{new Date(e.d).toLocaleDateString(lang === 'kn' ? 'kn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="grid gap-2.5 pb-3">
          <Link to="/how" className="card flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-lake-soft text-lake"><Cpu size={20} /></span>
            <span className="flex-1 text-[15px] font-semibold">{t('howAIWorks')}</span><ChevronRight size={18} className="text-ink-3" />
          </Link>
          <Link to="/command" className="card flex items-center gap-3 bg-night p-4 text-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lamp"><LayoutDashboard size={20} /></span>
            <span className="flex-1 text-[15px] font-semibold">{t('commandCentre')}</span><ArrowRight size={18} className="text-white/50" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export function HourBars({ hourly, highlight, nowH = -1 }: { hourly: number[]; highlight?: number; nowH?: number }) {
  const max = Math.max(...hourly, 1)
  return (
    <div className="mt-3">
      <div className="flex h-16 items-end gap-[3px]" aria-hidden>
        {hourly.map((v, i) => {
          const hr = 6 + i
          const col = hr === highlight ? '#1f5e57' : hr === nowH ? '#d9a441' : '#c9d8d2'
          return <div key={i} className="flex-1 rounded-t-[4px] transition-[height] duration-500" style={{ height: `${Math.max(6, (v / max) * 100)}%`, background: col }} />
        })}
      </div>
      <div className="num mt-1 flex justify-between text-[11px] text-ink-3"><span>6 AM</span><span>9</span><span>12 PM</span><span>3</span><span>6 PM</span></div>
    </div>
  )
}
