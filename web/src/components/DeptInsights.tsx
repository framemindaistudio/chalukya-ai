import { useEffect, useMemo, useState } from 'react'
import { BarChart3, MessageSquareWarning } from 'lucide-react'
import samples from '../data/review_samples.json'
import { analyzeReview, ASPECT_LABEL, type ReviewAnalysis } from '../lib/reviews'
import { onAlert, onStat, type Stat } from '../lib/live'
import { placeById, sculptureById } from '../lib/data'

type R = { place: string; text: string; stars: number; a: ReviewAnalysis; sample: boolean; at: number }
const INTENT_LABEL: Record<string, string> = {
  about_place: 'History & places', sculpture: 'Sculptures', timings_entry: 'Timings & tickets', best_time_crowd: 'Crowds / best time', parking: 'Parking',
  food: 'Food', stay: 'Stays', route_distance: 'Routes & distance', safety_emergency: 'Safety & help', accessibility: 'Accessibility', itinerary: 'Trip planning',
  official_office: 'Tourism office', official_reach: 'Getting here', shopping_crafts: 'Crafts & shopping', festival: 'Festivals', weather_heat: 'Weather', guide: 'Guides', adventure: 'Adventure', greeting: 'Greetings', fallback: 'Not understood',
}
const LANG = { kn: 'ಕನ್ನಡ', hi: 'हिन्दी', en: 'English' } as Record<string, string>

function Bar({ label, n, max, color }: { label: string; n: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[12.5px]">
      <span className="w-[120px] shrink-0 truncate text-white/70">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full" style={{ width: `${(n / Math.max(1, max)) * 100}%`, background: color }} /></div>
      <span className="num w-6 text-right text-white/80">{n}</span>
    </div>
  )
}

