import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Camera, ChevronDown, ImagePlus, Languages, Loader2, MapPin, ScanText, WifiOff } from 'lucide-react'
import { Card, Eyebrow } from './ui'
import ExplainIn from './ExplainIn'
import { useLang } from '../lib/i18n'
import { readBoard, translate, TRANSLATE_TO, type BoardResult } from '../lib/ocr'
import { fileToImage } from '../lib/vision'
import { placeById, sculptureById } from '../lib/data'
import { track } from '../lib/live'
import samples from '../data/board_samples.json'

const T = {
  take: { en: 'Photograph a board', kn: 'ಫಲಕದ ಫೋಟೋ ತೆಗೆಯಿರಿ', hi: 'बोर्ड की फ़ोटो लें' },
  upload: { en: 'Choose from gallery', kn: 'ಗ್ಯಾಲರಿಯಿಂದ ಆರಿಸಿ', hi: 'गैलरी से चुनें' },
  samples: { en: 'Or try a real ASI board', kn: 'ಅಥವಾ ನಿಜವಾದ ASI ಫಲಕ ಪ್ರಯತ್ನಿಸಿ', hi: 'या असली ASI बोर्ड आज़माएँ' },
  first: { en: 'Opening the reader (first time only)…', kn: 'ಓದುಗವನ್ನು ತೆರೆಯುತ್ತಿದೆ (ಮೊದಲ ಬಾರಿ ಮಾತ್ರ)…', hi: 'रीडर खुल रहा है (सिर्फ़ पहली बार)…' },
  reading: { en: 'Reading the board', kn: 'ಫಲಕ ಓದುತ್ತಿದೆ', hi: 'बोर्ड पढ़ रहा है' },
  found: { en: 'This board is about', kn: 'ಈ ಫಲಕದ ವಿಷಯ', hi: 'यह बोर्ड इसके बारे में है' },
  noMatch: { en: 'I read the board but could not match it to a monument I know. The text is below, and you can translate it.', kn: 'ಫಲಕ ಓದಿದೆ, ಆದರೆ ನನಗೆ ತಿಳಿದ ಸ್ಮಾರಕದೊಂದಿಗೆ ಹೊಂದಿಸಲಾಗಲಿಲ್ಲ. ಪಠ್ಯ ಕೆಳಗಿದೆ; ಅನುವಾದಿಸಬಹುದು.', hi: 'बोर्ड पढ़ लिया, पर किसी जाने-पहचाने स्मारक से मिला नहीं पाया। पाठ नीचे है, अनुवाद कर सकते हैं।' },
  text: { en: 'Text read from the board', kn: 'ಫಲಕದಿಂದ ಓದಿದ ಪಠ್ಯ', hi: 'बोर्ड से पढ़ा गया पाठ' },
  translate: { en: 'Translate the full board', kn: 'ಪೂರ್ಣ ಫಲಕ ಅನುವಾದಿಸಿ', hi: 'पूरा बोर्ड अनुवाद करें' },
  translating: { en: 'Translating…', kn: 'ಅನುವಾದಿಸುತ್ತಿದೆ…', hi: 'अनुवाद हो रहा है…' },
  noServer: { en: 'Full translation runs on the district server (Meta NLLB-200), which is not reachable right now. The explanation above works offline.', kn: 'ಪೂರ್ಣ ಅನುವಾದ ಜಿಲ್ಲಾ ಸರ್ವರ್‌ನಲ್ಲಿ (Meta NLLB-200) ನಡೆಯುತ್ತದೆ; ಈಗ ಸಂಪರ್ಕವಿಲ್ಲ. ಮೇಲಿನ ವಿವರಣೆ ಆಫ್‌ಲೈನ್‌ನಲ್ಲೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ.', hi: 'पूरा अनुवाद ज़िला सर्वर (Meta NLLB-200) पर चलता है, जो अभी उपलब्ध नहीं है। ऊपर की व्याख्या ऑफ़लाइन भी चलती है।' },
  mt: { en: 'Machine translation. Names and dates can be imperfect.', kn: 'ಯಂತ್ರ ಅನುವಾದ. ಹೆಸರು, ದಿನಾಂಕಗಳಲ್ಲಿ ತಪ್ಪಿರಬಹುದು.', hi: 'मशीन अनुवाद। नाम और तारीख़ों में गलती हो सकती है।' },
  where: { en: 'Open', kn: 'ತೆರೆಯಿರಿ', hi: 'खोलें' },
}
const SAMPLES = Object.entries(samples as Record<string, { artist: string; license: string; page: string }>)

