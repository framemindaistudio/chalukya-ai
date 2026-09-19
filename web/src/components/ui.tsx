import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { LEVEL_COLOR, type Level } from '../lib/crowd'
import { useLang } from '../lib/i18n'

export function Card({ children, className = '', ref, ...rest }: { children: ReactNode; className?: string; ref?: React.Ref<HTMLDivElement> } & React.HTMLAttributes<HTMLDivElement>) {
  return <div ref={ref} className={`card ${className}`} {...rest}>{children}</div>
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3 ${className}`}>{children}</div>
}

export function Chip({ active, onClick, children, className = '' }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition ${active ? 'border-lake bg-lake text-white' : 'border-line bg-paper text-ink-2 hover:border-lake/50'} ${className}`}>
      {children}
    </button>
  )
}

export function LevelBadge({ level, className = '' }: { level: Level; className?: string }) {
  const { t } = useLang()
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12.5px] font-semibold ${className}`} style={{ background: LEVEL_COLOR[level] + '1f', color: LEVEL_COLOR[level] }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: LEVEL_COLOR[level] }} />
      {t(level)}
    </span>
  )
}

export function PageHead({ title, sub, back = '/' }: { title: string; sub?: string; back?: string | false }) {
  const { t } = useLang()
  return (
    <header className="px-4 pb-3 pt-4">
      {back !== false && (
        <Link to={back} className="-ml-1 mb-2 inline-flex items-center gap-0.5 text-[14px] font-medium text-lake">
          <ChevronLeft size={18} />{t('back')}
        </Link>
      )}
      <h1 className="display text-[30px] leading-[1.1] text-ink">{title}</h1>
      {sub && <p className="mt-1 text-[15px] text-ink-2">{sub}</p>}
    </header>
  )
}

export function DemoTag({ className = '' }: { className?: string }) {
  const { t } = useLang()
  return <span title="Prices, ratings and hours are simulated for this prototype. Names and locations are real (OpenStreetMap)." className={`rounded bg-lamp-soft px-1.5 py-0.5 text-[11px] font-semibold text-[#8a6412] ${className}`}>{t('demoData')}</span>
}

export function Meter({ value, max, color = '#1f5e57' }: { value: number; max: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-mist" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
