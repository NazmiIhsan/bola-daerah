import { useT } from '../LanguageContext'
import { computeTable } from '../../game/table'
import type { GameState } from '../../game/types'
import { ClubLabel } from '../components/bits'

const HEADS = ['p', 'w', 'd', 'l', 'gd', 'pts'] as const

export function TableScreen({ state }: { state: GameState }) {
  const { t } = useT()
  return (
    <div className="tables">
      {state.divisions.map((d) => {
        const rows = computeTable(d.clubIds, state.fixtures.filter((f) => f.division === d.id))
        return (
          <section key={d.id} className="card">
            <h2>{t('common.division', { n: d.id })}</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th className="left">{t('table.club')}</th>{HEADS.map((h) => <th key={h} className={`c-${h}`}><abbr title={t(`table.${h}.full`)}>{t(`table.${h}`)}</abbr></th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const zone = d.id === 1 && i >= rows.length - 2 ? 'down' : d.id === 2 && i < 2 ? 'up' : ''
                    return (
                      <tr key={r.clubId} className={`${zone} ${r.clubId === state.userClubId ? 'me' : ''}`}>
                        <td>{i + 1}</td>
                        <td className="left"><ClubLabel state={state} id={r.clubId} /></td>
                        <td>{r.played}</td><td className="c-w">{r.won}</td><td className="c-d">{r.drawn}</td><td className="c-l">{r.lost}</td>
                        <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                        <td><strong>{r.points}</strong></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="legend small">
              {d.id === 1 ? <><span className="swatch down" /> {t('table.relegation')}</> : <><span className="swatch up" /> {t('table.promotion')}</>}
            </p>
          </section>
        )
      })}
    </div>
  )
}
