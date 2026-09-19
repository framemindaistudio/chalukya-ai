import { Link, useParams } from 'react-router'
import { Accessibility, CarFront, ChevronLeft, Clock, Footprints, Navigation, Sun } from 'lucide-react'
import { Card, Eyebrow, LevelBadge } from '../components/ui'
import PlaceImage from '../components/PlaceImage'
import MapView from '../components/MapView'
import { HourBars } from './Home'
import { useLang } from '../lib/i18n'
import { useNow } from '../lib/clock'
import { LOT_FOR_SITE, FORECAST_SITE, PLACES, SCULPTURES, SOURCES, placeById } from '../lib/data'
import { bestHours, crowdNow } from '../lib/crowd'
import { lotStatus, freeOnArrival } from '../lib/parking'
import { haversineKm, fmtKm, mapsLink } from '../lib/geo'
import { timeWord } from '../lib/assistant'
import ExplainIn from '../components/ExplainIn'
import ReviewBox from '../components/ReviewBox'

const TX = {
  visit: { en: 'Plan your visit', kn: 'ಭೇಟಿ ಯೋಜನೆ', hi: 'यात्रा की योजना' }, time: { en: 'Time needed', kn: 'ಬೇಕಾದ ಸಮಯ', hi: 'लगने वाला समय' },
  steps: { en: 'Steps', kn: 'ಮೆಟ್ಟಿಲು', hi: 'सीढ़ियाँ' }, yes: { en: 'Yes, many', kn: 'ಹೌದು, ಅನೇಕ', hi: 'हाँ, कई' }, few: { en: 'Few or none', kn: 'ಕಡಿಮೆ ಅಥವಾ ಇಲ್ಲ', hi: 'कम या नहीं' },
  wheel: { en: 'Wheelchair', kn: 'ಗಾಲಿಕುರ್ಚಿ', hi: 'व्हीलचेयर' }, shade: { en: 'Shade', kn: 'ನೆರಳು', hi: 'छाया' },
  crowdToday: { en: 'Crowd today', kn: 'ಇಂದಿನ ಜನಸಂದಣಿ', hi: 'आज की भीड़' }, sculptures: { en: 'Sculptures you can scan here', kn: 'ಇಲ್ಲಿ ಸ್ಕ್ಯಾನ್ ಮಾಡಬಹುದಾದ ಶಿಲ್ಪಗಳು', hi: 'यहाँ स्कैन की जा सकने वाली मूर्तियाँ' },
  nearby: { en: 'Nearby', kn: 'ಹತ್ತಿರದಲ್ಲಿ', hi: 'पास में' }, ask: { en: 'Ask about this place', kn: 'ಈ ಸ್ಥಳದ ಬಗ್ಗೆ ಕೇಳಿ', hi: 'इस जगह के बारे में पूछें' },
  sources: { en: 'Sources', kn: 'ಮೂಲಗಳು', hi: 'स्रोत' },
}

