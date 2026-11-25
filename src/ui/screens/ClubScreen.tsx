import { useT } from '../LanguageContext'
import { formatRM, wageBill } from '../../game/finance'
import { honours } from '../../game/stats'
import { ordinal } from '../../i18n'
import { Icon, type IconName } from '../components/Icon'
import type { GameState } from '../../game/types'

const face = (m: number): IconName => (m < 25 ? 'angry' : m < 40 ? 'worried' : m < 75 ? 'happy' : 'delighted')
const money = (n: number) => <span className={n < 0 ? 'neg' : ''}>{formatRM(n)}</span>

function Meter({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <span className={`meter wide big ${danger ? 'danger' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span style={{ width: `${value}%` }} />
    </span>
  )
}

export function ClubScreen({ state }: { state: GameState }) {
  const { t, lang } = useT()
  const won = honours(state, state.userClubId)
  const me = state.userClubId
  const clubName = (id: unknown) => (typeof id === 'string' ? state.clubs[id]?.name ?? id : '')
  const reasonText = (key: string, params?: Record<string, string | number>) =>
    t(key, { ...params, opp: clubName(params?.oppId) })
  const budget = state.transfers.budgets[me]
  const lastHome = state.finance.history.find((h) => h.attendance !== undefined)
  const weeks = state.finance.history.slice(0, 6)

  return (
    <div className="club-screen">
      <section className="card">
        <h2>{t('club.fans')}</h2>
        <div className="row"><span className={`face ${face(state.fans.mood)}`}><Icon name={face(state.fans.mood)} size={36} /></span><Meter label={t('dashboard.fans')} value={state.fans.mood} /><strong>{state.fans.mood}</strong></div>
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

      <section className="card" role="region" aria-label={t('history.title')}>
        <h2>{t('history.title')}</h2>
        {won.division1 > 0 && <p><Icon name="star" size={16} /> {t('history.titles', { n: 1, count: won.division1 })}</p>}
        {won.division2 > 0 && <p><Icon name="star" size={16} /> {t('history.titles', { n: 2, count: won.division2 })}</p>}
        {won.cup > 0 && <p><Icon name="star" size={16} /> {t('history.cups', { count: won.cup })}</p>}
        {state.history.length === 0 ? <p className="muted small">{t('history.none')}</p> : (
          <ul className="seasons">
            {state.history.map((r) => (
              <li key={r.season}>
                <strong>{r.season}</strong>
                <span>{clubName(r.me.clubId)} · {t('common.division', { n: r.me.division })} · {ordinal(lang, r.me.position)} · {r.me.points} {t('table.pts')}</span>
                <span className="muted small">{t('season.champions')}: {clubName(r.champions[0])}, {clubName(r.champions[1])}{r.cup && <> · {t('cup.title')}: {clubName(r.cup.winnerId)}</>}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>{t('club.finances')}</h2>
        <dl className="kv">
          <dt>{t('club.balance')}</dt><dd className="big-money">{money(state.finance.balance)}</dd>
          <dt>{t('transfers.budget')}</dt><dd>{formatRM(budget.transfer)}</dd>
          <dt>{t('club.wageBill')}</dt><dd>{formatRM(wageBill(state, me))}</dd>
          <dt>{t('club.wageBudget')}</dt><dd>{formatRM(budget.wage)}</dd>
          <dt>{t('club.attendance')}</dt><dd>{lastHome ? `${lastHome.attendance!.toLocaleString('en-US')} / ${state.clubs[me].capacity.toLocaleString('en-US')}` : '—'}</dd>
        </dl>
        {weeks.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th className="left">{t('club.week')}</th><th>{t('club.tickets')}</th><th>{t('club.sponsor')}</th><th>{t('club.prize')}</th><th>{t('club.wages')}</th><th>{t('nav.transfers')}</th><th>{t('club.net')}</th></tr></thead>
              <tbody>
                {weeks.map((w, i) => {
                  const net = w.tickets + w.sponsor + w.prize - w.wages + (w.transfers ?? 0)
                  return (
                    <tr key={i}>
                      <td className="left">{t('common.matchday', { n: w.matchday })}</td>
                      <td>{formatRM(w.tickets)}</td><td>{formatRM(w.sponsor)}</td><td>{formatRM(w.prize)}</td>
                      <td>{money(-w.wages)}</td><td>{money(w.transfers ?? 0)}</td><td>{money(net)}</td>
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
