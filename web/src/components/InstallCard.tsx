import { useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import LogoMark from './LogoMark'
import { useLang } from '../lib/i18n'
import { promptInstall, useInstall } from '../lib/install'

const T = {
  title: { en: 'Install Chalukya AI', kn: 'ಚಾಲುಕ್ಯ AI ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡಿ', hi: 'चालुक्य AI इंस्टॉल करें' },
  sub: { en: 'One tap from your home screen, and it keeps working inside the caves with no signal.', kn: 'ಹೋಮ್ ಸ್ಕ್ರೀನ್‌ನಿಂದ ಒಂದೇ ಟ್ಯಾಪ್; ಸಿಗ್ನಲ್ ಇಲ್ಲದ ಗುಹೆಯೊಳಗೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ.', hi: 'होम स्क्रीन से एक टैप, और बिना सिग्नल वाली गुफाओं में भी चलता है।' },
  install: { en: 'Install', kn: 'ಇನ್‌ಸ್ಟಾಲ್', hi: 'इंस्टॉल' },
  ios: { en: 'Tap Share, then “Add to Home Screen”.', kn: 'ಶೇರ್ ಒತ್ತಿ, ನಂತರ “Add to Home Screen”.', hi: 'शेयर दबाएँ, फिर “Add to Home Screen”।' },
  close: { en: 'Not now', kn: 'ಈಗ ಬೇಡ', hi: 'अभी नहीं' },
}
const KEY = 'chalukya.installDismissed'

export default function InstallCard() {
  const { L } = useLang()
  const { canPrompt, iosHint } = useInstall()
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })
  if (hidden || (!canPrompt && !iosHint)) return null
  const dismiss = () => { setHidden(true); try { localStorage.setItem(KEY, '1') } catch { /* storage off */ } }
  return (
    <div className="card rise flex items-center gap-3 p-3.5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-paper shadow-[0_2px_10px_rgba(0,0,0,.12)] ring-1 ring-line"><LogoMark className="h-8 w-auto" title="" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold leading-tight">{L(T.title)}</div>
        <div className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{iosHint && !canPrompt ? <><Share size={12} className="-mt-0.5 mr-1 inline" />{L(T.ios)}</> : L(T.sub)}</div>
      </div>
      {canPrompt && (
        <button onClick={async () => { if (await promptInstall()) dismiss() }} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-lake px-3.5 py-2 text-[13.5px] font-semibold text-white">
          <Download size={15} />{L(T.install)}
        </button>
      )}
      <button onClick={dismiss} aria-label={L(T.close)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-mist"><X size={16} /></button>
    </div>
  )
}
