import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Camera, ImagePlus, Loader2, MapPin, RotateCcw, WifiOff, HelpCircle } from 'lucide-react'
import { Card, Eyebrow, PageHead } from '../components/ui'
import { useLang } from '../lib/i18n'
import { classify, fileToImage, loadVision, type VisionResult } from '../lib/vision'
import { placeById, sculptureById } from '../lib/data'
import { stopSpeaking } from '../lib/speech'
import { publish } from '../lib/live'
import ExplainIn from '../components/ExplainIn'

const T = {
  title: { en: 'What am I looking at?', kn: 'ನಾನು ಏನನ್ನು ನೋಡುತ್ತಿದ್ದೇನೆ?', hi: 'मैं क्या देख रहा हूँ?' },
  sub: { en: 'Photograph a sculpture or temple. The AI runs on this phone, even inside the caves with no signal.', kn: 'ಶಿಲ್ಪ ಅಥವಾ ದೇವಾಲಯದ ಫೋಟೋ ತೆಗೆಯಿರಿ. AI ಈ ಫೋನ್‌ನಲ್ಲೇ ಕೆಲಸ ಮಾಡುತ್ತದೆ; ಸಿಗ್ನಲ್ ಇಲ್ಲದ ಗುಹೆಯೊಳಗೂ.', hi: 'मूर्ति या मंदिर की फ़ोटो लीजिए। AI इसी फ़ोन पर चलता है, बिना सिग्नल वाली गुफा में भी।' },
  take: { en: 'Take photo', kn: 'ಫೋಟೋ ತೆಗೆಯಿರಿ', hi: 'फ़ोटो लें' },
  upload: { en: 'Choose from gallery', kn: 'ಗ್ಯಾಲರಿಯಿಂದ ಆರಿಸಿ', hi: 'गैलरी से चुनें' },
  loading: { en: 'Loading the on-device model…', kn: 'ಫೋನ್‌ನಲ್ಲಿರುವ ಮಾದರಿಯನ್ನು ತೆರೆಯುತ್ತಿದೆ…', hi: 'फ़ोन पर मॉडल लोड हो रहा है…' },
  thinking: { en: 'Recognising…', kn: 'ಗುರುತಿಸುತ್ತಿದೆ…', hi: 'पहचान रहा है…' },
  unsure: { en: 'Not sure. Is it one of these?', kn: 'ಖಚಿತವಿಲ್ಲ. ಇವುಗಳಲ್ಲಿ ಒಂದೇ?', hi: 'पक्का नहीं। क्या यह इनमें से एक है?' },
  unsureSub: { en: 'Try a straighter, closer photo in good light. The model knows 25 sculptures and monuments of Badami, Pattadakal and Aihole.', kn: 'ಉತ್ತಮ ಬೆಳಕಿನಲ್ಲಿ ನೇರವಾಗಿ, ಹತ್ತಿರದಿಂದ ಫೋಟೋ ತೆಗೆಯಿರಿ. ಮಾದರಿಗೆ ಬಾದಾಮಿ, ಪಟ್ಟದಕಲ್ಲು, ಐಹೊಳೆಯ 25 ಶಿಲ್ಪ ಮತ್ತು ಸ್ಮಾರಕಗಳು ಗೊತ್ತು.', hi: 'अच्छी रोशनी में सीधी, नज़दीक से फ़ोटो लें। मॉडल बादामी, पट्टदकल और ऐहोल की 25 मूर्तियाँ और स्मारक पहचानता है।' },
  confidence: { en: 'confidence', kn: 'ವಿಶ್ವಾಸ', hi: 'विश्वास' },
  also: { en: 'Other possibilities', kn: 'ಇತರ ಸಾಧ್ಯತೆಗಳು', hi: 'अन्य संभावनाएँ' },
  again: { en: 'Scan another', kn: 'ಮತ್ತೊಂದು ಸ್ಕ್ಯಾನ್', hi: 'एक और स्कैन' },
  contribute: { en: 'Help build the heritage catalogue', kn: 'ಪರಂಪರೆ ಕ್ಯಾಟಲಾಗ್‌ಗೆ ಸಹಾಯ ಮಾಡಿ', hi: 'विरासत कैटलॉग बनाने में मदद करें' },
  contributeSub: { en: 'Send this photo to the district team to label. Unknown sculptures become new training data.', kn: 'ಲೇಬಲ್ ಮಾಡಲು ಈ ಫೋಟೋವನ್ನು ಜಿಲ್ಲಾ ತಂಡಕ್ಕೆ ಕಳುಹಿಸಿ. ಗುರುತಿಸದ ಶಿಲ್ಪಗಳು ಹೊಸ ತರಬೇತಿ ಡೇಟಾ ಆಗುತ್ತವೆ.', hi: 'लेबल करने के लिए यह फ़ोटो ज़िला टीम को भेजें। अनजानी मूर्तियाँ नया प्रशिक्षण डेटा बनती हैं।' },
  sent: { en: 'Sent to the catalogue queue. Thank you!', kn: 'ಕ್ಯಾಟಲಾಗ್ ಸರದಿಗೆ ಕಳುಹಿಸಲಾಗಿದೆ. ಧನ್ಯವಾದ!', hi: 'कैटलॉग कतार में भेजा गया। धन्यवाद!' },
  where: { en: 'Where it is', kn: 'ಎಲ್ಲಿದೆ', hi: 'कहाँ है' },
  whyAI: { en: 'Why does the AI think so?', kn: 'AI ಏಕೆ ಹೀಗೆ ಹೇಳುತ್ತದೆ?', hi: 'AI ऐसा क्यों सोचता है?' },
  camNote: { en: 'Grad-CAM: the brighter regions influenced the decision most.', kn: 'Grad-CAM: ಪ್ರಕಾಶಮಾನ ಭಾಗಗಳು ನಿರ್ಧಾರದ ಮೇಲೆ ಹೆಚ್ಚು ಪ್ರಭಾವ ಬೀರಿವೆ.', hi: 'Grad-CAM: चमकीले हिस्सों ने फ़ैसले को सबसे ज़्यादा प्रभावित किया।' },
  camOffline: { en: 'The explanation needs the server; recognition itself works offline.', kn: 'ವಿವರಣೆಗೆ ಸರ್ವರ್ ಬೇಕು; ಗುರುತಿಸುವಿಕೆ ಆಫ್‌ಲೈನ್‌ನಲ್ಲೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ.', hi: 'व्याख्या के लिए सर्वर चाहिए; पहचान ऑफ़लाइन भी चलती है।' },
  ms: { en: 'ms on this phone', kn: 'ms ಈ ಫೋನ್‌ನಲ್ಲಿ', hi: 'ms इस फ़ोन पर' },
}

