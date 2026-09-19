import { useState } from 'react'
import { Cctv, EyeOff, Loader2 } from 'lucide-react'
import frames from '../data/cctv.json'
import { publish } from '../lib/live'

type Frame = { file: string; count: number; boxes: number[][]; w: number; h: number; site: string; title: string; artist: string; license: string }
const F = frames as Frame[]
const ZONE_CAPACITY = 40 // people comfortably inside the camera's view (cave forecourt)

/*
  CCTV people counting with privacy by design: frames are blurred on screen and only the count and
  anonymous boxes leave the camera. Counts come from a COCO-pretrained Faster R-CNN (person class)
  on the server; precomputed counts are used when the server is offline.
*/
export default function CctvPanel() {
  const [i, setI] = useState(0)
  const [live, setLive] = useState<{ count: number; boxes: number[][]; w: number; h: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const f = F[i]
  const r = live ?? f
  const ratio = r.count / ZONE_CAPACITY
  const level = ratio >= 0.9 ? 'packed' : ratio >= 0.65 ? 'busy' : ratio >= 0.35 ? 'moderate' : 'low'
  const col = { low: '#2b776e', moderate: '#d9a441', busy: '#c0562f', packed: '#ff5a6e' }[level]

  async function recount() {
    setBusy(true)
    try {
      const blob = await (await fetch(f.file)).blob()
      const fd = new FormData(); fd.append('file', blob, 'frame.jpg')
      const res = await fetch(`/api/crowd/count?capacity=${ZONE_CAPACITY}`, { method: 'POST', body: fd, signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error()
      const j = await res.json(); setLive({ count: j.count, boxes: j.boxes, w: j.width, h: j.height })
    } catch { setLive(null) } finally { setBusy(false) }
  }
  function pick(k: number) { setI(k); setLive(null) }
  function raise() {
    publish({ type: 'crowd', severity: level === 'packed' ? 'critical' : 'warn', source: 'cctv', title: `CCTV ${f.site}: ${r.count} people in view (${Math.round(ratio * 100)}% of zone capacity)`, detail: 'Counted by the person detector; frame never stored or shown unblurred.' })
  }

  return (
    <section className="min-w-0 rounded-2xl border border-white/8 bg-night-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-white/60"><Cctv size={15} />CCTV people counter</h2>
        <span className="inline-flex items-center gap-1 text-[11.5px] text-white/50"><EyeOff size={13} />privacy blur on</span>
      </div>
      <div className="relative overflow-hidden rounded-xl bg-black">
        <img src={f.file} alt="Blurred camera frame" className="block w-full" style={{ filter: 'blur(7px) saturate(0.7)', transform: 'scale(1.03)' }} />
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${r.w} ${r.h}`} preserveAspectRatio="none">
          {r.boxes.map((b, k) => <rect key={k} x={b[0]} y={b[1]} width={b[2] - b[0]} height={b[3] - b[1]} fill="none" stroke={col} strokeWidth={3} rx={4} />)}
        </svg>
        <div className="absolute left-3 top-3 rounded-lg bg-black/60 px-3 py-1.5">
          <div className="num text-[30px] font-bold leading-none" style={{ color: col }}>{r.count}</div>
          <div className="text-[11px] text-white/70">people · {level}</div>
        </div>
        <div className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/70">{f.site} · {f.artist || 'Wikimedia Commons'} · {f.license}</div>
      </div>
      <div className="mt-3 flex items-center gap-2 overflow-x-auto">
        {F.map((x, k) => (
          <button key={x.file} onClick={() => pick(k)} className={`num shrink-0 rounded-lg px-2.5 py-1 text-[12px] ${k === i ? 'bg-lamp text-night' : 'bg-white/8 text-white/70'}`}>Cam {k + 1}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={recount} className="inline-flex items-center gap-1.5 rounded-full bg-lake px-3.5 py-1.5 text-[12.5px] font-semibold">{busy && <Loader2 size={13} className="animate-spin" />}Recount on server</button>
        {ratio >= 0.5 && <button onClick={raise} className="rounded-full border border-white/15 px-3.5 py-1.5 text-[12.5px] font-semibold">Raise crowd alert</button>}
      </div>
      <p className="mt-2 text-[11.5px] text-white/60">Zone capacity {ZONE_CAPACITY}. Detector undercounts tightly packed groups (occlusion); a density-map model is the next step for festival crowds.</p>
    </section>
  )
}
