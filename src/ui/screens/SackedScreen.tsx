import { Icon } from '../components/Icon'
import { useT } from '../LanguageContext'
import { Kit, Stars } from '../components/bits'
import type { GameState } from '../../game/types'

export function SackedScreen({ state, onTakeJob, onNewGame }: { state: GameState; onTakeJob(id: string): void; onNewGame(): void }) {
  const { t } = useT()
  if (state.career.kind !== 'sacked') return null
  const div = (id: string) => (state.divisions[0].clubIds.includes(id) ? 1 : 2)
  return (
    <div className="sacked card">
      <h2><Icon name="briefcase" /> {t('career.sackedTitle', { club: state.clubs[state.userClubId].name })}</h2>
      <p>{t('career.sackedBody')}</p>
      <h3>{t('career.offers')}</h3>
      <div className="club-grid">
        {state.career.offers.map((id) => {
          const c = state.clubs[id]
          return (
            <button key={id} className="club-card" onClick={() => onTakeJob(id)}>
              <Kit colors={c.colors} />
              <span className="club-name">{c.name}</span>
              <span className="muted small">{t('common.division', { n: div(id) })}</span>
              <Stars value={c.reputation} />
            </button>
          )
        })}
      </div>
      <button className="link" onClick={onNewGame}>{t('career.newGame')}</button>
    </div>
  )
}