export default function Scan() {
  const { lang, L } = useLang()
  const cam = useRef<HTMLInputElement>(null), gal = useRef<HTMLInputElement>(null)
  const [img, setImg] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'thinking' | 'done' | 'error'>('idle')
  const [res, setRes] = useState<VisionResult | null>(null)
  const [sent, setSent] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [heat, setHeat] = useState<string | 'loading' | 'unavailable' | null>(null)

  useEffect(() => { loadVision().then(() => setModelReady(true)).catch(() => setState('error')); return () => stopSpeaking() }, [])

  async function onFile(f?: File) {
    if (!f) return
    stopSpeaking(); setSent(false); setFile(f); setHeat(null)
    setImg(URL.createObjectURL(f)); setRes(null)
    setState(modelReady ? 'thinking' : 'loading')
    try {
      const im = await fileToImage(f)
      setState('thinking')
      const r = await classify(im)
      setRes(r); setState('done')
    } catch (e) { console.error(e); setState('error') }
  }

  const top = res?.top[0]
  const s = top ? sculptureById[top.id] : null
  const place = s ? placeById[s.place] : null
  // Hierarchical fallback: unsure between neighbouring temples, but sure of the SITE
  const siteOf = (id: string) => sculptureById[id]?.place
  const sameSite = res && !res.confident && res.top.length > 1 && res.top.every((x) => siteOf(x.id) === siteOf(res.top[0].id))
  const siteMass = res ? res.top.reduce((a, x) => a + x.p, 0) : 0
  const siteLevel = sameSite && siteMass >= 0.6 ? placeById[siteOf(res!.top[0].id)!] : null

  async function explain() {
    if (!file) return
    setHeat('loading')
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/vision/identify', { method: 'POST', body: fd, signal: AbortSignal.timeout(20000) })
      if (!r.ok) throw new Error()
      setHeat((await r.json()).gradcam)
    } catch { setHeat('unavailable') }
  }

  return (
    <div>
      <PageHead title={L(T.title)} sub={L(T.sub)} />
      <div className="space-y-4 px-4">
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={gal} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3] w-full bg-night">
            {img ? <img src={img} alt="Your photo" className="h-full w-full object-cover" /> : (
              <div className="grid h-full place-items-center text-white/60">
                <svg viewBox="0 0 120 90" className="w-40"><path d="M10 25V10h15M95 10h15v15M110 65v15H95M25 80H10V65" stroke="#46e6cb" strokeWidth="3" fill="none" /><path d="M60 22c-8 0-12 6-12 12h24c0-6-4-12-12-12zM44 34h32v8H44zM40 42h40v10H40zM36 52h48v12H36z" fill="none" stroke="#ffffff66" strokeWidth="1.6" /></svg>
              </div>
            )}
            {(state === 'thinking' || state === 'loading') && (
              <div className="absolute inset-0 grid place-items-center bg-night/55 text-white">
                <div className="flex items-center gap-2 text-[15px] font-semibold"><Loader2 className="animate-spin" size={20} />{state === 'loading' ? L(T.loading) : L(T.thinking)}</div>
              </div>
            )}
            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[12px] font-semibold text-white"><WifiOff size={13} /> On-device AI</div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <button onClick={() => cam.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-lake py-3 text-[15px] font-semibold text-white"><Camera size={18} />{L(T.take)}</button>
            <button onClick={() => gal.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-line py-3 text-[15px] font-semibold text-ink"><ImagePlus size={18} />{L(T.upload)}</button>
          </div>
        </Card>

        {state === 'error' && <Card className="p-4 text-[14.5px] text-sand">The model could not run on this browser. Try Chrome, or ask the guide instead.</Card>}

        {state === 'done' && res && s && res.confident && (
          <Card className="rise p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Eyebrow>{s.group}</Eyebrow>
                <h2 className="display mt-1 text-[26px] leading-[1.1]">{L(s.name)}</h2>
              </div>
              <div className="text-right">
                <div className="num text-[26px] font-bold leading-none text-lake">{Math.round(top!.p * 100)}%</div>
                <div className="text-[11px] text-ink-3">{L(T.confidence)}</div>
              </div>
            </div>
            <p className="mt-3 text-[16px] leading-relaxed text-ink">{L(s.text)}</p>
            <ExplainIn className="mt-4" title={s.name} body={[s.text]} />
            <div className="mt-3 flex flex-wrap gap-2">
              {place && <Link to={`/place/${place.id}`} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[14px] font-semibold"><MapPin size={16} className="text-lake" />{L(T.where)}: {L(place.name)}</Link>}
            </div>
            {res.top.length > 1 && (
              <div className="mt-4 border-t border-line pt-3">
                <Eyebrow>{L(T.also)}</Eyebrow>
                <ul className="mt-1.5 space-y-1">
                  {res.top.slice(1).map((x) => (
                    <li key={x.id} className="flex justify-between text-[14px] text-ink-2"><span>{L(sculptureById[x.id]?.name)}</span><span className="num">{Math.round(x.p * 100)}%</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 border-t border-line pt-3">
              {heat && heat !== 'loading' && heat !== 'unavailable' ? (
                <figure><img src={heat} alt="Grad-CAM heatmap: bright areas influenced the decision most" className="w-full rounded-xl" /><figcaption className="mt-1 text-[12px] text-ink-3">{L(T.camNote)}</figcaption></figure>
              ) : (
                <button onClick={explain} disabled={heat === 'loading'} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-lake">{heat === 'loading' && <Loader2 size={14} className="animate-spin" />}{L(T.whyAI)}</button>
              )}
              {heat === 'unavailable' && <p className="mt-1 text-[12px] text-ink-3">{L(T.camOffline)}</p>}
            </div>
            <p className="num mt-3 text-[11.5px] text-ink-3">EfficientNet-B0 · {res.ms} {L(T.ms)}</p>
          </Card>
        )}

        {state === 'done' && res && siteLevel && (
          <Card className="rise p-4">
            <Eyebrow>{lang === 'kn' ? 'ಸ್ಥಳ ಗುರುತಿಸಲಾಗಿದೆ' : lang === 'hi' ? 'स्थान पहचाना गया' : 'Site identified'} · {Math.round(siteMass * 100)}%</Eyebrow>
            <h2 className="display mt-1 text-[26px] leading-[1.1]">{L(siteLevel.name)}</h2>
            <p className="mt-2 text-[15px] leading-relaxed">{L(siteLevel.summary)}</p>
            <div className="mt-3 rounded-xl bg-mist p-3 text-[14px]">
              {lang === 'kn' ? 'ಹೆಚ್ಚಾಗಿ ಇದು: ' : lang === 'hi' ? 'सबसे संभावित: ' : 'Most likely: '}
              {res.top.map((x) => `${L(sculptureById[x.id]?.name)} (${Math.round(x.p * 100)}%)`).join(', ')}
              <div className="mt-1 text-[12.5px] text-ink-3">{lang === 'kn' ? 'ಒಂದೇ ದೇವಾಲಯದ ಹತ್ತಿರದ ಫೋಟೋ ತೆಗೆದರೆ ನಿಖರವಾಗಿ ಹೇಳಬಲ್ಲೆ.' : lang === 'hi' ? 'एक ही मंदिर की नज़दीकी फ़ोटो लें तो सटीक बता सकूँगा।' : 'Photograph a single temple up close and I can tell which one.'}</div>
            </div>
            <Link to={`/place/${siteLevel.id}`} className="mt-3 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[14px] font-semibold"><MapPin size={16} className="text-lake" />{L(siteLevel.name)}</Link>
          </Card>
        )}

        {state === 'done' && res && !res.confident && !siteLevel && (
          <Card className="rise p-4">
            <div className="flex items-center gap-2 text-sand"><HelpCircle size={20} /><h2 className="text-[18px] font-bold">{L(T.unsure)}</h2></div>
            <p className="mt-1 text-[14px] text-ink-2">{L(T.unsureSub)}</p>
            <ul className="mt-3 space-y-2">
              {res.top.map((x) => (
                <li key={x.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-[14.5px]">
                  <span><b className="font-semibold">{L(sculptureById[x.id]?.name)}</b><span className="block text-[12px] text-ink-3">{sculptureById[x.id]?.group}</span></span>
                  <span className="num text-ink-2">{Math.round(x.p * 100)}%</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {state === 'done' && (
          <Card className="p-4">
            <div className="text-[15px] font-semibold">{L(T.contribute)}</div>
            <p className="mt-1 text-[13.5px] text-ink-2">{L(T.contributeSub)}</p>
            <div className="mt-3 flex gap-2">
              <button disabled={sent} onClick={() => { publish({ type: 'anomaly', severity: 'info', title: `Catalogue photo: ${top ? sculptureById[top.id]?.name.en : 'unknown'} (${Math.round((top?.p ?? 0) * 100)}%)`, detail: 'Tourist-contributed photo queued for expert labelling', source: 'tourist' }); setSent(true) }}
                className="rounded-full border border-lake px-4 py-2 text-[14px] font-semibold text-lake disabled:opacity-60">{sent ? L(T.sent) : L(T.contribute)}</button>
              <button onClick={() => { setImg(null); setRes(null); setState('idle'); cam.current?.click() }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-semibold text-ink-2"><RotateCcw size={15} />{L(T.again)}</button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