export default function PlaceDetail() {
  const { id = 'badami_caves' } = useParams()
  const { L, lang, t } = useLang()
  const at = useNow()
  const p = placeById[id]
  if (!p) return <div className="p-6">Unknown place. <Link to="/" className="text-lake">Home</Link></div>
  const site = FORECAST_SITE[id]
  const now = site ? crowdNow(site, at) : null
  const best = site ? bestHours(site, at, crowdNow(site, at) ? at.getHours() : 6) : null
  const lots = site ? LOT_FOR_SITE[site] ?? [] : []
  const sculpt = SCULPTURES.filter((s) => s.place === id)
  const nearby = PLACES.filter((x) => x.id !== id).map((x) => ({ x, km: haversineKm(p, x) * 1.3 })).sort((a, b) => a.km - b.km).slice(0, 4)
  const srcs = [...new Set([p.src, ...p.facts.map((f) => f.src)].filter(Boolean))] as string[]

  return (
    <div>
      <div className="relative">
        <PlaceImage id={id} className="h-[240px] w-full" showCredit sizes="(max-width: 520px) 100vw, 520px" />
        <Link to="/" className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow" aria-label={t('back')}><ChevronLeft size={20} /></Link>
      </div>
      <div className="space-y-4 px-4 pt-4">
        <section>
          <Eyebrow>{p.period}{p.dynasty && p.dynasty !== '—' ? ` · ${p.dynasty}` : ''}</Eyebrow>
          <h1 className="display mt-1 text-[30px] leading-[1.08]">{L(p.name)}</h1>
          {lang !== 'kn' && <div className="display mt-0.5 text-[17px] text-ink-3">{p.name.kn}</div>}
          <p className="mt-3 text-[16px] leading-relaxed">{L(p.summary)}</p>
          <ExplainIn className="mt-3" title={p.name} body={[p.summary, ...p.facts]} />
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={mapsLink(p.lat, p.lng)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-[14px] font-semibold"><Navigation size={15} className="text-lake" />{t('openMap')}</a>
            <Link to={`/ask?q=${encodeURIComponent(L(p.name))}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-[14px] font-semibold">{L(TX.ask)}</Link>
          </div>
        </section>

        {p.facts.length > 0 && (
          <Card className="p-4">
            <ul className="space-y-3">{p.facts.map((f, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed"><span className="display mt-0.5 text-[18px] leading-none text-lamp">✦</span><span>{f[lang] ?? f.en}</span></li>)}</ul>
          </Card>
        )}

        <Card className="p-4">
          <Eyebrow>{L(TX.visit)}</Eyebrow>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[14px]">
            <div className="flex gap-2"><Clock size={17} className="text-lake" /><div><div className="text-ink-3">{L(TX.time)}</div><b>{p.visit.minutes} {t('min')}</b></div></div>
            <div className="flex gap-2"><Footprints size={17} className="text-lake" /><div><div className="text-ink-3">{L(TX.steps)}</div><b>{p.visit.stairs ? L(TX.yes) : L(TX.few)}</b></div></div>
            <div className="flex gap-2"><Accessibility size={17} className="text-lake" /><div><div className="text-ink-3">{L(TX.wheel)}</div><b className="capitalize">{p.visit.wheelchair}</b></div></div>
            <div className="flex gap-2"><Sun size={17} className="text-lake" /><div><div className="text-ink-3">{L(TX.shade)}</div><b className="capitalize">{p.visit.shade}</b></div></div>
          </div>
          <p className="mt-3 text-[13px] text-ink-2">{p.visit.entry}</p>
        </Card>

        {best && (
          <Card className="p-4">
            <div className="flex items-center justify-between"><Eyebrow>{L(TX.crowdToday)}</Eyebrow>{now ? <LevelBadge level={now.level} /> : <span className="text-[12.5px] text-ink-3">{t('closedNow')}</span>}</div>
            <div className="mt-1 text-[14px] text-ink-2">{t('quietest')}: <b className="text-lake">{timeWord(best.quiet.h, lang)}</b> · {t('busiest')}: <b className="text-sand">{timeWord(best.busy.h, lang)}</b> · ~{best.day.p50.toLocaleString('en-IN')} {lang === 'en' ? 'visitors' : ''}{best.day.tag ? ` · ${best.day.tag}` : ''}</div>
            <HourBars hourly={best.day.hourly} highlight={best.quiet.h} nowH={now ? at.getHours() : -1} />
          </Card>
        )}

        {lots.length > 0 && (
          <Card className="p-4">
            <Eyebrow>{t('parking')}</Eyebrow>
            {lots.map((l) => { const s = lotStatus(l, at); return (
              <div key={l} className="mt-2 flex items-center gap-3"><CarFront size={18} className="text-lake" /><div className="flex-1 text-[14.5px]"><b>{s.name}</b><div className="text-[12px] text-ink-3">+30 min: ~{freeOnArrival(l, at, 30)} {t('free')}</div></div><div className="num text-[22px] font-bold">{s.free}<span className="text-[12px] font-normal text-ink-3">/{s.capacity}</span></div></div>
            ) })}
          </Card>
        )}

        {sculpt.length > 0 && (
          <Card className="p-4">
            <Eyebrow>{L(TX.sculptures)}</Eyebrow>
            <ul className="mt-2 divide-y divide-line">{sculpt.map((s) => <li key={s.id} className="py-2"><div className="text-[15px] font-semibold">{L(s.name)}</div><div className="text-[12.5px] text-ink-3">{s.group}</div></li>)}</ul>
            <Link to="/scan" className="mt-2 inline-block text-[14px] font-semibold text-lake">{t('scan')} →</Link>
          </Card>
        )}

        <ReviewBox place={p.id} />

        <MapView height={200} pins={[{ id: p.id, lat: p.lat, lng: p.lng, label: p.name.en, color: '#c0562f', radius: 11 }, ...nearby.map(({ x }) => ({ id: x.id, lat: x.lat, lng: x.lng, label: x.name.en }))]} />

        <Card className="p-4">
          <Eyebrow>{L(TX.nearby)}</Eyebrow>
          <ul className="mt-1 divide-y divide-line">{nearby.map(({ x, km }) => <li key={x.id}><Link to={`/place/${x.id}`} className="flex justify-between py-2 text-[14.5px]"><span>{L(x.name)}</span><span className="num text-ink-2">{fmtKm(km)}</span></Link></li>)}</ul>
        </Card>

        {srcs.length > 0 && <p className="px-1 pb-3 text-[11.5px] text-ink-3">{L(TX.sources)}: {srcs.map((s) => SOURCES.find((x) => x.id === s)?.title ?? s).join(' · ')}</p>}
      </div>
    </div>
  )
}
