import { useT } from '../LanguageContext'
import { computeTable } from '../../game/table'
import { isSeasonOver, userFixture } from '../../game/season'
import type { GameApi } from '../useGame'
import { ClubLabel } from '../components/bits'

export function Dashboard({ game, onPlayMatch }: { game: GameApi; onPlayMatch(): void }) {
  const { t } = useT()
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
