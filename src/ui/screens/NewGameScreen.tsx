import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Crest } from '../components/Crest'
import { useT } from '../LanguageContext'
import { CLUBS } from '../../game/data/clubs'
import { SLOTS } from '../../save/storage'
import type { GameApi } from '../useGame'
import { Stars } from '../components/bits'

export function NewGameScreen({ game, onBack }: { game: GameApi; onBack(): void }) {
  const { t } = useT()
  const [clubId, setClubId] = useState<string | null>(null)
  const firstFree = SLOTS.find((s) => !game.saves.some((m) => m.slot === s)) ?? 1
  const [slot, setSlot] = useState<number>(firstFree)
  const groups = [
    { n: 1, clubs: CLUBS.filter((c) => c.kind === 'district') },
    { n: 2, clubs: CLUBS.filter((c) => c.kind === 'mukim') },
  ]
  return (
    <main className="newgame">
      <div className="row between">
        <button onClick={onBack}><Icon name="back" size={16} /> {t('common.back')}</button>
        <h1>{t('newgame.title')}</h1>
        <span />
      </div>
      {groups.map((g) => (
        <section key={g.n}>
          <h2>{t('common.division', { n: g.n })}</h2>
          <div className="club-grid">
            {g.clubs.map((c) => (
              <button key={c.id} className={`club-card ${clubId === c.id ? 'selected' : ''}`} aria-pressed={clubId === c.id} onClick={() => setClubId(c.id)}>
                <Crest club={c} size={52} />
                <span className="club-name">{c.name}</span>
                <span className="muted small">{c.district}</span>
                <Stars value={c.reputation} />
              </button>
            ))}
          </div>
        </section>
      ))}
      <div className="sticky-bar">
        {game.storageOk && (
          <label>
            {t('newgame.slot')}{' '}
            <select value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
              {SLOTS.map((s) => {
                const m = game.saves.find((x) => x.slot === s)
                return <option key={s} value={s}>{t('start.slot', { n: s })} · {m ? m.clubId : t('start.empty')}</option>
              })}
            </select>
          </label>
        )}
        <button className="primary" disabled={!clubId} onClick={() => clubId && game.startNew(Date.now() % 2 ** 31, clubId, slot)}>
          {t('newgame.start')}
        </button>
      </div>
    </main>
  )
}
