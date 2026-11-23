import { useT } from '../LanguageContext'
import type { GameState } from '../../game/types'
import { ClubLabel } from '../components/bits'

export function FixturesScreen({ state }: { state: GameState }) {
  const { t } = useT()
  const me = state.userClubId
  const div = state.divisions.find((d) => d.clubIds.includes(me))!.id
  const mine = state.fixtures.filter((f) => f.homeId === me || f.awayId === me)
  const rounds = Array.from({ length: 18 }, (_, i) => i + 1)
  return (
    <div className="card">
      <h2>{t('fixtures.title')} · {t('common.division', { n: div })}</h2>
      <ul className="fixture-list">
        {rounds.map((r) => {
          const f = mine.find((x) => x.round === r)
          return (
            <li key={r} className={r === state.matchday ? 'current' : ''}>
              <span className="muted small round">{t('fixtures.round', { n: r })}</span>
              {f ? (
                <span className="fx">
                  <ClubLabel state={state} id={f.homeId} />
                  <strong className="score">{f.result ? `${f.result.home}–${f.result.away}` : t('common.vs')}</strong>
                  <ClubLabel state={state} id={f.awayId} />
                </span>
              ) : (
                <span className="muted">{t('fixtures.bye')}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
