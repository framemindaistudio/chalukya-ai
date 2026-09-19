import lexRaw from '../data/lexicon.json'
import { isStaticHost } from './server'

/*
  On-device language understanding: an exact port of the Python pipeline (ml/assistant):
    1. mask known place names with "#" (they carry no intent signal)
    2. char_wb n-grams (2–4), sublinear TF × IDF, L2-normalised: identical to sklearn's TfidfVectorizer
    3. multinomial logistic regression → probabilities
    4. blended 50/50 with the curated trilingual lexicon
  Evaluated in ml/assistant/out/intent_comparison.json.
*/
type Model = { ngram_range: [number, number]; classes: string[]; vocab: Record<string, number>; idf: number[]; coef: number[][]; intercept: number[] }
const LEXDATA = lexRaw as unknown as { lex: Record<string, string[]>; aliases: Record<string, string[]> }
const FLAT = Object.entries(LEXDATA.aliases).flatMap(([id, al]) => al.map((a) => [a, id] as const)).sort((a, b) => b[0].length - a[0].length)

let model: Model | null = null
let loading: Promise<Model> | null = null
export function loadIntentModel() {
  if (model) return Promise.resolve(model)
  loading ??= fetch('/models/intent_model.json').then((r) => r.json()).then((m: Model) => (model = m))
  return loading
}

export function findPlaces(text: string): string[] {
  let t = text.toLowerCase()
  const found: string[] = []
  for (const [a, id] of FLAT) {
    if (t.includes(a)) { if (!found.includes(id)) found.push(id); t = t.split(a).join(' ') }
  }
  return found
}

export function mask(text: string) {
  let t = text.toLowerCase()
  for (const [a] of FLAT) t = t.split(a).join(' # ')
  return t.split(/\s+/).filter(Boolean).join(' ')
}

function charWb(text: string, lo: number, hi: number): string[] {
  const out: string[] = []
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = ` ${word} `
    const chars = Array.from(w)
    for (let n = lo; n <= hi; n++) {
      let offset = 0
      out.push(chars.slice(offset, offset + n).join(''))
      while (offset + n < chars.length) { offset++; out.push(chars.slice(offset, offset + n).join('')) }
      if (offset === 0) break
    }
  }
  return out
}

function lrProbs(m: Model, masked: string): number[] {
  const tf = new Map<number, number>()
  for (const g of charWb(masked, m.ngram_range[0], m.ngram_range[1])) {
    const j = m.vocab[g]
    if (j !== undefined) tf.set(j, (tf.get(j) ?? 0) + 1)
  }
  const feats: [number, number][] = []
  let norm = 0
  tf.forEach((c, j) => { const v = (1 + Math.log(c)) * m.idf[j]; feats.push([j, v]); norm += v * v })
  norm = Math.sqrt(norm) || 1
  const logits = m.classes.map((_, k) => feats.reduce((s, [j, v]) => s + (v / norm) * m.coef[k][j], m.intercept[k]))
  const mx = Math.max(...logits)
  const e = logits.map((l) => Math.exp(l - mx)); const z = e.reduce((a, b) => a + b, 0)
  return e.map((x) => x / z)
}

function lexProbs(classes: string[], text: string): number[] | null {
  const t = ` ${text.toLowerCase()} `
  const c = classes.map((k) => (LEXDATA.lex[k] ?? []).filter((w) => t.includes(w)).length)
  if (c.every((x) => x === 0)) return null
  const mx = Math.max(...c)
  const e = c.map((x) => Math.exp(3 * (x - mx))); const z = e.reduce((a, b) => a + b, 0)
  return e.map((x) => x / z)
}

export type IntentResult = { intent: string; confidence: number; top: { intent: string; p: number }[]; places: string[]; source?: 'server' | 'phone' }
let serverDown = 0
async function serverIntent(text: string) {
  if (Date.now() - serverDown < 60_000 || (await isStaticHost())) return null
  try {
    const r = await fetch('/api/intent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: text }), signal: AbortSignal.timeout(1500) })
    if (!r.ok) throw new Error()
    return (await r.json()) as { intent: string; confidence: number; top: { intent: string; p: number }[] }
  } catch { serverDown = Date.now(); return null }
}

export async function classify(text: string): Promise<IntentResult> {
  const s = await serverIntent(text)
  if (s) return { ...s, places: findPlaces(text), source: 'server' }
  const m = await loadIntentModel()
  const masked = mask(text)
  const pa = lrProbs(m, masked)
  const pb = lexProbs(m.classes, masked)
  const p = pb ? pa.map((x, i) => 0.5 * x + 0.5 * pb[i]) : pa
  const order = p.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0])
  return {
    intent: m.classes[order[0][1]], confidence: order[0][0],
    top: order.slice(0, 3).map(([v, i]) => ({ intent: m.classes[i], p: v })), places: findPlaces(text), source: 'phone',
  }
}

export function detectLang(text: string): 'kn' | 'hi' | 'en' | null {
  if (/[ಀ-೿]/.test(text)) return 'kn'
  if (/[ऀ-ॿ]/.test(text)) return 'hi'
  return /[a-z]/i.test(text) ? null : null // Latin could be English or romanised Kannada/Hindi: keep the UI language
}
