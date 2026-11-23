import { useRef, useState } from 'react'
import { useT, LanguageToggle } from '../LanguageContext'
import { importSave, SLOTS } from '../../save/storage'
import type { GameApi } from '../useGame'
import { CLUBS } from '../../game/data/clubs'

export function StartScreen({ game, onNew }: { game: GameApi; onNew(): void }) {
  const { t } = useT()
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const clubName = (id: string) => CLUBS.find((c) => c.id === id)?.name ?? id

  async function onFile(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      const state = importSave(await file.text())
      const free = SLOTS.find((s) => !game.saves.some((m) => m.slot === s)) ?? 1
      game.openImported(state, free)
    } catch {
      setError(t('start.importError'))
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <main className="start">
      <div className="start-card">
        <div className="start-top"><LanguageToggle /></div>
        <div className="crest" aria-hidden>⚽</div>
        <h1>{t('app.title')}</h1>
        <p className="muted">{t('app.tagline')}</p>
        {!game.storageOk && <p className="banner warn">{t('storage.unavailable')}</p>}
        <button className="primary big" onClick={onNew}>{t('start.new')}</button>
        {game.saves.length > 0 && (
          <section className="slots">
            <h2>{t('start.load')}</h2>
            {game.saves.map((m) => (
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
    </main>
  )
}
