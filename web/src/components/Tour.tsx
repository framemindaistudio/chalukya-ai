import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import { useLang, type Lang, type Tri } from '../lib/i18n'

/*
  A guided tour for someone meeting the app cold (a judge at the desk with the QR): seven screens,
  about 80 seconds, one caption each. It moves between pages itself, can be paused or stepped, and
  survives page changes (sessionStorage). Start it from Home or with ?tour=1 on any link.
*/
const ASK: Record<Lang, string> = {
  en: 'I am in Badami. I have 6 hours, ₹3,000 budget, two children, and I like history.',
  kn: 'ನಾನು ಬಾದಾಮಿಯಲ್ಲಿದ್ದೇನೆ. 6 ಗಂಟೆ ಇದೆ, ₹3000 ಬಜೆಟ್, ಇಬ್ಬರು ಮಕ್ಕಳು, ಇತಿಹಾಸ ಇಷ್ಟ.',
  hi: 'मैं बादामी में हूँ। मेरे पास 6 घंटे हैं, ₹3000 बजट, दो बच्चे, और मुझे इतिहास पसंद है।',
}
/** focus: the element the caption talks about, scrolled into view above the caption card */
type Step = { path: (l: Lang) => string; focus?: string; title: Tri; text: Tri }
const STEPS: Step[] = [
  { path: () => '/', focus: '[data-tour=circuit]', title: { en: 'The whole circuit, live', kn: 'ಇಡೀ ಪ್ರವಾಸ ವೃತ್ತ, ನೇರವಾಗಿ', hi: 'पूरा सर्किट, लाइव' },
    text: { en: 'Real roads between Badami, Pattadakal and Aihole. Each site shows how busy it is now, from the crowd forecast, and how much parking is free.', kn: 'ಬಾದಾಮಿ, ಪಟ್ಟದಕಲ್ಲು, ಐಹೊಳೆ ನಡುವಿನ ನಿಜವಾದ ರಸ್ತೆಗಳು. ಪ್ರತಿ ತಾಣವೂ ಜನಸಂದಣಿ ಮುನ್ಸೂಚನೆಯಿಂದ ಈಗಿನ ದಟ್ಟಣೆ ಮತ್ತು ಖಾಲಿ ಪಾರ್ಕಿಂಗ್ ತೋರಿಸುತ್ತದೆ.', hi: 'बादामी, पट्टदकल और ऐहोल के बीच असली सड़कें। हर स्थल भीड़ के पूर्वानुमान से अभी की भीड़ और खाली पार्किंग दिखाता है।' } },
  { path: (l) => `/ask?q=${encodeURIComponent(ASK[l])}`, title: { en: 'Ask in your own words', kn: 'ನಿಮ್ಮದೇ ಮಾತಿನಲ್ಲಿ ಕೇಳಿ', hi: 'अपने शब्दों में पूछें' },
    text: { en: 'Hours, budget, children, interests: one question becomes a timed plan that avoids crowds and midday heat.', kn: 'ಸಮಯ, ಬಜೆಟ್, ಮಕ್ಕಳು, ಆಸಕ್ತಿ: ಒಂದೇ ಪ್ರಶ್ನೆಯಿಂದ ಜನಸಂದಣಿ ಮತ್ತು ಮಧ್ಯಾಹ್ನದ ಬಿಸಿಲು ತಪ್ಪಿಸುವ ಸಮಯಬದ್ಧ ಯೋಜನೆ.', hi: 'समय, बजट, बच्चे, रुचि: एक सवाल से भीड़ और दोपहर की गर्मी से बचने वाली समयबद्ध योजना।' } },
  { path: () => `/plan?q=${encodeURIComponent('2 days from Bagalkot with my parents, we like temples and sunsets, budget ₹8000')}`, focus: '[data-tour=day]',
    title: { en: 'A crowd-smart trip', kn: 'ಜನಸಂದಣಿ ತಪ್ಪಿಸುವ ಪ್ರವಾಸ', hi: 'भीड़ से बचने वाली यात्रा' },
    text: { en: 'Every visiting order is tried. The best comes with a map, cost, lunch stop and a WhatsApp share.', kn: 'ಪ್ರತಿಯೊಂದು ಕ್ರಮವನ್ನೂ ಪರೀಕ್ಷಿಸಿ ಉತ್ತಮವಾದದ್ದನ್ನು ನಕ್ಷೆ, ವೆಚ್ಚ, ಊಟದ ಸ್ಥಳ ಮತ್ತು WhatsApp ಹಂಚಿಕೆಯೊಂದಿಗೆ ನೀಡುತ್ತದೆ.', hi: 'हर क्रम आज़माया जाता है; सबसे अच्छी योजना नक्शा, खर्च, लंच और WhatsApp शेयर के साथ।' } },
  { path: () => '/scan?mode=live', title: { en: 'Point the camera', kn: 'ಕ್ಯಾಮೆರಾ ತೋರಿಸಿ', hi: 'कैमरा दिखाइए' },
    text: { en: 'The live lens names 25 sculptures and temples on the phone, with no internet. It reads boards in three scripts too.', kn: 'ಲೈವ್ ಲೆನ್ಸ್ 25 ಶಿಲ್ಪ, ದೇವಾಲಯಗಳನ್ನು ಫೋನ್‌ನಲ್ಲೇ, ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದೆ ಗುರುತಿಸುತ್ತದೆ. ಮೂರು ಲಿಪಿಯ ಫಲಕಗಳನ್ನೂ ಓದುತ್ತದೆ.', hi: 'लाइव लेंस 25 मूर्तियाँ और मंदिर फ़ोन पर, बिना इंटरनेट पहचानता है। तीन लिपियों के बोर्ड भी पढ़ता है।' } },
  { path: () => '/safety', title: { en: 'Help in two seconds', kn: 'ಎರಡು ಸೆಕೆಂಡಿನಲ್ಲಿ ಸಹಾಯ', hi: 'दो सेकंड में मदद' },
    text: { en: 'Hold SOS and your location reaches the control room. With no signal it keeps the alert to resend, with one tap to call 112 or text your location.', kn: 'SOS ಒತ್ತಿ ಹಿಡಿದರೆ ನಿಮ್ಮ ಸ್ಥಳ ನಿಯಂತ್ರಣ ಕೊಠಡಿಗೆ ತಲುಪುತ್ತದೆ. ಸಿಗ್ನಲ್ ಇಲ್ಲದಿದ್ದರೆ ಎಚ್ಚರಿಕೆಯನ್ನು ಮತ್ತೆ ಕಳುಹಿಸಲು ಉಳಿಸುತ್ತದೆ; ಒಂದೇ ಟ್ಯಾಪ್‌ನಲ್ಲಿ 112 ಕರೆ ಅಥವಾ ಸ್ಥಳದ SMS.', hi: 'SOS दबाए रखें, आपकी लोकेशन कंट्रोल रूम पहुँचती है। सिग्नल न हो तो अलर्ट दोबारा भेजने के लिए रखता है, और एक टैप में 112 कॉल या लोकेशन SMS।' } },
  { path: () => '/command', title: { en: 'What the district sees', kn: 'ಜಿಲ್ಲಾಡಳಿತ ನೋಡುವುದು', hi: 'ज़िला क्या देखता है' },
    text: { en: 'Crowds against capacity, live SOS and heat alerts, and seven-day forecasts for water, waste, toilets and guides.', kn: 'ಸಾಮರ್ಥ್ಯಕ್ಕೆ ಹೋಲಿಸಿ ಜನಸಂದಣಿ, ನೇರ SOS ಮತ್ತು ಬಿಸಿಲಿನ ಎಚ್ಚರಿಕೆ, ನೀರು, ತ್ಯಾಜ್ಯ, ಶೌಚಾಲಯ, ಮಾರ್ಗದರ್ಶಿಗಳಿಗೆ ಏಳು ದಿನಗಳ ಮುನ್ಸೂಚನೆ.', hi: 'क्षमता के मुकाबले भीड़, लाइव SOS और गर्मी अलर्ट, और पानी, कचरा, शौचालय, गाइड के लिए सात दिन का पूर्वानुमान।' } },
  { path: () => '/how', title: { en: 'Honest AI', kn: 'ಪ್ರಾಮಾಣಿಕ AI', hi: 'ईमानदार AI' },
    text: { en: 'Five models trained for Bagalkot, tested on data they never saw, with anything simulated clearly marked.', kn: 'ಬಾಗಲಕೋಟೆಗಾಗಿ ತರಬೇತಿ ಪಡೆದ ಐದು ಮಾದರಿಗಳು, ಹಿಂದೆಂದೂ ನೋಡದ ಡೇಟಾದಲ್ಲಿ ಪರೀಕ್ಷಿತ; ಅನುಕರಿಸಿದ ಡೇಟಾ ಸ್ಪಷ್ಟವಾಗಿ ಗುರುತಿಸಲಾಗಿದೆ.', hi: 'बागलकोट के लिए प्रशिक्षित पाँच मॉडल, अनदेखे डेटा पर परखे गए; सिम्युलेटेड डेटा साफ़ चिह्नित।' } },
]
const STEP_MS = 11500
const T = {
  back: { en: 'Back', kn: 'ಹಿಂದೆ', hi: 'पीछे' }, next: { en: 'Next', kn: 'ಮುಂದೆ', hi: 'आगे' }, finish: { en: 'Finish', kn: 'ಮುಗಿಸಿ', hi: 'समाप्त' },
  pause: { en: 'Pause', kn: 'ನಿಲ್ಲಿಸಿ', hi: 'रोकें' }, play: { en: 'Play', kn: 'ಮುಂದುವರಿಸಿ', hi: 'चलाएँ' }, exit: { en: 'End tour', kn: 'ಪರಿಚಯ ಮುಗಿಸಿ', hi: 'टूर बंद करें' },
  tour: { en: 'Tour', kn: 'ಪರಿಚಯ', hi: 'टूर' },
}

