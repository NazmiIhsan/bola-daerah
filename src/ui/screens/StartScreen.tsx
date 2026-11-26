import { useRef, useState } from 'react'
import { useT, LanguageToggle } from '../LanguageContext'
import { importSave, SLOTS } from '../../save/storage'
import type { GameApi } from '../useGame'
import { CLUBS } from '../../game/data/clubs'
import { Crest } from '../components/Crest'
import { Icon } from '../components/Icon'

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })
}

export function StartScreen({ game, onNew }: { game: GameApi; onNew(): void }) {
  const { t } = useT()
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const clubName = (id: string) => CLUBS.find((c) => c.id === id)?.name ?? id

  async function onFile(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      const state = importSave(await readText(file))
      const free = SLOTS.find((s) => !game.saves.some((m) => m.slot === s))
      if (free === undefined && !window.confirm(t('start.overwrite', { n: 1 }))) {
        if (fileRef.current) fileRef.current.value = ''
        return
      }
      game.openImported(state, free ?? 1)
    } catch {
      setError(t('start.importError'))
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const club = (id: string) => CLUBS.find((c) => c.id === id)
  const [latest, ...older] = [...game.saves].sort((a, b) => b.savedAt - a.savedAt)
  const ticker = CLUBS.map((c) => c.name).join(' · ')

  return (
    <main className="start poster">
      <div className="poster-stripes" aria-hidden />
      <div className="start-card">
        <div className="start-top"><span className="poster-badge">{t('start.badge')}</span><LanguageToggle /></div>
        <div className="poster-title">
          <h1>{t('app.title')}</h1>
          <p className="poster-sub">{t('app.tagline')}</p>
          <div className="poster-crests" aria-hidden>
            {CLUBS.filter((c) => c.kind === 'district').map((c) => <Crest key={c.id} club={c} size={30} />)}
          </div>
        </div>
        <div className="poster-bottom">
          <div className="poster-ticker" aria-hidden><span>{[0, 1].map((i) => <span key={i} className="pt-run"><Icon name="star" size={12} /> {ticker} </span>)}</span></div>
          {!game.storageOk && <p className="banner warn">{t('storage.unavailable')}</p>}
          {latest && club(latest.clubId) && (
            <button className="poster-continue" onClick={() => void game.loadSlot(latest.slot)}>
              <Crest club={club(latest.clubId)!} size={40} />
              <span className="pc-text">
                <strong>{clubName(latest.clubId)}</strong>
                <span className="small">{t('common.season', { season: latest.season })} · {t('common.matchday', { n: latest.matchday })} · {t('start.slot', { n: latest.slot })}</span>
              </span>
              <span className="pc-go">{t('start.continue')}</span>
            </button>
          )}
          <button className="poster-new" onClick={onNew}>{t('start.new')}</button>
          {older.length > 0 && (
            <section className="slots" aria-label={t('start.load')}>
              {older.map((m) => (
                <button key={m.slot} className="slot" onClick={() => void game.loadSlot(m.slot)}>
                  <strong>{t('start.slot', { n: m.slot })}</strong>
                  <span>{t('start.slotInfo', { club: clubName(m.clubId), season: m.season, matchday: m.matchday })}</span>
                </button>
              ))}
            </section>
          )}
          <label className="file-btn">
            {t('start.import')}
            <input ref={fileRef} type="file" accept=".json,application/json" aria-label={t('start.import')} onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          {error && <p className="banner error" role="alert">{error}</p>}
        </div>
      </div>
    </main>
  )
}
