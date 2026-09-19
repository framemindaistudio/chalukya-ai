import { useState } from 'react'
import { Loader2, MessageSquareHeart, Mic, Star } from 'lucide-react'
import { useLang } from '../lib/i18n'
import { analyzeReview, ASPECT_LABEL, type ReviewAnalysis } from '../lib/reviews'
import { publish } from '../lib/live'
import { canListen, listen } from '../lib/speech'
import { placeById } from '../lib/data'

const TX = {
  title: { en: 'Rate your visit', kn: 'ನಿಮ್ಮ ಭೇಟಿಗೆ ರೇಟಿಂಗ್ ನೀಡಿ', hi: 'अपनी यात्रा को रेट करें' },
  sub: { en: 'Write or speak in any language. The district sees what needs fixing: toilets, water, parking, safety…', kn: 'ಯಾವುದೇ ಭಾಷೆಯಲ್ಲಿ ಬರೆಯಿರಿ ಅಥವಾ ಹೇಳಿ. ಶೌಚಾಲಯ, ನೀರು, ಪಾರ್ಕಿಂಗ್, ಸುರಕ್ಷತೆ… ಏನು ಸರಿಪಡಿಸಬೇಕು ಎಂದು ಜಿಲ್ಲಾಡಳಿತಕ್ಕೆ ತಿಳಿಯುತ್ತದೆ.', hi: 'किसी भी भाषा में लिखें या बोलें। ज़िला देखता है कि क्या सुधारना है: शौचालय, पानी, पार्किंग, सुरक्षा…' },
  send: { en: 'Send review', kn: 'ವಿಮರ್ಶೆ ಕಳುಹಿಸಿ', hi: 'समीक्षा भेजें' }, thanks: { en: 'Thank you! The AI understood:', kn: 'ಧನ್ಯವಾದ! AI ಅರ್ಥಮಾಡಿಕೊಂಡದ್ದು:', hi: 'धन्यवाद! AI ने समझा:' },
  pos: { en: 'Positive', kn: 'ಸಕಾರಾತ್ಮಕ', hi: 'सकारात्मक' }, neg: { en: 'Needs attention', kn: 'ಗಮನ ಬೇಕು', hi: 'ध्यान चाहिए' }, mix: { en: 'Mixed', kn: 'ಮಿಶ್ರ', hi: 'मिश्रित' },
}

export default function ReviewBox({ place }: { place: string }) {
  const { L, lang } = useLang()
  const [stars, setStars] = useState(0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<ReviewAnalysis | null>(null)
  const [rec, setRec] = useState(false)

  async function send() {
    if (!text.trim()) return
    setBusy(true)
    const a = await analyzeReview(text)
    setRes(a); setBusy(false)
    publish({ type: 'review', severity: a.sentiment === 'neg' ? 'warn' : 'info', source: 'tourist', place,
      title: `${placeById[place]?.name.en ?? place}: ${a.sentiment === 'neg' ? 'complaint' : a.sentiment === 'mix' ? 'mixed review' : 'positive review'}${a.aspects.length ? ` · ${a.aspects.map((x) => ASPECT_LABEL[x].en).join(', ')}` : ''}`,
      detail: text.slice(0, 180), data: { text, stars, ...a } })
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2"><MessageSquareHeart size={18} className="text-lake" /><div className="text-[15.5px] font-bold">{L(TX.title)}</div></div>
      <p className="mt-1 text-[13px] text-ink-2">{L(TX.sub)}</p>
      {res ? (
        <div className="rise mt-3 rounded-xl bg-mist p-3 text-[14px]">
          <div className="font-semibold">{L(TX.thanks)}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${res.sentiment === 'pos' ? 'bg-lake-soft text-lake' : res.sentiment === 'neg' ? 'bg-sand-soft text-sand' : 'bg-lamp-soft text-[#8a6412]'}`}>{L(TX[res.sentiment])} · {Math.round(res.confidence * 100)}%</span>
            {res.aspects.map((a) => <span key={a} className="rounded-full bg-paper px-2.5 py-0.5 text-[12.5px] font-medium">{L(ASPECT_LABEL[a])}</span>)}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Stars">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={stars === n} onClick={() => setStars(n)} aria-label={`${n} stars`}><Star size={26} className={n <= stars ? 'fill-lamp text-lamp' : 'text-line'} /></button>)}
          </div>
          <div className="mt-3 flex gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={lang === 'kn' ? 'ಉದಾ: ಗುಹೆ ಅದ್ಭುತ, ಆದರೆ ಕುಡಿಯುವ ನೀರು ಇರಲಿಲ್ಲ' : lang === 'hi' ? 'जैसे: गुफाएँ सुंदर, पर पीने का पानी नहीं था' : 'e.g. Stunning caves, but no drinking water on the way up'}
              className="min-w-0 flex-1 resize-none rounded-xl border border-line bg-paper p-2.5 text-[15px] outline-none focus:border-lake" />
            <button type="button" disabled={!canListen()} aria-label="Speak your review" onClick={() => { setRec(true); listen(lang, (tx, fin) => { setText(tx); if (fin) setRec(false) }, () => setRec(false)) }}
              className={`grid w-11 place-items-center rounded-xl text-white ${rec ? 'bg-sand' : 'bg-ink'} disabled:bg-ink-3`}><Mic size={18} /></button>
          </div>
          <button onClick={send} disabled={!text.trim() || busy} className="mt-2 inline-flex items-center gap-2 rounded-full bg-lake px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />}{L(TX.send)}</button>
        </>
      )}
    </div>
  )
}