// a tiny store that survives route changes and reloads within the tab
const KEY = 'chalukya.tour'
let current: number | null = (() => { try { const v = sessionStorage.getItem(KEY); return v === null ? null : Number(v) } catch { return null } })()
const subs = new Set<() => void>()
function setStep(v: number | null) {
  current = v
  try { if (v === null) sessionStorage.removeItem(KEY); else sessionStorage.setItem(KEY, String(v)) } catch { /* storage off */ }
  subs.forEach((f) => f())
}
export function startTour() { setStep(0) }

export default function Tour() {
  const { L, lang } = useLang()
  const nav = useNavigate(), loc = useLocation()
  const [step, setLocal] = useState(current)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const pausedRef = useRef(paused); pausedRef.current = paused
  useEffect(() => { const f = () => setLocal(current); subs.add(f); return () => { subs.delete(f) } }, [])
  useEffect(() => { if (new URLSearchParams(loc.search).get('tour') === '1' && current === null) startTour() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // each step opens its screen
  useEffect(() => {
    setElapsed(0)
    if (step === null) return
    const target = STEPS[step].path(lang)
    if (loc.pathname + loc.search !== target) nav(target)
    window.scrollTo(0, 0)
    const sel = STEPS[step].focus
    if (!sel) return
    // the page may still be loading its chunk or computing the plan: look for the subject for a few seconds
    let tries = 0
    const id = setInterval(() => {
      const el = document.querySelector(sel)
      if (el && !document.querySelector('.boot')) {
        clearInterval(id)
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' })
      } else if (++tries > 40) clearInterval(id)
    }, 150)
    return () => clearInterval(id)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // a timer, not requestAnimationFrame: background tabs would stall the tour
  useEffect(() => {
    if (step === null) return
    let done = 0, last = Date.now()
    const id = setInterval(() => {
      const now = Date.now(), dt = now - last; last = now
      if (pausedRef.current || document.hidden || document.querySelector('.boot')) return
      done += Math.min(dt, 500)
      if (done < STEP_MS) { setElapsed(done); return }
      clearInterval(id)
      if (step + 1 < STEPS.length) setStep(step + 1)
      else { setStep(null); nav('/') }
    }, 100)
    return () => clearInterval(id)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  if (step === null) return null
  const s = STEPS[step], last = step === STEPS.length - 1
  const onCommand = loc.pathname.startsWith('/command')
  return (
    <div role="dialog" aria-label={`${L(T.tour)} ${step + 1} / ${STEPS.length}`}
      className={`fixed inset-x-0 z-[1500] mx-auto max-w-[520px] px-3 ${onCommand ? 'bottom-4' : 'bottom-[calc(76px+env(safe-area-inset-bottom))]'}`}>
      <div className="rise overflow-hidden rounded-2xl bg-night/95 text-white shadow-[0_18px_50px_-15px_rgba(0,0,0,.7)] ring-1 ring-white/10 backdrop-blur">
        <div className="h-1 bg-white/10"><div className="h-full bg-[linear-gradient(90deg,#46e6cb,#f3c56b)] transition-[width] duration-100 ease-linear" style={{ width: `${(elapsed / STEP_MS) * 100}%` }} /></div>
        <div className="p-3.5">
          <div className="flex items-center gap-2">
            <span className="num rounded-full bg-white/10 px-2 py-0.5 text-[11.5px] font-semibold text-[#46e6cb]">{step + 1} / {STEPS.length}</span>
            <b className="min-w-0 flex-1 truncate text-[15.5px]">{L(s.title)}</b>
            <button onClick={() => setStep(null)} aria-label={L(T.exit)} className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10"><X size={16} /></button>
          </div>
          <p className="mt-1.5 text-[13.5px] leading-snug text-white/80">{L(s.text)}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <button onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-white/80 disabled:opacity-30"><ChevronLeft size={15} />{L(T.back)}</button>
            <button onClick={() => setPaused((p) => !p)} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold">{paused ? <Play size={13} /> : <Pause size={13} />}{paused ? L(T.play) : L(T.pause)}</button>
            <button onClick={() => { if (last) { setStep(null); nav('/') } else setStep(step + 1) }} className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#46e6cb] px-3.5 py-1.5 text-[13px] font-bold text-night">{last ? L(T.finish) : L(T.next)}<ChevronRight size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
