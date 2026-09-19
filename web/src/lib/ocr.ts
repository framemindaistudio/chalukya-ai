import { createWorker, type Worker } from 'tesseract.js'
import { search } from './retrieval'
import { findPlaces } from './intent'
import { PLACES, SCULPTURES, placeById, sculptureById } from './data'
import { isStaticHost } from './server'

/*
  Heritage board reader.
  1. OCR on the phone (Tesseract LSTM, Kannada + Devanagari + Latin), hosted locally so it works offline.
  2. Grounding: the recognised text is matched against the verified knowledge base (place aliases +
     character n-gram retrieval, which works across scripts), so the tourist gets the monument's
     explanation in their language even with no network.
  3. Full translation of the board text (Meta NLLB-200 on the laptop server) when it is reachable.
*/
let worker: Promise<Worker> | null = null
// The worker is created once (possibly by the pre-load, with no listener), so progress goes to
// whoever is reading right now rather than to the callback captured at creation.
let progressTo: ((p: number) => void) | undefined
export function ocrWorker(onProgress?: (p: number) => void) {
  if (onProgress) progressTo = onProgress
  worker ??= createWorker(['kan', 'hin', 'eng'], 1, {
    workerPath: '/tess/worker.min.js', corePath: '/tess/core', langPath: '/tess/lang', gzip: true,
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') progressTo?.(m.progress) },
  })
  return worker
}

export type BoardResult = { text: string; confidence: number; ms: number; scripts: string[]; match: { kind: 'place' | 'sculpture'; id: string; score: number } | null }

export async function readBoard(img: HTMLImageElement | HTMLCanvasElement, onProgress?: (p: number) => void): Promise<BoardResult> {
  const t0 = performance.now()
  // Downscale very large photos: faster OCR, same accuracy for board-sized text
  const maxSide = 1700, s = Math.min(1, maxSide / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  const w = await ocrWorker(onProgress)
  const { data } = await w.recognize(c)
  const text = data.text.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
  const scripts = [/[ಀ-೿]/.test(text) && 'Kannada', /[ऀ-ॿ]/.test(text) && 'Hindi', /[A-Za-z]{3}/.test(text) && 'English'].filter(Boolean) as string[]
  // Grounding: 1) the board's title usually names the temple, in any of the three scripts;
  // 2) otherwise character n-gram retrieval over the knowledge base; 3) otherwise a named town.
  let match: BoardResult['match'] = null
  const byName = nameMatch(text)
  const hits = [...search(text.slice(0, 1500), { kind: 'sculpture', k: 1 }), ...search(text.slice(0, 1500), { kind: 'place', k: 1 })].sort((a, b) => b.score - a.score)
  const named = findPlaces(text).find((id) => placeById[id] || id === 'badami')
  if (byName) match = byName
  else if (hits[0] && hits[0].score > 0.12) match = { kind: hits[0].doc.kind === 'sculpture' ? 'sculpture' : 'place', id: hits[0].doc.ref, score: hits[0].score }
  else if (named) match = { kind: 'place', id: named === 'badami' ? 'badami_caves' : named, score: 0.5 }
  return { text, confidence: data.confidence, ms: Math.round(performance.now() - t0), scripts, match }
}

// First words that are ordinary vocabulary, not names ("North Fort", "Archaeological Museum")
const GENERIC = new Set(['north', 'ಉತ್ತರ', 'उत्तरी', 'ಪುರಾತತ್ವ', 'पुरातत्व', 'temple', 'temples'])
/** Distinctive first word of every sculpture/temple/place name, in en/kn/hi, counted in the OCR text. */
const NAME_KEYS = [
  ...SCULPTURES.map((x) => ({ kind: 'sculpture' as const, id: x.id, names: [x.name.en, x.name.kn, x.name.hi] })),
  ...PLACES.map((x) => ({ kind: 'place' as const, id: x.id, names: [x.name.en, x.name.kn, x.name.hi] })),
].map((e) => ({ ...e, keys: e.names.filter(Boolean).map((n) => n!.split(/[\s:(,]/)[0].toLowerCase()).filter((k) => Array.from(k).length >= 5 && !GENERIC.has(k)) }))
function nameMatch(text: string): BoardResult['match'] {
  // Boards put the monument's name in a short heading line in each script; the body text mentions
  // other sculptures and towns in passing. A name found on a heading line counts three times.
  const lines = text.toLowerCase().split('\n').map((l) => ({ l, w: l.split(/\s+/).filter((x) => /[\p{L}\p{M}]{3,}/u.test(x)).length <= 4 ? 3 : 1 }))
  let best: BoardResult['match'] = null, bestN = 0
  const perSite: Record<string, number> = {}
  for (const e of NAME_KEYS) {
    // a named temple or sculpture is more specific than the town it stands in
    const n = e.keys.reduce((s, k) => s + lines.reduce((a, { l, w }) => a + (l.split(k).length - 1) * w, 0), 0) * (e.kind === 'sculpture' ? 1.5 : 1)
    if (n > 0 && e.kind === 'sculpture') { const p = sculptureById[e.id]?.place; if (p) perSite[p] = (perSite[p] ?? 0) + 1 }
    if (n > bestN || (n === bestN && n > 0 && e.kind === 'sculpture' && best?.kind === 'place')) { best = { kind: e.kind, id: e.id, score: Math.min(1, n / 3) }; bestN = n }
  }
  // A board that names three or more temples of one site is that site's overview board
  const site = Object.entries(perSite).find(([, c]) => c >= 3)?.[0]
  if (site && placeById[site]) return { kind: 'place', id: site, score: 1 }
  return bestN > 0 ? best : null
}

export const TRANSLATE_TO = [
  { code: 'en', nllb: 'eng_Latn', label: 'English' }, { code: 'kn', nllb: 'kan_Knda', label: 'ಕನ್ನಡ' }, { code: 'hi', nllb: 'hin_Deva', label: 'हिन्दी' },
  { code: 'mr', nllb: 'mar_Deva', label: 'मराठी' }, { code: 'te', nllb: 'tel_Telu', label: 'తెలుగు' }, { code: 'ta', nllb: 'tam_Taml', label: 'தமிழ்' },
]

/** Streams the translation sentence by sentence (NDJSON), so the first lines show within seconds. */
export async function translate(text: string, to: string, onSentence?: (soFar: string) => void): Promise<string | null> {
  if (await isStaticHost()) return null  // translation runs on the district server; say so at once
  try {
    const r = await fetch('/api/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 4000), to, stream: true }), signal: AbortSignal.timeout(150000) })
    if (!r.ok || !r.body) return null
    const reader = r.body.getReader(), dec = new TextDecoder()
    let buf = '', out: string[] = []
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1)
        if (!line.trim()) continue
        const m = JSON.parse(line)
        if (m.s) { out = [...out, m.s]; onSentence?.(out.join(' ')) }
      }
    }
    return out.join(' ')
  } catch { return null }
}
