import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Aperture, ChevronDown, Loader2, MapPin, Pause, Play, Square, Volume2, WifiOff } from 'lucide-react'
import { Card, Eyebrow } from './ui'
import ExplainIn from './ExplainIn'
import { useLang } from '../lib/i18n'
import { classifyFrame, loadVision, visionCalibration, visionLabels } from '../lib/vision'
import { placeById, sculptureById } from '../lib/data'
import { speak, stopSpeaking } from '../lib/speech'
import { track } from '../lib/live'

/*
  Live lens: the AR step of the guide. The same on-device EfficientNet-B0 runs on the camera
  feed a few times a second; predictions are smoothed over time and a name is shown only once
  the same answer has held for several frames above the calibrated threshold, so the label does
  not flicker between guesses. When it is sure of the site but not the exact temple, it says so.
*/
const T = {
  start: { en: 'Start the live lens', kn: 'ಲೈವ್ ಲೆನ್ಸ್ ಆರಂಭಿಸಿ', hi: 'लाइव लेंस शुरू करें' },
  why: { en: 'The camera stays on this phone. Nothing is recorded or uploaded.', kn: 'ಕ್ಯಾಮೆರಾ ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ. ಏನನ್ನೂ ರೆಕಾರ್ಡ್ ಅಥವಾ ಅಪ್‌ಲೋಡ್ ಮಾಡುವುದಿಲ್ಲ.', hi: 'कैमरा इसी फ़ोन पर रहता है। कुछ भी रिकॉर्ड या अपलोड नहीं होता।' },
  searching: { en: 'Point at a sculpture or temple', kn: 'ಶಿಲ್ಪ ಅಥವಾ ದೇವಾಲಯದತ್ತ ತೋರಿಸಿ', hi: 'किसी मूर्ति या मंदिर की ओर करें' },
  hold: { en: 'Hold steady…', kn: 'ಸ್ಥಿರವಾಗಿ ಹಿಡಿಯಿರಿ…', hi: 'स्थिर रखें…' },
  atSite: { en: 'You are at', kn: 'ನೀವು ಇಲ್ಲಿದ್ದೀರಿ', hi: 'आप यहाँ हैं' },
  closer: { en: 'Get closer to one temple to name it', kn: 'ಹೆಸರಿಸಲು ಒಂದು ದೇವಾಲಯದ ಹತ್ತಿರ ಹೋಗಿ', hi: 'नाम के लिए किसी एक मंदिर के पास जाएँ' },
  story: { en: 'Full story', kn: 'ಪೂರ್ಣ ಕಥೆ', hi: 'पूरी कहानी' },
  listen: { en: 'Listen', kn: 'ಆಲಿಸಿ', hi: 'सुनें' },
  pause: { en: 'Freeze', kn: 'ನಿಲ್ಲಿಸಿ', hi: 'रोकें' },
  resume: { en: 'Resume', kn: 'ಮುಂದುವರಿಸಿ', hi: 'फिर शुरू' },
  denied: { en: 'Camera permission is off. Allow the camera for this site in your browser settings, or use a photo instead.', kn: 'ಕ್ಯಾಮೆರಾ ಅನುಮತಿ ಇಲ್ಲ. ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ನಲ್ಲಿ ಅನುಮತಿಸಿ, ಅಥವಾ ಫೋಟೋ ಬಳಸಿ.', hi: 'कैमरा की अनुमति बंद है। ब्राउज़र सेटिंग में अनुमति दें, या फ़ोटो इस्तेमाल करें।' },
  noCam: { en: 'No camera found on this device. Use a photo instead.', kn: 'ಈ ಸಾಧನದಲ್ಲಿ ಕ್ಯಾಮೆರಾ ಇಲ್ಲ. ಫೋಟೋ ಬಳಸಿ.', hi: 'इस डिवाइस पर कैमरा नहीं मिला। फ़ोटो इस्तेमाल करें।' },
  where: { en: 'Where it is', kn: 'ಎಲ್ಲಿದೆ', hi: 'कहाँ है' },
  knows: { en: 'Knows 25 sculptures and temples of Badami, Pattadakal and Aihole.', kn: 'ಬಾದಾಮಿ, ಪಟ್ಟದಕಲ್ಲು, ಐಹೊಳೆಯ 25 ಶಿಲ್ಪ ಮತ್ತು ದೇವಾಲಯಗಳನ್ನು ಗುರುತಿಸುತ್ತದೆ.', hi: 'बादामी, पट्टदकल और ऐहोल की 25 मूर्तियाँ और मंदिर पहचानता है।' },
}
const LOCK_FRAMES = 3, EMA = 0.45
// The reticle: a square 58% of the view's width, centred 33% down, clear of the label card below.
// The model sees exactly that square of the camera frame.
const RET = { size: 0.58, cy: 0.33 }

type View = { kind: 'searching' | 'holding' } | { kind: 'site'; place: string; p: number } | { kind: 'locked'; id: string; p: number }

