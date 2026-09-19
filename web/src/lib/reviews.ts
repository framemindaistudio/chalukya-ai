/*
  Review analysis on the phone: sentiment (char n-gram logistic regression + a trilingual polarity
  lexicon for "but/ಆದರೆ/लेकिन"-style mixed reviews) and facility aspects (trilingual lexicon).
  Same model as ml/reviews/train_reviews.py; the server adds multilingual-e5 for sentiment.
*/
type Model = { ngram_range: [number, number]; classes: string[]; vocab: Record<string, number>; idf: number[]; coef: number[][]; intercept: number[]
  aspects: string[]; lex: Record<string, string[]>; pos: string[]; neg: string[]; contrast: string[] }

export type Sentiment = 'pos' | 'neg' | 'mix'
export type ReviewAnalysis = { sentiment: Sentiment; confidence: number; aspects: string[]; lang: 'kn' | 'hi' | 'en' }
export const ASPECT_LABEL: Record<string, { en: string; kn: string; hi: string }> = {
  toilets: { en: 'Toilets & cleanliness', kn: 'ಶೌಚಾಲಯ ಮತ್ತು ಸ್ವಚ್ಛತೆ', hi: 'शौचालय और सफ़ाई' },
  water: { en: 'Drinking water', kn: 'ಕುಡಿಯುವ ನೀರು', hi: 'पीने का पानी' },
  parking: { en: 'Parking', kn: 'ಪಾರ್ಕಿಂಗ್', hi: 'पार्किंग' },
  crowd: { en: 'Crowd & queues', kn: 'ಜನಸಂದಣಿ ಮತ್ತು ಸಾಲು', hi: 'भीड़ और कतार' },
  guides: { en: 'Guides & information', kn: 'ಮಾರ್ಗದರ್ಶಿ ಮತ್ತು ಮಾಹಿತಿ', hi: 'गाइड और जानकारी' },
  safety: { en: 'Safety', kn: 'ಸುರಕ್ಷತೆ', hi: 'सुरक्षा' },
  food: { en: 'Food', kn: 'ಊಟ', hi: 'खाना' },
  access: { en: 'Accessibility', kn: 'ಸುಗಮ ಪ್ರವೇಶ', hi: 'सुगमता' },
  heat: { en: 'Heat & shade', kn: 'ಬಿಸಿಲು ಮತ್ತು ನೆರಳು', hi: 'गर्मी और छाया' },
}

let model: Model | null = null, loading: Promise<Model> | null = null
export const loadReviewModel = () => (model ? Promise.resolve(model) : (loading ??= fetch('/models/review_model.json').then((r) => r.json()).then((m: Model) => (model = m))))

function grams(text: string, lo: number, hi: number) {
  const out: string[] = []
  for (const word of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    const c = Array.from(` ${word} `)
    for (let n = lo; n <= hi; n++) {
      let o = 0; out.push(c.slice(o, o + n).join(''))
      while (o + n < c.length) { o++; out.push(c.slice(o, o + n).join('')) }
      if (o === 0) break
    }
  }
  return out
}

export async function analyzeReview(text: string): Promise<ReviewAnalysis> {
  const m = await loadReviewModel()
  const tf = new Map<number, number>()
  for (const g of grams(text, m.ngram_range[0], m.ngram_range[1])) { const j = m.vocab[g]; if (j !== undefined) tf.set(j, (tf.get(j) ?? 0) + 1) }
  let norm = 0; const f: [number, number][] = []
  tf.forEach((c, j) => { const v = (1 + Math.log(c)) * m.idf[j]; f.push([j, v]); norm += v * v })
  norm = Math.sqrt(norm) || 1
  const logit = m.classes.map((_, k) => f.reduce((s, [j, v]) => s + (v / norm) * m.coef[k][j], m.intercept[k]))
  const mx = Math.max(...logit); let p = logit.map((l) => Math.exp(l - mx)); const z = p.reduce((a, b) => a + b, 0); p = p.map((x) => x / z)
  const t = ` ${text.toLowerCase()} `
  const pos = m.pos.filter((k) => t.includes(k)).length, neg = m.neg.filter((k) => t.includes(k)).length, con = m.contrast.some((k) => t.includes(k))
  const pol: Record<string, number> | null = pos && (neg || con) && con ? { mix: 0.8, pos: 0.1, neg: 0.1 } : neg > pos ? { neg: 0.8, mix: 0.1, pos: 0.1 } : pos > neg ? { pos: 0.8, mix: 0.1, neg: 0.1 } : null
  if (pol) p = p.map((x, i) => 0.4 * x + 0.6 * pol[m.classes[i]])
  const i = p.indexOf(Math.max(...p))
  return {
    sentiment: m.classes[i] as Sentiment, confidence: p[i],
    aspects: m.aspects.filter((a) => m.lex[a].some((k) => t.includes(k))),
    lang: /[ಀ-೿]/.test(text) ? 'kn' : /[ऀ-ॿ]/.test(text) ? 'hi' : 'en',
  }
}
