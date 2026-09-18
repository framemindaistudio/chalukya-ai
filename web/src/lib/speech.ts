import type { Lang } from './i18n'

/*
  Voice in: the browser's speech recogniser (kn-IN / hi-IN / en-IN). Voice out: the phone's own
  text-to-speech voices, picking one for the reply language. Android phones ship Kannada and Hindi
  voices; if a device has none, the backend's offline Kannada/Hindi TTS (Meta MMS) is used when available.
*/
const SPEECH_LANG: Record<Lang, string> = { kn: 'kn-IN', hi: 'hi-IN', en: 'en-IN' }

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null }
export const canListen = () => typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

export function listen(lang: Lang, onText: (t: string, final: boolean) => void, onEnd: (err?: string) => void) {
  const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!C) { onEnd('unsupported'); return () => {} }
  const r: Rec = new C()
  r.lang = SPEECH_LANG[lang]; r.interimResults = true; r.continuous = false
  r.onresult = (e) => {
    let txt = '', fin = false
    for (let i = e.resultIndex; i < e.results.length; i++) { txt += e.results[i][0].transcript; fin = fin || e.results[i].isFinal }
    onText(txt, fin)
  }
  r.onerror = (e) => onEnd(e?.error ?? 'error')
  r.onend = () => onEnd()
  try { r.start() } catch { onEnd('busy') }
  return () => { try { r.stop() } catch { /* already stopped */ } }
}

let voices: SpeechSynthesisVoice[] = []
if (typeof speechSynthesis !== 'undefined') {
  const load = () => { voices = speechSynthesis.getVoices() }
  load(); speechSynthesis.onvoiceschanged = load
}
export function hasVoice(lang: Lang) {
  return voices.some((v) => v.lang.toLowerCase().startsWith(lang)) || lang === 'en'
}

let audio: HTMLAudioElement | null = null
export async function speak(text: string, lang: Lang, onDone?: () => void) {
  stopSpeaking()
  const voice = voices.find((v) => v.lang.toLowerCase() === SPEECH_LANG[lang].toLowerCase()) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang))
  if (voice || lang === 'en') {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = SPEECH_LANG[lang]; if (voice) u.voice = voice
    u.rate = lang === 'en' ? 1 : 0.95
    u.onend = () => onDone?.(); u.onerror = () => onDone?.()
    speechSynthesis.speak(u)
    return true
  }
  try { // server-side offline TTS
    const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, lang }), signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw new Error()
    audio = new Audio(URL.createObjectURL(await r.blob()))
    audio.onended = () => onDone?.()
    await audio.play()
    return true
  } catch { onDone?.(); return false }
}
export function stopSpeaking() {
  try { speechSynthesis.cancel() } catch { /* no tts */ }
  if (audio) { audio.pause(); audio = null }
}
