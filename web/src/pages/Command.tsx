import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, AlertTriangle, ArrowLeft, Bell, CarFront, CheckCircle2, Clock, CloudSun, Cpu, Droplets, Flame, Radio, Siren, Trash2, Users, Wifi, WifiOff } from 'lucide-react'
import MapView from '../components/MapView'
import CctvPanel from '../components/CctvPanel'
import DeptInsights from '../components/DeptInsights'
import { LangSwitch } from '../components/Shell'
import { FOOTFALL, PARKING, placeById } from '../lib/data'
import { crowdNow, dayForecast, LEVEL_COLOR, levelOf, capacityOf } from '../lib/crowd'
import { lotStatus, LOT_IDS, predictFree, setLiveOccupancy } from '../lib/parking'
import { useNow, setDemoClock, isDemoClock, ymd, hourLabel } from '../lib/clock'
import { publish, serverConnected, useAlerts, type Alert } from '../lib/live'
import { heatAdvice, useWeather } from '../lib/weather'
import { ZONES } from '../lib/safety'
import { useLang } from '../lib/i18n'

const SITES = ['badami_caves', 'pattadakal', 'aihole', 'banashankari', 'mahakuta', 'kudalasangama']
// Planning coefficients (editable assumptions, shown on screen)
const WATER_L = 4, WASTE_KG = 0.12, PER_TOILET = 60, PER_GUIDE = 150

function Panel({ title, icon, children, className = '', right }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-white/8 bg-night-2 p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-white/60">{icon}{title}</h2>{right}
      </div>
      {children}
    </section>
  )
}
function Kpi({ label, value, sub, tone = 'text-white' }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-night-2 px-4 py-3">
      <div className="text-[12px] text-white/55">{label}</div>
      <div className={`num mt-0.5 text-[30px] font-bold leading-none ${tone}`}>{value}</div>
      {sub && <div className="mt-1 text-[11.5px] text-white/45">{sub}</div>}
    </div>
  )
}

const SEV: Record<Alert['severity'], string> = { critical: 'bg-sos text-white', warn: 'bg-sand text-white', info: 'bg-white/10 text-white/80' }