/** Tourism Department analytics: what visitors say (review sentiment + facility complaints) and what they ask. */
export default function DeptInsights() {
  const [reviews, setReviews] = useState<R[]>([])
  const [stats, setStats] = useState<Stat[]>([])
  useEffect(() => {
    let alive = true
    Promise.all((samples as { place: string; text: string; stars: number }[]).map(async (s, i) => ({ ...s, a: await analyzeReview(s.text), sample: true, at: Date.now() - (i + 1) * 3_600_000 })))
      .then((rs) => alive && setReviews((cur) => [...cur, ...rs]))
    const off1 = onAlert((al) => {
      if (al.type !== 'review' || !al.data) return
      const d = al.data as any
      setReviews((cur) => cur.some((x) => x.at === al.at) ? cur : [{ place: al.place ?? '', text: d.text, stars: d.stars, a: { sentiment: d.sentiment, confidence: d.confidence, aspects: d.aspects, lang: d.lang }, sample: false, at: al.at }, ...cur])
    })
    const off2 = onStat((s) => setStats((cur) => [s, ...cur].slice(0, 500)))
    return () => { alive = false; off1(); off2() }
  }, [])

  const bySite = useMemo(() => {
    const m: Record<string, { pos: number; neg: number; mix: number }> = {}
    for (const r of reviews) { (m[r.place] ??= { pos: 0, neg: 0, mix: 0 })[r.a.sentiment]++ }
    return Object.entries(m).sort((a, b) => b[1].neg + b[1].mix - (a[1].neg + a[1].mix))
  }, [reviews])
  const complaints = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of reviews) if (r.a.sentiment !== 'pos') for (const a of r.a.aspects) c[a] = (c[a] ?? 0) + 1
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [reviews])
  const count = (f: (s: Stat) => string | undefined, kind?: Stat['kind']) => {
    const c: Record<string, number> = {}
    for (const s of stats) { if (kind && s.kind !== kind) continue; const k = f(s); if (k) c[k] = (c[k] ?? 0) + 1 }
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }
  const intents = count((s) => INTENT_LABEL[s.key] ?? s.key, 'ask')
  const langs = count((s) => (s.lang ? LANG[s.lang] ?? s.lang : undefined))
  const places = count((s) => (s.place ? placeById[s.place]?.name.en.split(':')[0] ?? sculptureById[s.place]?.name.en ?? s.place : s.kind === 'scan' && s.key !== 'unsure' ? sculptureById[s.key]?.name.en : undefined))
  const maxC = complaints[0]?.[1] ?? 1

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="min-w-0 rounded-2xl border border-white/8 bg-night-2 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-white/60"><MessageSquareWarning size={15} />What visitors say</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-[12px] text-white/50">Sentiment by site</div>
            <ul className="space-y-2">{bySite.map(([p, v]) => {
              const t = v.pos + v.neg + v.mix
              return (
                <li key={p}>
                  <div className="flex justify-between text-[12.5px]"><span className="truncate">{placeById[p]?.name.en.split(':')[0] ?? p}</span><span className="num text-white/50">{t}</span></div>
                  <div className="mt-1 flex h-2 overflow-hidden rounded-full">
                    <div style={{ width: `${(v.pos / t) * 100}%`, background: '#2b776e' }} /><div style={{ width: `${(v.mix / t) * 100}%`, background: '#d9a441' }} /><div style={{ width: `${(v.neg / t) * 100}%`, background: '#c0562f' }} />
                  </div>
                </li>
              )
            })}</ul>
          </div>
          <div>
            <div className="mb-2 text-[12px] text-white/50">Top facility complaints</div>
            <div className="space-y-1.5">{complaints.map(([a, n]) => <Bar key={a} label={ASPECT_LABEL[a]?.en ?? a} n={n} max={maxC} color="#c0562f" />)}</div>
          </div>
        </div>
        <ul className="mt-4 max-h-[220px] space-y-2 overflow-y-auto pr-1">
          {reviews.slice().sort((a, b) => b.at - a.at).slice(0, 12).map((r, i) => (
            <li key={i} className="rounded-lg bg-white/5 p-2.5 text-[12.5px]">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.a.sentiment === 'pos' ? 'bg-lake-2' : r.a.sentiment === 'neg' ? 'bg-sand' : 'bg-lamp'}`} />
                <span className="truncate font-semibold">{placeById[r.place]?.name.en.split(':')[0]}</span>
                <span className="text-white/40">{LANG[r.a.lang]}{r.sample ? ' · sample' : ' · live'}</span>
              </div>
              <div className="mt-1 text-white/75">{r.text}</div>
              {r.a.aspects.length > 0 && <div className="mt-1 text-[11px] text-lamp">{r.a.aspects.map((a) => ASPECT_LABEL[a]?.en).join(' · ')}</div>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11.5px] text-white/40">Sentiment and aspects are detected by the review model in any of the three languages. "Sample" reviews are demo seeds; "live" ones come from the app.</p>
      </section>

      <section className="min-w-0 rounded-2xl border border-white/8 bg-night-2 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-white/60"><BarChart3 size={15} />What tourists are asking (this session)</h2>
        {stats.length === 0 ? <p className="rounded-xl bg-white/5 p-3 text-[13px] text-white/60">Use the app on a phone (ask, scan, plan) and the questions, languages and places appear here live. Anonymous counts only.</p> : (
          <div className="space-y-4">
            <div><div className="mb-1.5 text-[12px] text-white/50">Topics</div><div className="space-y-1.5">{intents.map(([k, n]) => <Bar key={k} label={k} n={n} max={intents[0][1]} color="#46e6cb" />)}</div></div>
            <div><div className="mb-1.5 text-[12px] text-white/50">Languages used</div><div className="space-y-1.5">{langs.map(([k, n]) => <Bar key={k} label={k} n={n} max={langs[0][1]} color="#d9a441" />)}</div></div>
            <div><div className="mb-1.5 text-[12px] text-white/50">Places & sculptures of interest</div><div className="space-y-1.5">{places.map(([k, n]) => <Bar key={k} label={k} n={n} max={places[0]?.[1] ?? 1} color="#2b776e" />)}</div></div>
          </div>
        )}
      </section>
    </div>
  )
}
