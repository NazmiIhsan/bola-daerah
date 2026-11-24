import { useState } from 'react'
import { useT } from '../LanguageContext'
import { formatRM } from '../../game/finance'
import { playerValue } from '../../game/market'
import { fullName } from '../../game/transfers'
import { Progress } from '../components/bits'
import { PlayerDialog, type TransferActions } from '../components/PlayerDialog'
import { Avatar } from '../avatars/Avatar'
import { playerFace } from '../avatars/face'
import { overall } from '../../game/generate'
import type { GameState, Position } from '../../game/types'

const ORDER: Position[] = ['GK', 'DF', 'MF', 'FW']

export function SquadScreen({ state, actions }: { state: GameState; actions: TransferActions }) {
  const { t } = useT()
  const [openId, setOpenId] = useState<string | null>(null)
  const squad = Object.values(state.players)
    .filter((p) => p.clubId === state.userClubId)
    .sort((a, b) => ORDER.indexOf(a.position) - ORDER.indexOf(b.position) || overall(b) - overall(a))
  return (
    <div className="card">
      <h2>{t('squad.title')}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>{t('squad.pos')}</th><th className="left">{t('squad.name')}</th><th>{t('squad.age')}</th><th>{t('squad.ovr')}</th><th>{t('squad.fitness')}</th><th>{t('squad.status')}</th><th>{t('transfers.value')}</th><th>{t('transfers.wage')}</th><th>{t('transfers.contract')}</th></tr>
          </thead>
          <tbody>
            {squad.map((p) => (
              <tr key={p.id}>
                <td><span className={`pos ${p.position}`}>{t(`pos.${p.position}`)}</span></td>
                <td className="left"><span className="who"><Avatar face={playerFace(p, state.clubs)} size={30} /><button className="name-link" aria-label={t('transfers.view', { player: fullName(p) })} onClick={() => setOpenId(p.id)}>{fullName(p)}</button>{p.listed && <span className="tag listed">{t('transfers.listed')}</span>}</span></td>
                <td>{p.age}</td>
                <td className="nowrap"><strong>{Math.round(overall(p))}</strong> <Progress p={p} /></td>
                <td><span className="meter"><span style={{ width: `${p.fitness}%` }} /></span></td>
                <td>{p.injuredWeeks > 0 ? <span className="tag bad">{t('squad.injured', { n: p.injuredWeeks })}</span> : p.suspendedMatches > 0 ? <span className="tag bad">{t('squad.suspended')}</span> : <span className="tag ok">{t('squad.available')}</span>}</td>
                <td className="nowrap">{formatRM(playerValue(p, state.season))}</td>
                <td className="nowrap">{formatRM(p.wage)}</td>
                <td><span className={p.contractEnd <= state.season ? 'tag bad' : ''}>{p.contractEnd}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openId && <PlayerDialog key={openId} state={state} playerId={openId} actions={actions} onClose={() => setOpenId(null)} />}
    </div>
  )
}