export default function BoardReader() {
  const { lang, L } = useLang()
  const cam = useRef<HTMLInputElement>(null), gal = useRef<HTMLInputElement>(null)
  const [img, setImg] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'reading' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [res, setRes] = useState<BoardResult | null>(null)
  const [credit, setCredit] = useState<string | null>(null)
  const [showText, setShowText] = useState(false)
  const [tx, setTx] = useState<{ to: string; text: string | null | 'busy'; partial?: boolean } | null>(null)

  async function run(src: string, im: Promise<HTMLImageElement>, creditLine: string | null) {
    setImg(src); setRes(null); setTx(null); setShowText(false); setCredit(creditLine)
    setState('reading'); setProgress(0)
    try {
      const r = await readBoard(await im, setProgress)
      setRes(r); setState('done')
      track({ kind: 'scan', key: r.match ? r.match.id : 'board_unmatched', lang })
    } catch (e) { console.error(e); setState('error') }
  }
  const onFile = (f?: File) => { if (f) run(URL.createObjectURL(f), fileToImage(f), null) }
  const onSample = (key: string) => {
    const src = `/img/boards/${key}.jpg`, s = (samples as Record<string, { artist: string; license: string }>)[key]
    const im = new Image(); const p = new Promise<HTMLImageElement>((ok, no) => { im.onload = () => ok(im); im.onerror = no })
    im.src = src
    run(src, p, `Photo: ${s.artist}, ${s.license}, via Wikimedia Commons`)
  }
  const [secs, setSecs] = useState(0)
  const started = useRef(0)
  const translating = tx?.text === 'busy' || !!tx?.partial
  useEffect(() => {
    if (!translating) return
    const t = setInterval(() => setSecs(Math.round((Date.now() - started.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [translating])
  async function doTranslate(to: string) {
    if (!res) return
    started.current = Date.now(); setSecs(0)
    setTx({ to, text: 'busy' })
    const full = await translate(res.text, to, (soFar) => setTx({ to, text: soFar, partial: true }))
    setTx({ to, text: full })
  }

  const m = res?.match
  const sc = m?.kind === 'sculpture' ? sculptureById[m.id] : null
  const pl = m?.kind === 'place' ? placeById[m.id] : sc ? placeById[sc.place] : null
  const title = sc ? sc.name : pl?.name
  const body = sc ? sc.text : pl?.summary

  return (
    <div className="space-y-4">
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={gal} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      <Card className="overflow-hidden">
        <div className="relative aspect-[4/3] w-full bg-night">
          {img ? <img src={img} alt="Board photo" className="h-full w-full object-contain" /> : (
            <div className="grid h-full place-items-center text-white/60">
              <svg viewBox="0 0 120 90" className="w-40" aria-hidden><path d="M10 25V10h15M95 10h15v15M110 65v15H95M25 80H10V65" stroke="#46e6cb" strokeWidth="3" fill="none" /><rect x="34" y="18" width="52" height="54" rx="3" fill="none" stroke="#ffffff66" strokeWidth="1.6" /><path d="M42 30h36M42 38h30M42 46h36M42 54h24M42 62h32" stroke="#ffffff55" strokeWidth="2.4" strokeLinecap="round" /></svg>
            </div>
          )}
          {state === 'reading' && (
            <div className="absolute inset-0 grid place-items-center bg-night/60 text-white">
              <div className="w-[70%] text-center">
                <div className="flex items-center justify-center gap-2 text-[15px] font-semibold"><Loader2 className="animate-spin" size={18} />{progress > 0 ? L(T.reading) : L(T.first)}</div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-lamp transition-[width] duration-300" style={{ width: `${Math.max(4, progress * 100)}%` }} /></div>
                <div className="num mt-1.5 text-[12px] text-white/70">{Math.round(progress * 100)}%</div>
              </div>
            </div>
          )}
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[12px] font-semibold text-white"><WifiOff size={13} /> On-device OCR</div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          <button onClick={() => cam.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-lake py-3 text-[15px] font-semibold text-white"><Camera size={18} />{L(T.take)}</button>
          <button onClick={() => gal.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-line py-3 text-[15px] font-semibold text-ink"><ImagePlus size={18} />{L(T.upload)}</button>
        </div>
        <div className="border-t border-line px-3 pb-3 pt-2.5">
          <div className="text-[12.5px] font-semibold text-ink-2">{L(T.samples)}</div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {SAMPLES.map(([k]) => (
              <button key={k} onClick={() => onSample(k)} disabled={state === 'reading'} className="shrink-0 overflow-hidden rounded-lg border border-line disabled:opacity-50" aria-label={`Sample board: ${k.replace('board_', '')}`}>
                <img src={`/img/boards/${k}.jpg`} alt="" className="h-20 w-[60px] object-cover" loading="lazy" />
              </button>
            ))}
          </div>
          {credit && <div className="mt-1 text-[11px] text-ink-3">{credit}</div>}
        </div>
      </Card>

      {state === 'error' && <Card className="p-4 text-[14.5px] text-sand">The reader could not run in this browser. Try Chrome, or ask the guide instead.</Card>}

      {state === 'done' && res && (
        <Card className="rise p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {res.scripts.map((s) => <span key={s} className="rounded-full bg-lake-soft px-2.5 py-0.5 text-[12px] font-semibold text-lake">{s}</span>)}
            <span className="num ml-auto text-[11.5px] text-ink-3">{(res.ms / 1000).toFixed(1)} s · Tesseract LSTM</span>
          </div>
          {title && body ? (
            <>
              <Eyebrow className="mt-3">{L(T.found)}</Eyebrow>
              <h2 className="display mt-1 text-[26px] leading-[1.1]">{L(title)}</h2>
              <p className="mt-2 text-[16px] leading-relaxed">{L(body)}</p>
              <ExplainIn className="mt-4" title={title} body={[body]} />
              {pl && <Link to={`/place/${pl.id}`} className="mt-3 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[14px] font-semibold"><MapPin size={16} className="text-lake" />{L(T.where)}: {L(pl.name)}</Link>}
            </>
          ) : <p className="mt-3 text-[15px] text-ink-2">{L(T.noMatch)}</p>}

          <div className="mt-4 border-t border-line pt-3">
            <div className="flex items-center gap-2 text-[14px] font-semibold"><Languages size={16} className="text-lake" />{L(T.translate)}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TRANSLATE_TO.map((t) => (
                <button key={t.code} onClick={() => doTranslate(t.code)} disabled={translating}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${tx?.to === t.code ? 'bg-lake text-white' : 'border border-line text-ink'} disabled:opacity-60`}>{t.label}</button>
              ))}
            </div>
            {tx?.text === 'busy' && <div className="mt-3 flex items-center gap-2 text-[14px] text-ink-2"><Loader2 size={15} className="animate-spin" />{L(T.translating)} <span className="num">{secs}s</span></div>}
            {tx && tx.text === null && <p className="mt-3 rounded-xl bg-sand-soft p-3 text-[13.5px] text-ink">{L(T.noServer)}</p>}
            {tx && typeof tx.text === 'string' && tx.text !== 'busy' && (
              <div className="rise mt-3 rounded-xl bg-mist p-3">
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{tx.text}</p>
                {tx.partial ? <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-3"><Loader2 size={12} className="animate-spin" />{L(T.translating)} <span className="num">{secs}s</span></p>
                  : <p className="mt-2 text-[11.5px] text-ink-3">{L(T.mt)} · NLLB-200 (int8)</p>}
              </div>
            )}
          </div>

          <div className="mt-3 border-t border-line pt-3">
            <button onClick={() => setShowText((v) => !v)} className="flex w-full items-center justify-between text-[14px] font-semibold text-ink-2" aria-expanded={showText}>
              <span className="inline-flex items-center gap-2"><ScanText size={16} />{L(T.text)}</span>
              <span className="inline-flex items-center gap-1 text-[12px] font-normal"><span className="num">{Math.round(res.confidence)}%</span><ChevronDown size={16} className={showText ? 'rotate-180' : ''} /></span>
            </button>
            {showText && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-mist p-3 font-sans text-[13.5px] leading-relaxed">{res.text}</pre>}
          </div>
        </Card>
      )}
    </div>
  )
}
