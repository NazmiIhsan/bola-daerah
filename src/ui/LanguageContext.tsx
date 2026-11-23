import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { t as translate, type Lang } from '../i18n'

const KEY = 'bola-daerah.lang'
const readLang = (): Lang => {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : localStorage.getItem(KEY) === 'ms' ? 'ms' : 'en'
  } catch {
    return 'en'
  }
}

export const LanguageContext = createContext<{ lang: Lang; setLang(l: Lang): void }>({ lang: 'en', setLang: () => {} })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(KEY, l) } catch { /* per-viewer convenience only */ }
    document.documentElement.lang = l
  }, [])
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useT() {
  const { lang, setLang } = useContext(LanguageContext)
  const t = useCallback((key: string, params?: Record<string, string | number>) => translate(lang, key, params), [lang])
  return { t, lang, setLang }
}

export function LanguageToggle() {
  const { lang, setLang } = useT()
  return (
    <div className="lang-toggle" role="group" aria-label="Language / Bahasa">
      <button className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
      <button className={lang === 'ms' ? 'on' : ''} aria-pressed={lang === 'ms'} onClick={() => setLang('ms')}>BM</button>
    </div>
  )
}
