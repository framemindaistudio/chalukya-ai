import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Loader2, Mic, MicOff, Send, Square, Volume2 } from 'lucide-react'
import { useLang, type Lang } from '../lib/i18n'
import { ask, type Answer } from '../lib/assistant'
import { canListen, listen, speak, stopSpeaking } from '../lib/speech'
import { loadIntentModel } from '../lib/intent'
import AnswerCards from '../components/AnswerCards'
import { Chip } from '../components/ui'

type Msg = { role: 'user'; text: string } | { role: 'bot'; a: Answer }

const INTRO = {
  en: 'Ask anything about Bagalkot district: history, crowds, parking, food, stays, routes or safety. I understand Kannada, Hindi and English, typed or spoken.',
  kn: 'ಬಾಗಲಕೋಟೆ ಜಿಲ್ಲೆಯ ಬಗ್ಗೆ ಏನನ್ನಾದರೂ ಕೇಳಿ: ಇತಿಹಾಸ, ಜನಸಂದಣಿ, ಪಾರ್ಕಿಂಗ್, ಊಟ, ವಸತಿ, ದಾರಿ ಅಥವಾ ಸುರಕ್ಷತೆ. ಕನ್ನಡ, ಹಿಂದಿ, ಇಂಗ್ಲಿಷ್ ಮೂರೂ ಅರ್ಥವಾಗುತ್ತದೆ; ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮಾತನಾಡಿ.',
  hi: 'बागलकोट ज़िले के बारे में कुछ भी पूछिए: इतिहास, भीड़, पार्किंग, खाना, ठहरना, रास्ता या सुरक्षा। मैं कन्नड़, हिंदी और अंग्रेज़ी समझता हूँ, लिखकर या बोलकर।',
}
const STARTERS: Record<Lang, string[]> = {
  en: ['Is Pattadakal crowded now?', 'Veg food near Badami under 300', 'Who is the 18-armed Nataraja?', 'Parking at Aihole'],
  kn: ['ಪಟ್ಟದಕಲ್ಲು ಈಗ ರಶ್ ಇದೆಯಾ?', 'ಬಾದಾಮಿ ಹತ್ತಿರ ಸಸ್ಯಾಹಾರಿ ಊಟ', 'ಐಹೊಳೆ ಇತಿಹಾಸ ಏನು?', 'ಬನಶಂಕರಿ ಜಾತ್ರೆ ಯಾವಾಗ?'],
  hi: ['क्या पट्टदकल में अभी भीड़ है?', 'बादामी में सस्ता होटल', 'ऐहोल का इतिहास बताइए', 'बादामी गुफा में पार्किंग'],
}
const SRC: Record<string, string> = {
  kb: 'Curated knowledge base', dtdc_book: 'District Tourism book (2022)', forecast: 'Footfall forecast model', iot: 'Parking sensors',
  'parking-model': 'Parking prediction model', osm: 'OpenStreetMap', recommender: 'Recommender', 'osm-routing': 'OSM road network',
  'open-meteo': 'Open-Meteo (live)', 'climate-normals': 'Climate normals', wikidata: 'Wikidata', district_site: 'District Administration (official)',
}

export default function Ask() {
  const { lang, t } = useLang()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [rec, setRec] = useState(false)
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
  const stopRec = useRef<() => void>(() => {})
  const end = useRef<HTMLDivElement>(null)

  const [params] = useSearchParams()
  useEffect(() => { loadIntentModel(); const q = params.get('q'); if (q) send(q); return () => { stopSpeaking(); stopRec.current() } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, busy])

  async function send(q: string, spoken = false) {
    const question = q.trim(); if (!question || busy) return
    setText(''); setMsgs((m) => [...m, { role: 'user', text: question }]); setBusy(true)
    try {
      const a = await ask(question, lang)
      setMsgs((m) => {
        const next = [...m, { role: 'bot' as const, a }]
        if (spoken) { setSpeakingIdx(next.length - 1); speak(a.text, a.lang, () => setSpeakingIdx(null)) }
        return next
      })
    } finally { setBusy(false) }
  }

  function toggleMic() {
    if (rec) { stopRec.current(); setRec(false); return }
    stopSpeaking(); setRec(true)
    let latest = ''
    stopRec.current = listen(lang, (tx, fin) => { latest = tx; setText(tx); if (fin) { setRec(false); send(tx, true) } }, (err) => {
      setRec(false)
      if (err && err !== 'no-speech' && err !== 'aborted') setMsgs((m) => [...m, { role: 'user', text: `(${err === 'unsupported' ? 'Voice input is not supported in this browser. Try Chrome on Android.' : 'Mic: ' + err})` }])
      else if (!err && latest) { /* handled on final */ }
    })
  }

  function toggleSpeak(i: number, a: Answer) {
    if (speakingIdx === i) { stopSpeaking(); setSpeakingIdx(null); return }
    setSpeakingIdx(i); speak(a.text, a.lang, () => setSpeakingIdx(null))
  }

  return (
    <div className="flex min-h-[calc(100dvh-140px)] flex-col">
      <div className="flex-1 space-y-3 px-4 pt-4">
        <div className="card p-4">
          <h1 className="display text-[26px] leading-tight">{t('ask')}</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{INTRO[lang]}</p>
          <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1">{STARTERS[lang].map((s) => <Chip key={s} onClick={() => send(s)}>{s}</Chip>)}</div>
        </div>

        {msgs.map((m, i) => m.role === 'user' ? (
          <div key={i} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-lake px-3.5 py-2.5 text-[15px] text-white">{m.text}</div></div>
        ) : (
          <div key={i} className="rise">
            <div className="card rounded-bl-md p-3.5">
              <p className="text-[15.5px] leading-relaxed text-ink">{m.a.text}</p>
              <AnswerCards cards={m.a.cards} />
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <button onClick={() => toggleSpeak(i, m.a)} className="inline-flex items-center gap-1.5 rounded-full bg-lake-soft/70 px-3 py-1 text-[13px] font-semibold text-lake">
                  {speakingIdx === i ? <Square size={13} /> : <Volume2 size={14} />}{speakingIdx === i ? t('stop') : t('listen')}
                </button>
                <span className="truncate text-[11px] text-ink-3" title={`intent: ${m.a.intent} (${Math.round(m.a.confidence * 100)}%)`}>
                  {m.a.intent} · {m.a.sources.map((s) => SRC[s] ?? s).join(' · ')}
                </span>
              </div>
            </div>
            {i === msgs.length - 1 && <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">{m.a.suggestions.map((s) => <Chip key={s} onClick={() => send(s)}>{s}</Chip>)}</div>}
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 px-1 text-[14px] text-ink-3"><Loader2 size={16} className="animate-spin" />…</div>}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(text) }} className="sticky bottom-[76px] z-30 mt-3 flex items-center gap-2 border-t border-line bg-mist/95 px-3 py-2.5 backdrop-blur">
        <button type="button" onClick={toggleMic} disabled={!canListen()} aria-label={rec ? 'Stop listening' : 'Speak'}
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-white transition ${rec ? 'bg-sand' : 'bg-lake'} disabled:bg-ink-3`}>
          {rec ? <span className="relative grid place-items-center"><span className="live-pulse absolute h-8 w-8 rounded-full bg-white/40" /><MicOff size={20} /></span> : <Mic size={21} />}
        </button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={rec ? t('listening') : t('typeQuestion')}
          className="h-12 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 text-[16px] outline-none focus:border-lake" />
        <button type="submit" aria-label={t('send')} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40" disabled={!text.trim()}><Send size={19} /></button>
      </form>
    </div>
  )
}