export default function Command() {
  const { L } = useLang()
  const at = useNow(10_000)
  const w = useWeather()
  const [alerts, setAlerts] = useAlerts(60)
  const [site, setSite] = useState('badami_caves')
  const [stuck, setStuck] = useState<string | null>(null)
  const raised = useRef(new Set<string>())

  // Model-driven alerts: overcrowding (forecast) and lot-full (parking model), raised once per hour
  useEffect(() => {
    const hourKey = `${ymd(at)}-${at.getHours()}`
    for (const s of SITES) {
      const c = crowdNow(s, at)
      if (c && (c.level === 'packed' || c.level === 'busy') && !raised.current.has(`crowd-${s}-${hourKey}`)) {
        raised.current.add(`crowd-${s}-${hourKey}`)
        publish({ type: 'crowd', severity: c.level === 'packed' ? 'critical' : 'warn', source: 'model', place: s, lat: placeById[s].lat, lng: placeById[s].lng,
          title: `${c.level === 'packed' ? 'Over capacity' : 'Crowding'} at ${placeById[s].name.en}: ~${c.present} on site (capacity ${c.capacity})`, detail: 'Consider staggering entry, deploying Pravasi Mitras, and nudging visitors to quieter sites via the app.' })
      }
    }
    for (const l of LOT_IDS) {
      const f = predictFree(l, at, 60)
      if (f <= 2 && !raised.current.has(`lot-${l}-${hourKey}`)) {
        raised.current.add(`lot-${l}-${hourKey}`)
        publish({ type: 'parking', severity: 'warn', source: 'model', lat: PARKING.lots[l].lat, lng: PARKING.lots[l].lng, title: `${PARKING.lots[l].name} predicted full within 1 hour`, detail: 'App is redirecting new arrivals to the next lot.' })
      }
    }
    if (w && heatAdvice(w.feelsC).level === 'extreme' && !raised.current.has(`heat-${hourKey}`)) {
      raised.current.add(`heat-${hourKey}`)
      publish({ type: 'heat', severity: 'warn', source: 'model', title: `Heat alert: feels like ${w.feelsC}°C`, detail: 'Heat advisory pushed to tourists at stair-heavy sites.' })
    }
  }, [at, w])

  // IoT anomaly detection: a sensor whose reading departs from the model's expectation for 3+ reports
  useEffect(() => {
    if (!stuck) return
    setLiveOccupancy(stuck, 0)
    const id = setInterval(() => setLiveOccupancy(stuck, 0), 60_000)
    const t = setTimeout(() => publish({ type: 'sensor', severity: 'warn', source: 'iot', lat: PARKING.lots[stuck].lat, lng: PARKING.lots[stuck].lng,
      title: `Sensor anomaly: ${PARKING.lots[stuck].name} reports 0 cars for 30 min`, detail: 'Residual vs expected occupancy > 3σ on 3 consecutive reports. Likely sensor fault; field check scheduled. Predictions fall back to the forecast.' }), 1200)
    return () => { clearInterval(id); clearTimeout(t) }
  }, [stuck])

  const today = SITES.map((s) => ({ s, f: dayForecast(s, at), c: crowdNow(s, at), cap: capacityOf(s) }))
  const expected = today.reduce((a, x) => a + (x.f?.p50 ?? 0), 0)
  const onSite = today.reduce((a, x) => a + (x.c?.present ?? 0), 0)
  const lots = LOT_IDS.map((id) => lotStatus(id, at))
  const freeSlots = lots.reduce((a, l) => a + l.free, 0), capSlots = lots.reduce((a, l) => a + l.capacity, 0)
  const critical = alerts.filter((a) => a.severity === 'critical' && !a.ack).length

  const chart = useMemo(() => {
    const s = FOOTFALL.sites[site]
    const recent = s.recent.slice(-21).map((r) => ({ d: r.d.slice(5), actual: r.v }))
    const fc = s.forecast.slice(0, 30).map((f) => ({ d: f.d.slice(5), p50: f.p50, band: [f.p10, f.p90] as [number, number], tag: f.tag }))
    return [...recent, ...fc]
  }, [site])
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(at); d.setDate(at.getDate() + i)
    const tot = SITES.reduce((a, s) => a + (dayForecast(s, d)?.p50 ?? 0), 0)
    const peak = SITES.reduce((a, s) => a + Math.max(...(dayForecast(s, d)?.hourly ?? [0])), 0) // sum of each site's own peak
    return { d, tot, peak, tag: dayForecast('badami_caves', d)?.tag ?? dayForecast('banashankari', d)?.tag }
  }), [at])

  function ack(a: Alert) {
    setAlerts((l) => l.map((x) => (x.id === a.id ? { ...x, ack: true } : x)))
    publish({ ...a, ack: true, title: a.title })
  }
  const scenario = (k: string) => {
    if (k === 'rush') setDemoClock('2026-10-20T11:15')          // Dasara (Vijayadashami) late morning
    if (k === 'jatre') setDemoClock('2026-11-22T11:00')         // World Heritage Week Sunday
    if (k === 'normal') setDemoClock(null)
    if (k === 'heat') publish({ type: 'heat', severity: 'critical', source: 'model', title: 'Heatwave drill: feels like 43°C at Badami caves', detail: 'Stair climbs discouraged 11 AM–4 PM; water points alerted.' })
    if (k === 'sensor') setStuck('p_badami_caves')
    if (k === 'sos') publish({ type: 'sos', severity: 'critical', source: 'tourist', place: 'badami_fort', lat: 15.9236, lng: 75.6829, title: 'SOS near North Fort & Shivalayas (drill)', detail: 'GPS · language: kn · elderly visitor, possible fall' })
    if (k === 'geofence') publish({ type: 'geofence', severity: 'warn', source: 'tourist', lat: ZONES[1].lat, lng: ZONES[1].lng, title: 'Visitor entered caution zone: Agastya Lake ghats', detail: ZONES[1].en })
  }

  const pins = [
    ...today.filter((x) => placeById[x.s]).map((x) => ({ id: x.s, lat: placeById[x.s].lat, lng: placeById[x.s].lng, label: `${placeById[x.s].name.en}: ${x.c ? `${x.c.present} on site` : 'closed'}`, color: x.c ? LEVEL_COLOR[x.c.level] : '#6b7a74', radius: 12 })),
    ...lots.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, label: `${l.name}: ${l.free}/${l.capacity} free`, color: l.ratio > 0.9 ? '#c0562f' : '#d9a441', radius: 6 })),
    ...alerts.filter((a) => a.lat && !a.ack && a.severity !== 'info').slice(0, 8).map((a) => ({ id: a.id, lat: a.lat!, lng: a.lng!, label: a.title, color: '#d7263d', radius: 9 })),
  ]

  return (
    <div className="min-h-dvh bg-night text-white">
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-night/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-white/8" aria-label="Back to tourist app"><ArrowLeft size={18} /></Link>
          <div>
            <div className="text-[20px] font-bold leading-none tracking-[-0.02em] text-lamp"><span className="brand font-normal">ಚಾಲುಕ್ಯ</span> AI · Command Centre</div>
            <div className="mt-0.5 text-[12px] text-white/50">Bagalkot District Tourism · live operations</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px] sm:gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${serverConnected() ? 'bg-lake/40 text-white' : 'bg-white/8 text-white/60'}`}>{serverConnected() ? <Wifi size={14} /> : <WifiOff size={14} />}{serverConnected() ? 'Server link' : 'Local link'}</span>
          <span className="num inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1"><Clock size={14} />{at.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{isDemoClock() && <b className="text-lamp">DEMO</b>}</span>
          <LangSwitch dark />
        </div>
      </header>

      <main className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Visitors expected today" value={expected.toLocaleString('en-IN')} sub="6 sites · LightGBM forecast" />
          <Kpi label="On site right now" value={onSite.toLocaleString('en-IN')} sub={today.some((x) => x.c) ? 'hourly model estimate' : 'sites closed'} />
          <Kpi label="Parking free" value={`${freeSlots}/${capSlots}`} sub="6 lots · live sensors" tone={freeSlots / capSlots < 0.15 ? 'text-sand' : 'text-white'} />
          <Kpi label="Open critical alerts" value={String(critical)} sub={`${alerts.length} events this session`} tone={critical ? 'text-[#ff6b7d]' : 'text-white'} />
          <Kpi label="Feels like" value={w ? `${w.feelsC}°C` : '—'} sub={w ? (w.live ? 'Open-Meteo live' : 'climate normal') : ''} tone={w && w.feelsC >= 36 ? 'text-sand' : 'text-white'} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Panel title="Live map" icon={<Radio size={15} />}>
            <MapView pins={pins} height={360} dark />
            <div className="mt-2 flex flex-wrap gap-3 text-[11.5px] text-white/55">
              {(['low', 'moderate', 'busy', 'packed'] as const).map((l) => <span key={l} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLOR[l] }} />{l}</span>)}
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-lamp" />parking</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sos" />alert</span>
            </div>
          </Panel>

          <Panel title="Alerts" icon={<Bell size={15} />} right={<span className="num text-[12px] text-white/50">{alerts.length}</span>}>
            <ul className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {alerts.length === 0 && <li className="rounded-xl bg-white/5 p-3 text-[13.5px] text-white/60">No alerts yet. Press SOS on a phone, or run a scenario below.</li>}
              {alerts.map((a) => (
                <li key={a.id} className={`rounded-xl border p-3 ${a.ack ? 'border-white/5 bg-white/[0.03] opacity-70' : 'border-white/10 bg-white/5'}`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase ${SEV[a.severity]}`}>{a.type}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold leading-snug">{a.title}</div>
                      {a.detail && <div className="mt-0.5 text-[12.5px] text-white/55">{a.detail}</div>}
                      <div className="num mt-1 text-[11px] text-white/40">{new Date(a.at).toLocaleTimeString('en-IN')} · {a.source}</div>
                    </div>
                    {!a.ack && a.severity !== 'info' && a.type !== 'review' && <button onClick={() => ack(a)} className="shrink-0 rounded-full bg-lake px-3 py-1 text-[12px] font-semibold">Respond</button>}
                    {a.ack && <CheckCircle2 size={16} className="shrink-0 text-lake-soft" />}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
          <Panel title="Sites now vs carrying capacity" icon={<Users size={15} />}>
            <ul className="space-y-3">
              {today.map((x) => {
                const peak = x.f ? Math.max(...x.f.hourly) : 0
                const lvl = x.c?.level ?? (x.f ? levelOf(peak, x.cap) : 'low')
                return (
                  <li key={x.s}>
                    <button onClick={() => setSite(x.s)} className={`w-full rounded-xl p-2 text-left ${site === x.s ? 'bg-white/8' : ''}`}>
                      <div className="flex items-baseline justify-between text-[14px]"><span className="font-semibold">{L(placeById[x.s].name).split(':')[0]}</span><span className="num text-white/60">{x.c ? `${x.c.present}` : '—'} / {x.cap} · peak {peak} at {x.f ? hourLabel(6 + x.f.hourly.indexOf(peak)) : '—'}</span></div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full" style={{ width: `${Math.min(100, ((x.c?.present ?? 0) / x.cap) * 100)}%`, background: LEVEL_COLOR[lvl] }} /></div>
                      <div className="mt-1 flex justify-between text-[11.5px] text-white/45"><span>{x.f?.p50.toLocaleString('en-IN')} expected today{x.f?.tag ? ` · ${x.f.tag}` : ''}</span><span>{FOOTFALL.sites[x.s].calibrated_to_asi ? 'ASI-calibrated' : 'estimated scale'}</span></div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel title={`Footfall forecast · ${placeById[site].name.en}`} icon={<Activity size={15} />}>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ left: -8, right: 8, top: 8 }}>
                  <CartesianGrid stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="d" tick={{ fill: '#ffffff80', fontSize: 11 }} interval={5} />
                  <YAxis tick={{ fill: '#ffffff80', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#16241f', border: '1px solid #ffffff20', borderRadius: 12 }} labelStyle={{ color: '#fff' }} formatter={(v: any, n) => [Array.isArray(v) ? `${v[0]}–${v[1]}` : v, n === 'band' ? 'P10–P90' : n === 'p50' ? 'forecast' : 'actual']} />
                  <Area dataKey="band" stroke="none" fill="#2b776e" fillOpacity={0.35} isAnimationActive={false} />
                  <Line dataKey="actual" stroke="#ffffff" strokeWidth={1.6} dot={false} isAnimationActive={false} connectNulls={false} />
                  <Line dataKey="p50" stroke="#d9a441" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <ReferenceLine x={ymd(at).slice(5)} stroke="#ffffff50" strokeDasharray="3 3" label={{ value: 'today', fill: '#ffffff90', fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[12px] text-white/50">White: recent daily visitors. Gold: forecast with calibrated 80% band. Festivals and school holidays are model inputs.</p>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Panel title="Resource planning · next 7 days" icon={<Droplets size={15} />}>
            <div className="overflow-x-auto">
              <table className="num w-full min-w-[520px] text-[13px]">
                <thead><tr className="text-left text-white/50"><th className="pb-2 font-medium">Day</th><th className="font-medium">Visitors</th><th className="font-medium"><Droplets size={12} className="inline" /> Water</th><th className="font-medium"><Trash2 size={12} className="inline" /> Waste</th><th className="font-medium">Toilets at peak</th><th className="font-medium">Guides</th></tr></thead>
                <tbody>{week.map((x) => (
                  <tr key={+x.d} className="border-t border-white/8">
                    <td className="py-2">{x.d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}{x.tag && <span className="ml-1.5 rounded bg-lamp/20 px-1 text-[10.5px] text-lamp">{x.tag}</span>}</td>
                    <td className="font-semibold">{x.tot.toLocaleString('en-IN')}</td>
                    <td>{Math.round((x.tot * WATER_L) / 100) / 10} kL</td><td>{Math.round(x.tot * WASTE_KG)} kg</td>
                    <td>{Math.ceil(x.peak / PER_TOILET)}</td><td>{Math.ceil(x.peak / PER_GUIDE)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="mt-2 text-[11.5px] text-white/45">Assumptions (editable per site): {WATER_L} L water and {WASTE_KG} kg waste per visitor; one toilet seat per {PER_TOILET} people on site; one Pravasi Mitra per {PER_GUIDE}.</p>
          </Panel>

          <Panel title="IoT devices" icon={<Cpu size={15} />}>
            <ul className="space-y-1.5 text-[13px]">
              {lots.map((l) => (
                <li key={l.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                  <span className="flex items-center gap-2"><CarFront size={14} className="text-lamp" />{l.name}</span>
                  <span className="num flex items-center gap-2 text-white/60">{l.occupied}/{l.capacity}<span className={`h-2 w-2 rounded-full ${stuck === l.id ? 'bg-sand' : 'bg-lake-2'}`} /></span>
                </li>
              ))}
              {[['Safety node · Cave steps', 'PIR + DHT22 + buzzer'], ['Safety node · Agastya ghats', 'PIR + ultrasonic'], ['CCTV · Cave 1 entrance', 'people counter']].map(([n, d]) => (
                <li key={n} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"><span className="flex items-center gap-2"><Radio size={14} className="text-lamp" />{n}</span><span className="text-[11.5px] text-white/45">{d}</span></li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] text-white/45">No hardware attached: nodes replay the simulated sensor stream. ESP32 firmware in /iot posts to /api/iot.</p>
          </Panel>
        </div>

        <DeptInsights />

        <div className="grid gap-4 lg:grid-cols-2"><CctvPanel /><div className="hidden lg:block" /></div>

        <Panel title="Scenario simulator (demo)" icon={<Flame size={15} />}>
          <div className="flex flex-wrap gap-2">
            {[['rush', 'Dasara rush 11 AM', AlertTriangle], ['jatre', 'World Heritage Week Sunday', Users], ['normal', 'Back to real time', Clock], ['sos', 'Tourist SOS drill', Siren], ['geofence', 'Geofence breach', AlertTriangle], ['heat', 'Heatwave', CloudSun], ['sensor', 'Sensor failure', Cpu]].map(([k, label, Icon]: any) => (
              <button key={k} onClick={() => scenario(k)} className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3.5 py-2 text-[13px] font-semibold hover:bg-white/10"><Icon size={14} className="text-lamp" />{label}</button>
            ))}
          </div>
        </Panel>
      </main>
    </div>
  )
}
