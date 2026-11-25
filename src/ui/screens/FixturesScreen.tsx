import { useT } from '../LanguageContext'
import { cupRoundName } from '../../game/cup'
import type { CupTie, GameState } from '../../game/types'
import { ClubLabel } from '../components/bits'

function CupTies({ state }: { state: GameState }) {
  const { t } = useT()
  if (!state.cup) return null
  const score = (x: CupTie) => (x.result ? `${x.result.home}–${x.result.away}` : t('common.vs'))
  return (
    <section className="card" role="region" aria-label={t('cup.title')}>
      <h2>{t('cup.title')}</h2>
      {state.cup.rounds.map((ties, i) => (
        <div key={i}>
          <h3>{t(`cup.round.${cupRoundName(i)}`)}</h3>
          <ul className="fixture-list">
            {ties.map((x) => (
              <li key={x.id} className={x.homeId === state.userClubId || x.awayId === state.userClubId ? 'current' : ''}>
                <span className="fx">
                  <ClubLabel state={state} id={x.homeId} />
                  <strong className="score">{score(x)}</strong>
                  <ClubLabel state={state} id={x.awayId} />
                </span>
                {x.pens && <span className="muted small">{t('cup.pens', { home: x.pens.home, away: x.pens.away })}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export function FixturesScreen({ state }: { state: GameState }) {
  const { t } = useT()
  const me = state.userClubId
  const div = state.divisions.find((d) => d.clubIds.includes(me))!.id
  const mine = state.fixtures.filter((f) => f.homeId === me || f.awayId === me)
  const rounds = Array.from({ length: 18 }, (_, i) => i + 1)
  return (
    <div className="tables">
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
    <CupTies state={state} />
    </div>
  )
}
