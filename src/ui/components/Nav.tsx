import { useRef, useState } from 'react'
import { useT } from '../LanguageContext'
import { Icon, type IconName } from './Icon'

export type Tab = 'home' | 'squad' | 'tactics' | 'transfers' | 'inbox' | 'club' | 'youth' | 'table' | 'fixtures' | 'settings'

const MAIN: Array<[Tab, IconName]> = [['home', 'home'], ['squad', 'squad'], ['tactics', 'tactics'], ['transfers', 'transfers']]
const EXTRA: Array<[Tab, IconName]> = [['inbox', 'news'], ['club', 'stadium'], ['youth', 'youth'], ['table', 'table'], ['fixtures', 'fixtures'], ['settings', 'settings']]

/** A side list on wide screens. On phones the extra screens fold behind More. */
export function Nav({ tab, badges, onTab }: { tab: Tab; badges: Partial<Record<Tab, number>>; onTab(t: Tab): void }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const moreRef = useRef<HTMLButtonElement>(null)
  const waiting = EXTRA.reduce((n, [id]) => n + (badges[id] ?? 0), 0)
  const badge = (n = 0) => n > 0 && <span className="badge" aria-label={t('nav.waiting', { n })}>{n}</span>
  const item = ([id, icon]: [Tab, IconName]) => (
    <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => { setOpen(false); onTab(id) }}>
      <Icon name={icon} />
      <span className="label">{t(`nav.${id}`)}</span>
      {badge(badges[id])}
    </button>
  )
  return (
    <nav className={`nav ${open ? 'open' : ''}`} aria-label={t('nav.main')} onKeyDown={(e) => { if (open && e.key === 'Escape') { setOpen(false); moreRef.current?.focus() } }}>
      {MAIN.map(item)}
      <button ref={moreRef} className={`nav-more ${EXTRA.some(([id]) => id === tab) ? 'on' : ''}`} aria-expanded={open} aria-controls="nav-extra" onClick={() => setOpen(!open)}>
        <Icon name="more" />
        <span className="label">{t('nav.more')}</span>
        {badge(waiting)}
      </button>
      <div className="nav-back" onClick={() => setOpen(false)} />
      <div className="nav-extra" id="nav-extra">{EXTRA.map(item)}</div>
    </nav>
  )
}
