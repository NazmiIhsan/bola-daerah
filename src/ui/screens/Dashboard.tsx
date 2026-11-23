import { useT } from '../LanguageContext'
import { computeTable } from '../../game/table'
import { isSeasonOver, userFixture } from '../../game/season'
import type { GameApi } from '../useGame'
import { ClubLabel } from '../components/bits'
import { newsText } from '../../i18n'

export function Dashboard({ game, onPlayMatch }: { game: GameApi; onPlayMatch(): void }) {
  const { t, lang } = useT()
  const s = game.state!
  const me = s.userClubId
  const div = s.divisions.find((d) => d.clubIds.includes(me))!
  const table = computeTable(div.clubIds, s.fixtures.filter((f) => f.division === div.id))
  const pos = table.findIndex((r) => r.clubId === me) + 1
  const next = userFixture(s)
  const over = isSeasonOver(s)
  const recent = s.fixtures
    .filter((f) => f.result && (f.homeId === me || f.awayId === me))
    .sort((a, b) => b.round - a.round)
    .slice(0, 5)

  return (
    <div className="dash">
      <section className="card next">
        <h2>{over ? t('dashboard.seasonOver') : t('dashboard.nextMatch')}</h2>
        {over ? (
          <button className="primary big" onClick={() => game.continueDay()}>{t('dashboard.nextSeason')}</button>
        ) : next ? (
          <>
            <div className="fixture-big">
              <ClubLabel state={s} id={next.homeId} />
              <span className="vs">{t('common.vs')}</span>
              <ClubLabel state={s} id={next.awayId} />
            </div>
            <p className="muted">{next.homeId === me ? t('common.home') : t('common.away')} · {s.clubs[next.homeId].stadium}</p>
            <button className="primary big" onClick={onPlayMatch}>{t('dashboard.playMatch')}</button>
          </>
        ) : (
          <>
            <p>{t('dashboard.bye')}</p>
            <button className="primary big" onClick={() => game.continueDay()}>{t('dashboard.simulate')}</button>
          </>
        )}
      </section>
      <section className="card">
        <h2>{t('dashboard.position')}</h2>
        <p className="big-number">{pos}<span className="muted small"> / {table.length}</span></p>
        <p className="muted">{t('common.division', { n: div.id })} · {table[pos - 1].points} {t('table.pts')}</p>
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
        <section className="card" role="region" aria-label={t('dashboard.news')}>
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
            {recent.map((f) => {
              const mine = f.homeId === me ? f.result!.home : f.result!.away
              const theirs = f.homeId === me ? f.result!.away : f.result!.home
              const res = mine > theirs ? 'W' : mine === theirs ? 'D' : 'L'
              return (
                <li key={f.id}>
                  <span className={`pill ${res}`}>{res}</span>
                  <ClubLabel state={s} id={f.homeId} short /> <strong>{f.result!.home}–{f.result!.away}</strong> <ClubLabel state={s} id={f.awayId} short />
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
