import { useEffect, useState } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { LANGS, useLang, type Lang, type Tri } from '../lib/i18n'
import { speak, stopSpeaking } from '../lib/speech'

const LISTEN: Record<Lang, string> = { kn: 'ಆಲಿಸಿ', hi: 'सुनें', en: 'Listen' }
const STOP: Record<Lang, string> = { kn: 'ನಿಲ್ಲಿಸಿ', hi: 'रोकें', en: 'Stop' }

/**
 * Voice guide in any of the three languages, independent of the app language:
 * "Explain this in Kannada" is one tap. Text and speech switch together.
 */
export default function ExplainIn({ title, body, className = '' }: { title: Tri; body: Tri[]; className?: string }) {
  const { lang } = useLang()
  const [l, setL] = useState<Lang>(lang)
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => () => stopSpeaking(), [])
  const pick = (x: Tri) => x[l] ?? x.en
  function play(to: Lang) {
    stopSpeaking(); setL(to); setSpeaking(true)
    speak(`${title[to] ?? title.en}. ${body.map((b) => b[to] ?? b.en).join(' ')}`, to, () => setSpeaking(false))
  }
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => (speaking ? (stopSpeaking(), setSpeaking(false)) : play(l))} className="inline-flex items-center gap-2 rounded-full bg-lake px-4 py-2 text-[14px] font-semibold text-white">
          {speaking ? <Square size={15} /> : <Volume2 size={16} />}{speaking ? STOP[l] : LISTEN[l]}
        </button>
        <div role="radiogroup" aria-label="Explanation language" className="flex rounded-full bg-lake-soft/70 p-0.5">
          {LANGS.map((x) => (
            <button key={x.id} role="radio" aria-checked={l === x.id} onClick={() => play(x.id)}
              className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${l === x.id ? 'bg-lake text-white' : 'text-lake'}`}>{x.label}</button>
          ))}
        </div>
      </div>
      {l !== lang && <p className="rise mt-3 rounded-xl bg-mist p-3 text-[15px] leading-relaxed">{body.map(pick).join(' ')}</p>}
    </div>
  )
}
