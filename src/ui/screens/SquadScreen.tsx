import { useT } from '../LanguageContext'
import { overall } from '../../game/generate'
import type { GameState, Position } from '../../game/types'

const ORDER: Position[] = ['GK', 'DF', 'MF', 'FW']

export function SquadScreen({ state }: { state: GameState }) {
  const { t } = useT()
  const squad = Object.values(state.players)
    .filter((p) => p.clubId === state.userClubId)
    .sort((a, b) => ORDER.indexOf(a.position) - ORDER.indexOf(b.position) || overall(b) - overall(a))
  return (
    <div className="card">
      <h2>{t('squad.title')}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>{t('squad.pos')}</th><th className="left">{t('squad.name')}</th><th>{t('squad.age')}</th><th>{t('squad.ovr')}</th><th>{t('squad.fitness')}</th><th>{t('squad.status')}</th></tr>
          </thead>
          <tbody>
            {squad.map((p) => (
              <tr key={p.id}>
                <td><span className={`pos ${p.position}`}>{t(`pos.${p.position}`)}</span></td>
                <td className="left">{p.firstName} {p.lastName}</td>
                <td>{p.age}</td>
                <td><strong>{Math.round(overall(p))}</strong></td>
                <td><span className="meter"><span style={{ width: `${p.fitness}%` }} /></span></td>
                <td>{p.injuredWeeks > 0 ? <span className="tag bad">{t('squad.injured', { n: p.injuredWeeks })}</span> : p.suspendedMatches > 0 ? <span className="tag bad">{t('squad.suspended')}</span> : <span className="tag ok">{t('squad.available')}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
