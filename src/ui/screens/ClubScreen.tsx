import { useT } from '../LanguageContext'
import { formatRM, wageBill } from '../../game/finance'
import type { GameState } from '../../game/types'

const face = (m: number) => (m < 25 ? '😡' : m < 40 ? '😟' : m < 75 ? '🙂' : '🤩')
const money = (n: number) => <span className={n < 0 ? 'neg' : ''}>{formatRM(n)}</span>

function Meter({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <span className={`meter wide big ${danger ? 'danger' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span style={{ width: `${value}%` }} />
    </span>
  )
}

export function ClubScreen({ state }: { state: GameState }) {
  const { t } = useT()
  const me = state.userClubId
  const clubName = (id: unknown) => (typeof id === 'string' ? state.clubs[id]?.name ?? id : '')
  const reasonText = (key: string, params?: Record<string, string | number>) =>
    t(key, { ...params, opp: clubName(params?.oppId) })
  const lastHome = state.finance.history.find((h) => h.attendance !== undefined)
  const weeks = state.finance.history.slice(0, 6)

  return (
    <div className="club-screen">
      <section className="card">
        <h2>{t('club.fans')}</h2>
        <div className="row"><span className="face" aria-hidden>{face(state.fans.mood)}</span><Meter label={t('dashboard.fans')} value={state.fans.mood} /><strong>{state.fans.mood}</strong></div>
        {state.fans.log.length === 0 ? <p className="muted small">{t('club.noFanNews')}</p> : (
          <ul className="reasons">
            {state.fans.log.slice(0, 6).map((e, i) => (
              <li key={i}>
                <span className={`delta ${e.delta >= 0 ? 'pos' : 'neg'}`}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
                <span>{reasonText(e.reason, e.params)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>{t('club.board')}</h2>
        <p><strong>{t(`board.exp.${state.board.expectation}`)}</strong></p>
        <p className="muted small">{t('club.target', { pos: state.board.targetPosition })}</p>
        <div className="row"><Meter label={t('dashboard.board')} value={state.board.confidence} danger={state.board.confidence < 30} /><strong>{state.board.confidence}</strong></div>
        {state.board.confidence < 30 && <p className="banner error small">{t('club.boardWarning')}</p>}
      </section>

      <section className="card">
        <h2>{t('club.finances')}</h2>
        <dl className="kv">
          <dt>{t('club.balance')}</dt><dd className="big-money">{money(state.finance.balance)}</dd>
          <dt>{t('club.wageBill')}</dt><dd>{formatRM(wageBill(state, me))}</dd>
          <dt>{t('club.attendance')}</dt><dd>{lastHome ? `${lastHome.attendance!.toLocaleString('en-US')} / ${state.clubs[me].capacity.toLocaleString('en-US')}` : '—'}</dd>
        </dl>
        {weeks.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th className="left">{t('club.week')}</th><th>{t('club.tickets')}</th><th>{t('club.sponsor')}</th><th>{t('club.prize')}</th><th>{t('club.wages')}</th><th>{t('club.net')}</th></tr></thead>
              <tbody>
                {weeks.map((w, i) => {
                  const net = w.tickets + w.sponsor + w.prize - w.wages
                  return (
                    <tr key={i}>
                      <td className="left">{t('common.matchday', { n: w.matchday })}</td>
                      <td>{formatRM(w.tickets)}</td><td>{formatRM(w.sponsor)}</td><td>{formatRM(w.prize)}</td>
                      <td>{money(-w.wages)}</td><td>{money(net)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
