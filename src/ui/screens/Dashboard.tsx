import { useMemo } from 'react'
import { useT } from '../LanguageContext'
import { cupRoundName } from '../../game/cup'
import { homeAlerts } from '../../game/alerts'
import { computeTable, formOf, type Result } from '../../game/table'
import { isSeasonOver, matchTactics, userFixture } from '../../game/season'
import { matchup } from '../../game/tactics'
import type { FormationId } from '../../game/types'
import type { GameApi } from '../useGame'
import { ClubLabel } from '../components/bits'
import { Crest } from '../components/Crest'
import { Icon } from '../components/Icon'
import type { Tab } from '../components/Nav'
import { newsText, ordinal } from '../../i18n'

const AROUND = 5

function Pill({ r }: { r: Result }) {
  const { t } = useT()
  return <span className={`pill ${r}`}>{t(`result.${r}`)}</span>
}

export function MatchupNote({ mine, theirs }: { mine: FormationId; theirs: FormationId }) {
  const { t } = useT()
  const key = { 1: 'good', 0: 'even', [-1]: 'bad' }[matchup(mine, theirs)]
  return <p className="small">{t(`dashboard.matchup.${key}`, { mine, theirs })}</p>
}

export function Dashboard({ game, onPlayMatch, onGo }: { game: GameApi; onPlayMatch(): void; onGo(tab: Tab): void }) {
  const { t, lang } = useT()
  const s = game.state!
  const me = s.userClubId
  const div = s.divisions.find((d) => d.clubIds.includes(me))!
  const fixtures = s.fixtures.filter((f) => f.division === div.id)
  const table = computeTable(div.clubIds, fixtures)
  const pos = table.findIndex((r) => r.clubId === me) + 1
  const from = Math.max(0, Math.min(table.length - AROUND, pos - 1 - Math.floor(AROUND / 2)))
  const next = userFixture(s)
  const rival = next && (next.homeId === me ? next.awayId : next.homeId)
  const plans = useMemo(() => (rival ? matchTactics(s) : null), [s, rival])
  const plan = rival && plans?.[rival]
  const over = isSeasonOver(s)
  const alerts = homeAlerts(s)
  const recent = fixtures
    .filter((f) => f.result && (f.homeId === me || f.awayId === me))
    .sort((a, b) => b.round - a.round)
    .slice(0, 5)

  const team = (id: string) => {
    const form = formOf(id, fixtures)
    const place = table.findIndex((r) => r.clubId === id) + 1
    return (
      <div className={`next-team ${id === me ? 'me' : ''}`}>
        <Crest club={s.clubs[id]} size={56} />
        <strong>{s.clubs[id].name}</strong>
        <span className="muted small">{place > 0 ? ordinal(lang, place) : t('common.division', { n: div.id === 1 ? 2 : 1 })}</span>
        {form.length > 0 && <span className="form" role="img" aria-label={t('dashboard.form', { form: form.map((r) => t(`result.${r}`)).join(' ') })}>{form.map((r, i) => <Pill key={i} r={r} />)}</span>}
      </div>
    )
  }

  return (
    <div className="dash">
      <section className="card next" role="region" aria-label={over ? t('dashboard.seasonOver') : t('dashboard.nextMatch')}>
        <h2>{over ? t('dashboard.seasonOver') : t('dashboard.nextMatch')}</h2>
        {over ? (
          <button className="primary big" onClick={() => game.continueDay()}>{t('dashboard.nextSeason')}</button>
        ) : next ? (
          <>
            {next.cup && <p className="cup-tag"><Icon name="star" size={16} /> {t('cup.title')} · {t(`cup.round.${cupRoundName(s.cup!.rounds.length - 1)}`)}</p>}
            <div className="next-teams">{team(next.homeId)}<span className="vs">{t('common.vs')}</span>{team(next.awayId)}</div>
            <p className="muted">{next.homeId === me ? t('common.home') : t('common.away')} · {s.clubs[next.homeId].stadium}</p>
            {rival && plan && <p className="small">{t('dashboard.expected', { club: s.clubs[rival].name, formation: plan.formation, style: t(`style.${plan.style}`) })}</p>}
            {plans && plan && <MatchupNote mine={plans[me].formation} theirs={plan.formation} />}
            <button className="primary big" onClick={onPlayMatch}>{t('dashboard.playMatch')}</button>
          </>
        ) : (
          <>
            <p>{t('dashboard.bye')}</p>
            <button className="primary big" onClick={() => game.continueDay()}>{t('dashboard.simulate')}</button>
          </>
        )}
      </section>

      {alerts.length > 0 && (
        <section className="card" role="region" aria-label={t('dashboard.todo')}>
          <h2>{t('dashboard.todo')}</h2>
          <ul className="todo">
            {alerts.map((a) => (
              <li key={a.key}><button onClick={() => onGo(a.tab)}><Icon name="alert" /> <span>{t(`alert.${a.key}`, { n: a.n })}</span></button></li>
            ))}
          </ul>
        </section>
      )}

      <section className="card league" role="region" aria-label={t('dashboard.position')}>
        <h2>{t('dashboard.position')} <span className="muted small">{t('common.division', { n: div.id })}</span></h2>
        <table className="mini">
          <tbody>
            {table.slice(from, from + AROUND).map((r, i) => (
              <tr key={r.clubId} className={r.clubId === me ? 'me' : ''}>
                <td>{from + i + 1}</td>
                <td className="left"><ClubLabel state={s} id={r.clubId} /></td>
                <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                <td><strong>{r.points}</strong> <span className="muted small">{t('table.pts')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card mood">
        <div className="sbar">
          <span className="small">{t('dashboard.fans')}</span>
          <span className="meter wide" role="meter" aria-label={t('dashboard.fans')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.fans.mood}><span style={{ width: `${s.fans.mood}%` }} /></span>
          <strong className="small">{s.fans.mood}</strong>
        </div>
        <div className="sbar">
          <span className="small">{t('dashboard.board')}</span>
          <span className={`meter wide ${s.board.confidence < 30 ? 'danger' : ''}`} role="meter" aria-label={t('dashboard.board')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.board.confidence}><span style={{ width: `${s.board.confidence}%` }} /></span>
          <strong className="small">{s.board.confidence}</strong>
        </div>
      </section>

      {s.inbox.length > 0 && (
        <section className="card headlines-card" role="region" aria-label={t('dashboard.news')}>
          <h2>{t('dashboard.news')}</h2>
          <ul className="headlines">
            {s.inbox.slice(0, 3).map((n) => <li key={n.id} className={n.important ? 'important' : ''}>{newsText(lang, n, (id) => s.clubs[id]?.name ?? id).headline}</li>)}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>{t('dashboard.lastResults')}</h2>
        {recent.length === 0 ? (
          <p className="muted">{t('dashboard.noResults')}</p>
        ) : (
          <ul className="results">
            {recent.map((f) => (
              <li key={f.id}>
                <Pill r={formOf(me, [f])[0]} />
                <ClubLabel state={s} id={f.homeId} short /> <strong>{f.result!.home}–{f.result!.away}</strong> <ClubLabel state={s} id={f.awayId} short />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
