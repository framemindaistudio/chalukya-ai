import { useEffect, useState } from 'react'
import LogoMark from './LogoMark'

/*
  Boot sequence (every fresh load): the Chalukya AI mark builds itself tier by tier in its app-icon tile
  against a dawn sky, the gold finial drops into place, the Kannada wordmark rises, and the three great sites light up in order along the Malaprabha.
  Exits on a timer (never requestAnimationFrame: background tabs pause rAF and would leave the
  page locked behind the curtain). Tap anywhere to skip. Reduced-motion users get a short fade.
*/
const TOTAL_MS = 2600, EXIT_MS = 650

export default function Boot() {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [phase, setPhase] = useState<'show' | 'exit' | 'gone'>('show')
  useEffect(() => {
    const total = reduced ? 700 : TOTAL_MS
    const t1 = setTimeout(() => setPhase('exit'), total)
    const t2 = setTimeout(() => setPhase('gone'), total + EXIT_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [reduced])
  if (phase === 'gone') return null
  const skip = () => { setPhase('exit'); setTimeout(() => setPhase('gone'), EXIT_MS) }

  return (
    <div onClick={skip} role="presentation" aria-hidden className={`boot ${phase === 'exit' ? 'boot-exit' : ''}`}>
      <div className="boot-sun" />
      <div className="boot-stars" />
      <div className="boot-center">
        <div className="boot-mark"><LogoMark /></div>
        <div className="boot-word">
          <span className="brand">ಚಾಲುಕ್ಯ</span><b>AI</b>
        </div>
        <div className="boot-route">
          <span className="r1">Badami</span><i /><span className="r2">Pattadakal</span><i /><span className="r3">Aihole</span>
        </div>
        <div className="boot-tag">Bagalkot's AI tourism companion</div>
      </div>
      <div className="boot-bar"><span /></div>
    </div>
  )
}
