import { FAQS, PLACES, SCULPTURES } from './data'
import type { Lang } from './i18n'

/*
  Retrieval over the curated knowledge base (the "R" in RAG): character n-gram TF-IDF, so it works
  the same for Kannada, Devanagari and Latin script. Answers are always built from these verified
  passages, so the guide cannot invent history. The server adds multilingual-e5 semantic search.
*/
export type Doc = { id: string; kind: 'place' | 'sculpture' | 'faq'; ref: string; lang: Lang; title: string; text: string }

function grams(s: string) {
  const t = ` ${s.toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ').replace(/\s+/g, ' ')} `
  const a = Array.from(t), out: string[] = []
  for (let n = 3; n <= 4; n++) for (let i = 0; i + n <= a.length; i++) out.push(a.slice(i, i + n).join(''))
  return out
}

const DOCS: Doc[] = []
for (const lang of ['en', 'kn', 'hi'] as Lang[]) {
  for (const p of PLACES) {
    const name = p.name[lang] ?? p.name.en
    DOCS.push({ id: `p:${p.id}:${lang}`, kind: 'place', ref: p.id, lang, title: name, text: `${name} ${name} ${p.summary[lang] ?? p.summary.en} ${p.facts.map((f) => f[lang] ?? f.en).join(' ')} ${p.tags.join(' ')}` })
  }
  for (const s of SCULPTURES) {
    const name = s.name[lang] ?? s.name.en
    DOCS.push({ id: `s:${s.id}:${lang}`, kind: 'sculpture', ref: s.id, lang, title: name, text: `${name} ${name} ${s.deity} ${s.group} ${s.text[lang] ?? s.text.en}` })
  }
  for (const f of FAQS) {
    DOCS.push({ id: `f:${f.id}:${lang}`, kind: 'faq', ref: f.id, lang, title: f.q[lang] ?? f.q.en, text: `${f.q[lang] ?? f.q.en} ${f.q.en} ${f.a[lang] ?? f.a.en} ${f.tags.join(' ')}` })
  }
}

const df = new Map<string, number>()
const vecs = DOCS.map((d) => {
  const tf = new Map<string, number>()
  for (const g of grams(d.text)) tf.set(g, (tf.get(g) ?? 0) + 1)
  tf.forEach((_, g) => df.set(g, (df.get(g) ?? 0) + 1))
  return tf
})
const N = DOCS.length
const idf = (g: string) => Math.log((1 + N) / (1 + (df.get(g) ?? 0))) + 1
const norms = vecs.map((tf) => { let s = 0; tf.forEach((c, g) => { const v = (1 + Math.log(c)) * idf(g); s += v * v }); return Math.sqrt(s) })

export function search(query: string, opts: { lang?: Lang; kind?: Doc['kind']; k?: number } = {}) {
  const q = new Map<string, number>()
  for (const g of grams(query)) q.set(g, (q.get(g) ?? 0) + 1)
  let qn = 0; q.forEach((c, g) => { const v = (1 + Math.log(c)) * idf(g); qn += v * v }); qn = Math.sqrt(qn) || 1
  const res: { doc: Doc; score: number }[] = []
  DOCS.forEach((d, i) => {
    if (opts.kind && d.kind !== opts.kind) return
    let s = 0
    q.forEach((c, g) => { const t = vecs[i].get(g); if (t) s += (1 + Math.log(c)) * (1 + Math.log(t)) * idf(g) ** 2 })
    const score = s / (qn * norms[i])
    if (score > 0) res.push({ doc: d, score })
  })
  res.sort((a, b) => b.score - a.score)
  // one hit per referenced item, preferring the requested language
  const seen = new Set<string>(), out: typeof res = []
  for (const r of res) {
    const key = `${r.doc.kind}:${r.doc.ref}`
    if (seen.has(key)) continue
    seen.add(key); out.push(r)
    if (out.length >= (opts.k ?? 3)) break
  }
  return out
}
