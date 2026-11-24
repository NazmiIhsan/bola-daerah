import { useT } from '../LanguageContext'
import type { SeasonSummary as Summary } from '../../game/season'
import type { GameState } from '../../game/types'
import { ClubLabel } from './bits'
import { Icon } from './Icon'
import { useModal } from './useModal'

export function SeasonSummary({ state: s, summary: sum, onClose }: { state: GameState; summary: Summary & { season: number }; onClose(): void }) {
  const { t } = useT()
  const modal = useModal(onClose)
  return (
    <div className="modal-back">
      <div className="modal" {...modal} aria-label={t('season.summary', { season: sum.season })}>
        <h2>{t('season.summary', { season: sum.season })}</h2>
        <p><strong>{t('season.champions')}:</strong> {t('common.division', { n: 1 })} <ClubLabel state={s} id={sum.champions[0]} /> · {t('common.division', { n: 2 })} <ClubLabel state={s} id={sum.champions[1]} /></p>
        <p><strong><Icon name="up" size={16} /> {t('season.promoted')}:</strong> {sum.promoted.map((id) => <ClubLabel key={id} state={s} id={id} />)}</p>
        <p><strong><Icon name="down" size={16} /> {t('season.relegated')}:</strong> {sum.relegated.map((id) => <ClubLabel key={id} state={s} id={id} />)}</p>
        <button className="primary" onClick={onClose}>{t('common.continue')}</button>
      </div>
    </div>
  )
}
