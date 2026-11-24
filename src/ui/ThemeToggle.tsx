import { useState } from 'react'
import { useT } from './LanguageContext'

const KEY = 'bola-daerah.theme'
const THEMES = ['auto', 'light', 'dark'] as const
type Theme = (typeof THEMES)[number]

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function apply(theme: Theme) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

/** Call before the first paint. */
export const initTheme = () => apply(readTheme())

export function ThemeToggle() {
  const { t } = useT()
  const [theme, setTheme] = useState(readTheme)
  const pick = (next: Theme) => {
    setTheme(next)
    apply(next)
    try { localStorage.setItem(KEY, next) } catch { /* per-viewer convenience only */ }
  }
  return (
    <div className="lang-toggle" role="group" aria-label={t('settings.theme')}>
      {THEMES.map((x) => <button key={x} className={theme === x ? 'on' : ''} aria-pressed={theme === x} onClick={() => pick(x)}>{t(`theme.${x}`)}</button>)}
    </div>
  )
}