export default function LiveLens() {
  const { lang, L } = useLang()
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'denied' | 'nocam' | 'error'>('idle')
  const [view, setView] = useState<View>({ kind: 'searching' })
  const [paused, setPaused] = useState(false)
  const [ms, setMs] = useState(0)
  const [open, setOpen] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const pausedRef = useRef(false); pausedRef.current = paused

  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); stopSpeaking() }, [])

  async function start() {
    setState('starting')
    try {
      const [s] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false }),
        loadVision(),
      ])
      stream.current = s
      const v = video.current!
      v.srcObject = s; await v.play()
      setState('live')
    } catch (e) {
      const name = (e as DOMException)?.name
      setState(name === 'NotAllowedError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocam' : 'error')
    }
  }

  // Recognition loop on a timer (not requestAnimationFrame, which background tabs suspend)
  useEffect(() => {
    if (state !== 'live') return
    let alive = true, timer = 0
    let smooth: Float32Array | null = null, lastId = '', streak = 0, locked = ''
    const c = document.createElement('canvas'); c.width = 256; c.height = 256
    const g = c.getContext('2d', { willReadFrequently: true })!
    const labels = visionLabels(), cal = visionCalibration()
    const tick = async () => {
      if (!alive) return
      const v = video.current
      if (pausedRef.current || document.hidden || !v || v.readyState < 2) { timer = window.setTimeout(tick, 300); return }
      // the 3:4 view shows the frame with object-fit: cover; map the on-screen reticle back to frame pixels
      const vw = v.videoWidth, vh = v.videoHeight, dw = Math.min(vw, vh * 3 / 4), dh = Math.min(vh, vw * 4 / 3)
      const side = RET.size * dw, sx = (vw - dw) / 2 + (dw - side) / 2, sy = (vh - dh) / 2 + dh * RET.cy - side / 2
      g.drawImage(v, sx, Math.max(0, sy), side, side, 0, 0, 256, 256)
      const t0 = performance.now()
      const p = await classifyFrame(c)
      setMs(Math.round(performance.now() - t0))
      smooth = smooth ? smooth.map((x, i) => x * (1 - EMA) + p[i] * EMA) : Float32Array.from(p)
      const order = Array.from(smooth.keys()).sort((a, b) => smooth![b] - smooth![a])
      const [i0, i1] = order, top = labels[i0], p0 = smooth[i0], margin = p0 - smooth[i1]
      streak = top === lastId ? streak + 1 : 1; lastId = top
      const sure = p0 >= cal.min_prob && margin >= cal.min_margin
      if (sure && streak >= LOCK_FRAMES) {
        if (locked !== top) { locked = top; navigator.vibrate?.(25); track({ kind: 'scan', key: top, lang }) }
        setView({ kind: 'locked', id: top, p: p0 })
      } else if (locked && top === locked && p0 >= cal.min_prob * 0.75) {
        setView({ kind: 'locked', id: locked, p: p0 })  // hysteresis: keep the label through small wobbles
      } else {
        locked = ''
        // sure of the site, not of the temple: the three best answers are all at one site
        const site = sculptureById[top]?.place
        const mass = order.slice(0, 3).filter((i) => sculptureById[labels[i]]?.place === site).reduce((s, i) => s + smooth![i], 0)
        if (site && mass >= 0.6 && order.slice(0, 3).every((i) => sculptureById[labels[i]]?.place === site)) setView({ kind: 'site', place: site, p: mass })
        else setView({ kind: p0 >= cal.min_prob * 0.6 ? 'holding' : 'searching' })
      }
      timer = window.setTimeout(tick, 120)
    }
    tick()
    return () => { alive = false; clearTimeout(timer) }
  }, [state, lang])

  useEffect(() => { setOpen(false); stopSpeaking(); setSpeaking(false) }, [view.kind === 'locked' ? view.id : view.kind])

  const s = view.kind === 'locked' ? sculptureById[view.id] : null
  const place = s ? placeById[s.place] : view.kind === 'site' ? placeById[view.place] : null
  const firstLine = (t?: string) => (t ?? '').split(/(?<=[.।])\s/)[0]
  const lockedCol = view.kind === 'locked' ? '#f3c56b' : view.kind === 'site' ? '#46e6cb' : '#ffffffb0'

  function listen() {
    if (!s) return
    if (speaking) { stopSpeaking(); setSpeaking(false); return }
    setSpeaking(true); speak(`${L(s.name)}. ${L(s.text)}`, lang, () => setSpeaking(false))
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-night">
          <video ref={video} playsInline muted className={`h-full w-full object-cover ${state === 'live' ? '' : 'invisible'}`} />

          {state !== 'live' && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
              {state === 'idle' && (
                <div className="flex flex-col items-center gap-4">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10"><Aperture size={30} className="text-lamp" /></span>
                  <button onClick={start} className="rounded-full bg-lake px-5 py-3 text-[15.5px] font-semibold text-white">{L(T.start)}</button>
                  <p className="max-w-[260px] text-[13px] text-white/70">{L(T.why)}</p>
                </div>
              )}
              {state === 'starting' && <div className="flex items-center gap-2 text-[15px] font-semibold"><Loader2 className="animate-spin" size={18} />…</div>}
              {(state === 'denied' || state === 'nocam' || state === 'error') && <p className="max-w-[280px] text-[14.5px] text-white/90">{L(state === 'denied' ? T.denied : T.noCam)}</p>}
            </div>
          )}

          {state === 'live' && (
            <>
              {/* reticle: the part of the view the model looks at */}
              <svg viewBox="0 0 100 100" className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ top: `${RET.cy * 100}%`, width: `${RET.size * 100}%`, aspectRatio: '1' }} aria-hidden>
                {['M2 18V2h16', 'M82 2h16v16', 'M98 82v16H82', 'M18 98H2V82'].map((d) => (
                  <path key={d} d={d} fill="none" stroke={lockedCol} strokeLinecap="round" vectorEffect="non-scaling-stroke" className={view.kind === 'locked' ? 'lens-lock' : 'lens-breathe'} style={{ strokeWidth: view.kind === 'locked' ? 4 : 2.5 }} />
                ))}
              </svg>
              <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[12px] font-semibold text-white">
                <span className={`h-2 w-2 rounded-full ${paused ? 'bg-white/60' : 'live-dot bg-[#46e6cb]'}`} /><WifiOff size={12} /> On-device · <span className="num">{ms} ms</span>
              </div>
              <button onClick={() => setPaused((x) => !x)} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-[12.5px] font-semibold text-white" aria-pressed={paused}>
                {paused ? <Play size={13} /> : <Pause size={13} />}{paused ? L(T.resume) : L(T.pause)}
              </button>

              {/* AR callout: anchored to the reticle's top edge by a leader line */}
              {s && (
                <div className="lens-callout pointer-events-none absolute left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-gradient-to-b from-lamp to-lamp/40"
                  style={{ top: `calc(${RET.cy * 100}% + ${RET.size * 50 * 0.75}%)`, bottom: 'calc(0.75rem + 150px)' }}>
                  <span className="absolute -left-[4.5px] -top-1.5 h-3 w-3 rounded-full border-2 border-white bg-lamp shadow" />
                </div>
              )}
              {s ? (
                <div className="lens-callout absolute inset-x-3 bottom-3">
                  <div className="rounded-2xl bg-white/95 p-3.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,.6)] backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{s.group}</div>
                        <div className="display text-[21px] leading-tight text-ink">{L(s.name)}</div>
                      </div>
                      <div className="num shrink-0 text-[18px] font-bold text-lake">{Math.round((view as { p: number }).p * 100)}%</div>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-ink-2">{firstLine(L(s.text))}</p>
                    <div className="mt-2.5 flex gap-2">
                      <button onClick={listen} className="inline-flex items-center gap-1.5 rounded-full bg-lake px-3.5 py-1.5 text-[13.5px] font-semibold text-white">{speaking ? <Square size={13} /> : <Volume2 size={14} />}{L(T.listen)}</button>
                      <button onClick={() => { setPaused(true); setOpen(true) }} className="inline-flex items-center gap-1 rounded-full border border-line px-3.5 py-1.5 text-[13.5px] font-semibold text-ink">{L(T.story)}<ChevronDown size={14} /></button>
                    </div>
                  </div>
                </div>
              ) : view.kind === 'site' && place ? (
                <div className="lens-callout absolute inset-x-3 bottom-3 rounded-2xl bg-night/85 p-3.5 text-white backdrop-blur">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#46e6cb]">{L(T.atSite)}</div>
                  <div className="display text-[19px] leading-tight">{L(place.name)}</div>
                  <div className="mt-0.5 text-[13px] text-white/75">{L(T.closer)}</div>
                </div>
              ) : (
                <div className="absolute inset-x-0 bottom-4 text-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3.5 py-2 text-[13.5px] font-semibold text-white">
                    {view.kind === 'holding' && <Loader2 size={14} className="animate-spin" />}{L(view.kind === 'holding' ? T.hold : T.searching)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {open && s && (
        <Card className="rise p-4">
          <Eyebrow>{s.group}</Eyebrow>
          <h2 className="display mt-1 text-[26px] leading-[1.1]">{L(s.name)}</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-ink">{L(s.text)}</p>
          <ExplainIn className="mt-4" title={s.name} body={[s.text]} />
          {place && <Link to={`/place/${place.id}`} className="mt-3 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[14px] font-semibold"><MapPin size={16} className="text-lake" />{L(T.where)}: {L(place.name)}</Link>}
        </Card>
      )}
      <p className="px-1 text-[12.5px] text-ink-3">{L(T.knows)}</p>
    </div>
  )
}
