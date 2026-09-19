import { NavLink, Outlet, useLocation } from 'react-router'
import LogoMark from './LogoMark'
import { Camera, Home, MessageCircle, Route, Siren } from 'lucide-react'
import { LANGS, useLang } from '../lib/i18n'
import { useEffect, useState } from 'react'

export function LangSwitch({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useLang()
  return (
    <div role="radiogroup" aria-label="Language" className={`flex rounded-full p-0.5 ${dark ? 'bg-white/10' : 'bg-lake-soft/70'}`}>
      {LANGS.map((l) => (
        <button key={l.id} role="radio" aria-checked={lang === l.id} onClick={() => setLang(l.id)}
          className={`rounded-full px-2.5 py-1 text-[13px] font-semibold transition ${lang === l.id ? (dark ? 'bg-white text-night' : 'bg-lake text-white') : dark ? 'text-white/70' : 'text-lake'}`}>
          {l.label}
        </button>
      ))}
    </div>
  )
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <NavLink to="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-white shadow-[0_2px_10px_rgba(0,0,0,.18)]"><LogoMark className="h-[21px] w-auto" title="" /></span>
      <span className="flex items-baseline gap-1.5">
        <span className={`brand text-[26px] leading-none transition-colors ${light ? 'text-white' : 'text-lake'}`}>ಚಾಲುಕ್ಯ</span>
        <span className={`text-[12.5px] font-bold tracking-[0.2em] transition-colors ${light ? 'text-lamp' : 'text-ink-2'}`}>AI</span>
        <span className="sr-only">, Chalukya AI home</span>
      </span>
    </NavLink>
  )
}

export default function Shell() {
  const { t } = useLang()
  const loc = useLocation()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 300)
    f(); window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])
  const overHero = loc.pathname === '/' && !scrolled
  const tabs = [
    { to: '/', icon: Home, label: t('home') },
    { to: '/scan', icon: Camera, label: t('navScan') },
    { to: '/ask', icon: MessageCircle, label: t('navAsk') },
    { to: '/plan', icon: Route, label: t('plan') },
  ]
  return (
    <div className="mx-auto min-h-dvh max-w-[520px] bg-mist">
      <header className={`sticky top-0 z-40 flex h-[57px] items-center justify-between px-4 transition-colors duration-300 ${overHero ? 'border-b border-transparent bg-transparent' : 'border-b border-line/70 bg-mist/90 backdrop-blur'}`}>
        <Wordmark light={overHero} />
        <LangSwitch dark={overHero} />
      </header>
      <main className="pb-28"><Outlet /></main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px] border-t border-line bg-paper/95 px-2 pt-1.5 backdrop-blur" aria-label="Main">
        <div className="grid grid-cols-5 items-end">
          {tabs.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11.5px] font-semibold ${isActive ? 'text-lake' : 'text-ink-3'}`}>
              {({ isActive }) => (<><Icon size={22} strokeWidth={isActive ? 2.4 : 1.9} /><span className="max-w-[72px] truncate">{label}</span></>)}
            </NavLink>
          ))}
          <NavLink to="/safety" className="flex flex-col items-center gap-0.5 py-1" aria-label="SOS and safety">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-sos text-white shadow-[0_6px_16px_-6px_rgba(215,38,61,0.8)]"><Siren size={21} /></span>
            <span className="text-[11px] font-bold text-sos">SOS</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
