import { useT } from '../LanguageContext'
import type { SeasonSummary as Summary } from '../../game/season'
import type { GameState } from '../../game/types'
import { ClubLabel } from './bits'
import { Icon } from './Icon'
import { useModal } from './useModal'

export function SeasonSummary({ state: s, summary: sum, onClose }: { state: GameState; summary: Summary & { season: number }; onClose(): void }) {
  const { t } = useT()
  const modal = useModal(onClose)
  const record = s.history.find((r) => r.season === sum.season)
  return (
    <div className="modal-back">
      <div className="modal" {...modal} aria-label={t('season.summary', { season: sum.season })}>
        <h2>{t('season.summary', { season: sum.season })}</h2>
        <p><strong>{t('season.champions')}:</strong> {t('common.division', { n: 1 })} <ClubLabel state={s} id={sum.champions[0]} /> · {t('common.division', { n: 2 })} <ClubLabel state={s} id={sum.champions[1]} /></p>
        <p><strong><Icon name="up" size={16} /> {t('season.promoted')}:</strong> {sum.promoted.map((id) => <ClubLabel key={id} state={s} id={id} />)}</p>
        <p><strong><Icon name="down" size={16} /> {t('season.relegated')}:</strong> {sum.relegated.map((id) => <ClubLabel key={id} state={s} id={id} />)}</p>
        {record?.cup && <p><strong>{t('cup.winners')}</strong>: <ClubLabel state={s} id={record.cup.winnerId} /></p>}
        {record && (['goldenBoot', 'bestPlayer'] as const).map((k) => (
          <div key={k}>
            <strong>{t(`stats.${k}`)}</strong>
            {record[k].map((a, i) => a && <p key={i} className="small">{t('common.division', { n: i + 1 })}: {a.name} ({s.clubs[a.clubId]?.name ?? '—'}), {a.value}</p>)}
          </div>
        ))}
        <button className="primary" onClick={onClose}>{t('common.continue')}</button>
      </div>
    </div>
  )
}
