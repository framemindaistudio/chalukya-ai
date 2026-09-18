import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'kn' | 'hi'
export type Tri = { en: string; kn?: string; hi?: string }

export const LANGS: { id: Lang; label: string; speech: string }[] = [
  { id: 'kn', label: 'ಕನ್ನಡ', speech: 'kn-IN' },
  { id: 'hi', label: 'हिन्दी', speech: 'hi-IN' },
  { id: 'en', label: 'English', speech: 'en-IN' },
]

// UI strings. Content strings (places, sculptures) live in the knowledge base with their own translations.
const S = {
  appName: { en: 'Chalukya AI', kn: 'ಚಾಲುಕ್ಯ AI', hi: 'चालुक्य AI' },
  tagline: { en: 'Your guide to Badami, Pattadakal & Aihole', kn: 'ಬಾದಾಮಿ, ಪಟ್ಟದಕಲ್ಲು, ಐಹೊಳೆಗೆ ನಿಮ್ಮ ಮಾರ್ಗದರ್ಶಿ', hi: 'बादामी, पट्टदकल और ऐहोल के लिए आपका गाइड' },
  greetMorning: { en: 'Good morning', kn: 'ಶುಭೋದಯ', hi: 'सुप्रभात' },
  greetAfternoon: { en: 'Good afternoon', kn: 'ಶುಭ ಮಧ್ಯಾಹ್ನ', hi: 'नमस्कार' },
  greetEvening: { en: 'Good evening', kn: 'ಶುಭ ಸಂಜೆ', hi: 'शुभ संध्या' },
  whereTo: { en: 'Where are you headed today?', kn: 'ಇಂದು ಎಲ್ಲಿಗೆ ಹೊರಟಿದ್ದೀರಿ?', hi: 'आज कहाँ जा रहे हैं?' },
  circuit: { en: 'The Chalukya circuit, right now', kn: 'ಚಾಲುಕ್ಯ ಸರ್ಕ್ಯೂಟ್, ಈ ಕ್ಷಣ', hi: 'चालुक्य सर्किट, अभी' },
  circuitNote: { en: 'Crowd from the forecast model · parking from sensors', kn: 'ಜನಸಂದಣಿ ಮುನ್ಸೂಚನೆ ಮಾದರಿಯಿಂದ · ಪಾರ್ಕಿಂಗ್ ಸೆನ್ಸರ್‌ಗಳಿಂದ', hi: 'भीड़ पूर्वानुमान मॉडल से · पार्किंग सेंसर से' },
  scan: { en: 'Scan a sculpture', kn: 'ಶಿಲ್ಪವನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ', hi: 'मूर्ति स्कैन करें' },
  scanSub: { en: 'Point your camera. Works offline.', kn: 'ಕ್ಯಾಮೆರಾ ತೋರಿಸಿ. ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದೆಯೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ.', hi: 'कैमरा दिखाइए। बिना इंटरनेट भी चलता है।' },
  ask: { en: 'Ask the guide', kn: 'ಮಾರ್ಗದರ್ಶಿಯನ್ನು ಕೇಳಿ', hi: 'गाइड से पूछें' },
  askSub: { en: 'Speak in Kannada, Hindi or English', kn: 'ಕನ್ನಡ, ಹಿಂದಿ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಮಾತನಾಡಿ', hi: 'कन्नड़, हिंदी या अंग्रेज़ी में बोलिए' },
  navScan: { en: 'Scan', kn: 'ಸ್ಕ್ಯಾನ್', hi: 'स्कैन' },
  navAsk: { en: 'Ask', kn: 'ಕೇಳಿ', hi: 'पूछें' },
  plan: { en: 'Plan', kn: 'ಯೋಜನೆ', hi: 'योजना' },
  planTrip: { en: 'Plan my trip', kn: 'ನನ್ನ ಪ್ರವಾಸ ಯೋಜಿಸಿ', hi: 'मेरी यात्रा की योजना' },
  stay: { en: 'Stay', kn: 'ವಸತಿ', hi: 'ठहरें' },
  food: { en: 'Food', kn: 'ಊಟ', hi: 'खाना' },
  parking: { en: 'Parking', kn: 'ಪಾರ್ಕಿಂಗ್', hi: 'पार्किंग' },
  safety: { en: 'Safety', kn: 'ಸುರಕ್ಷತೆ', hi: 'सुरक्षा' },
  local: { en: 'Local', kn: 'ಸ್ಥಳೀಯ', hi: 'स्थानीय' },
  home: { en: 'Home', kn: 'ಮುಖಪುಟ', hi: 'होम' },
  sos: { en: 'SOS', kn: 'SOS', hi: 'SOS' },
  explore: { en: 'Explore', kn: 'ಅನ್ವೇಷಿಸಿ', hi: 'घूमें' },
  bestTimeToday: { en: 'Best time today', kn: 'ಇಂದು ಉತ್ತಮ ಸಮಯ', hi: 'आज सबसे अच्छा समय' },
  quietest: { en: 'Quietest', kn: 'ಅತ್ಯಂತ ಶಾಂತ', hi: 'सबसे शांत' },
  busiest: { en: 'Busiest', kn: 'ಅತಿ ಹೆಚ್ಚು ಜನ', hi: 'सबसे व्यस्त' },
  expected: { en: 'Expected visitors', kn: 'ನಿರೀಕ್ಷಿತ ಪ್ರವಾಸಿಗರು', hi: 'अपेक्षित पर्यटक' },
  free: { en: 'free', kn: 'ಖಾಲಿ', hi: 'खाली' },
  slotsFree: { en: 'slots free', kn: 'ಸ್ಥಳ ಖಾಲಿ', hi: 'जगह खाली' },
  closedNow: { en: 'Closed now', kn: 'ಈಗ ಮುಚ್ಚಿದೆ', hi: 'अभी बंद' },
  opensAt6: { en: 'Opens around 6 AM', kn: 'ಬೆಳಿಗ್ಗೆ ಸುಮಾರು 6ಕ್ಕೆ ತೆರೆಯುತ್ತದೆ', hi: 'सुबह लगभग 6 बजे खुलता है' },
  low: { en: 'Quiet', kn: 'ಶಾಂತ', hi: 'शांत' },
  moderate: { en: 'Moderate', kn: 'ಮಧ್ಯಮ', hi: 'मध्यम' },
  busy: { en: 'Busy', kn: 'ಜನಸಂದಣಿ', hi: 'व्यस्त' },
  packed: { en: 'Packed', kn: 'ತುಂಬಿದೆ', hi: 'भरा हुआ' },
  listen: { en: 'Listen', kn: 'ಆಲಿಸಿ', hi: 'सुनें' },
  stop: { en: 'Stop', kn: 'ನಿಲ್ಲಿಸಿ', hi: 'रोकें' },
  typeQuestion: { en: 'Type or tap the mic…', kn: 'ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮೈಕ್ ಒತ್ತಿ…', hi: 'लिखें या माइक दबाएँ…' },
  listening: { en: 'Listening…', kn: 'ಕೇಳುತ್ತಿದ್ದೇನೆ…', hi: 'सुन रहा हूँ…' },
  send: { en: 'Send', kn: 'ಕಳುಹಿಸಿ', hi: 'भेजें' },
  offline: { en: 'Offline mode: everything still works on this phone', kn: 'ಆಫ್‌ಲೈನ್: ಎಲ್ಲವೂ ಈ ಫೋನ್‌ನಲ್ಲೇ ಕೆಲಸ ಮಾಡುತ್ತದೆ', hi: 'ऑफ़लाइन: सब कुछ इसी फ़ोन पर चलता है' },
  demoData: { en: 'Demo data', kn: 'ಡೆಮೊ ಡೇಟಾ', hi: 'डेमो डेटा' },
  why: { en: 'Why this', kn: 'ಏಕೆ ಇದು', hi: 'यह क्यों' },
  nearby: { en: 'Nearby', kn: 'ಹತ್ತಿರದಲ್ಲಿ', hi: 'पास में' },
  openMap: { en: 'Directions', kn: 'ದಾರಿ', hi: 'रास्ता' },
  howAIWorks: { en: 'How the AI works', kn: 'AI ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ', hi: 'AI कैसे काम करता है' },
  commandCentre: { en: 'District command centre', kn: 'ಜಿಲ್ಲಾ ನಿಯಂತ್ರಣ ಕೇಂದ್ರ', hi: 'ज़िला कमांड सेंटर' },
  back: { en: 'Back', kn: 'ಹಿಂದೆ', hi: 'वापस' },
  today: { en: 'Today', kn: 'ಇಂದು', hi: 'आज' },
  tomorrow: { en: 'Tomorrow', kn: 'ನಾಳೆ', hi: 'कल' },
  km: { en: 'km', kn: 'ಕಿ.ಮೀ', hi: 'किमी' },
  min: { en: 'min', kn: 'ನಿಮಿಷ', hi: 'मिनट' },
}
export type Key = keyof typeof S

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string; L: (x?: Tri | null) => string }
const LangCtx = createContext<Ctx | null>(null)

function readLang(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (q === 'en' || q === 'kn' || q === 'hi') { localStorage.setItem('chalukya.lang', q); return q }
    const v = localStorage.getItem('chalukya.lang')
    if (v === 'en' || v === 'kn' || v === 'hi') return v
  } catch { /* storage blocked */ }
  return 'en'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)
  useEffect(() => { document.documentElement.lang = lang === 'kn' ? 'kn' : lang === 'hi' ? 'hi' : 'en' }, [lang])
  const value = useMemo<Ctx>(() => ({
    lang,
    setLang: (l) => { setLangState(l); try { localStorage.setItem('chalukya.lang', l) } catch { /* ignore */ } },
    t: (k) => (S[k] as Tri)[lang] ?? S[k].en,
    L: (x) => (x ? x[lang] ?? x.en : ''),
  }), [lang])
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}

export function useLang() {
  const c = useContext(LangCtx)
  if (!c) throw new Error('useLang outside provider')
  return c
}

export const pick = (x: Tri | undefined | null, lang: Lang) => (x ? x[lang] ?? x.en : '')
