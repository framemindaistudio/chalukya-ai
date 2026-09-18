import { useEffect, useState } from 'react'

/*
  Boot sequence (every fresh load): a Chalukyan vimana draws itself in gold against a dawn sky,
  the Kannada wordmark rises, and the three great sites light up in order along the Malaprabha.
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
        <svg viewBox="0 0 220 190" className="boot-temple" fill="none" stroke="#f3c56b" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
          <path className="d1" d="M110 8 V20" />
          <path className="d1" d="M103 26 a7 6 0 0 1 14 0 v4 h-14 z" />
          <path className="d2" d="M88 58 C88 40 98 31 110 30 C122 31 132 40 132 58 Z" />
          <path className="d2" d="M110 31 V58 M99 36 C96 44 95 50 95 58 M121 36 C124 44 125 50 125 58" />
          <path className="d3" d="M92 58 h36 v10 h-36 z" />
          <path className="d3" d="M76 68 h68 v20 h-68 z M80 68 v-5 q4 -6 8 0 v5 M132 68 v-5 q4 -6 8 0 v5" />
          <path className="d4" d="M62 88 h96 v24 h-96 z M66 88 v-6 q5 -7 10 0 v6 M144 88 v-6 q5 -7 10 0 v6 M100 112 v-12 a10 10 0 0 1 20 0 v12" />
          <path className="d4" d="M50 112 h120 v26 h-120 z M60 112 v26 M72 112 v26 M148 112 v26 M160 112 v26" />
          <path className="d5" d="M98 138 V124 Q110 112 122 124 V138" />
          <path className="d5" d="M40 138 h140 v8 h-140 z M32 146 h156 v10 h-156 z" />
          <path className="d6" d="M10 170 C60 160 90 176 130 166 S 190 158 210 164" stroke="#46e6cb" strokeWidth="2" opacity=".8" />
        </svg>
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
