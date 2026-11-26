import { useState } from 'react'
import { useT } from '../LanguageContext'
import { formatRM } from '../../game/finance'
import { playerValue } from '../../game/market'
import { fullName } from '../../game/transfers'
import { Progress } from '../components/bits'
import { Icon } from '../components/Icon'
import { PHONE, useMedia } from '../components/useMedia'
import { PlayerDialog, type TransferActions } from '../components/PlayerDialog'
import { Avatar } from '../avatars/Avatar'
import { playerFace } from '../avatars/face'
import { overall } from '../../game/generate'
import type { GameState, Player, Position } from '../../game/types'

const ORDER: Position[] = ['GK', 'DF', 'MF', 'FW']

function Status({ p }: { p: Player }) {
  const { t } = useT()
  if (p.injuredWeeks > 0) return <span className="tag bad">{t('squad.injured', { n: p.injuredWeeks })}</span>
  if (p.suspendedMatches > 0) return <span className="tag bad">{t('squad.suspended')}</span>
  if (p.away) return <span className="tag">{t('squad.away')}</span>
  return <span className="tag ok">{t('squad.available')}</span>
}

function Fitness({ p }: { p: Player }) {
  const { t } = useT()
  return (
    <span className="fitness">
      <span className={`meter ${p.fitness < 50 ? 'danger' : ''}`} role="meter" aria-label={t('squad.fitness')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.fitness)}><span style={{ width: `${p.fitness}%` }} /></span>
      <span className="small">{Math.round(p.fitness)}%</span>
    </span>
  )
}

export function SquadScreen({ state, actions }: { state: GameState; actions: TransferActions }) {
  const { t } = useT()
  const phone = useMedia(PHONE)
  const [openId, setOpenId] = useState<string | null>(null)
  const squad = Object.values(state.players)
    .filter((p) => p.clubId === state.userClubId)
    .sort((a, b) => ORDER.indexOf(a.position) - ORDER.indexOf(b.position) || overall(b) - overall(a))

  const pos = (p: Player) => <span className={`pos ${p.position}`}>{t(`pos.${p.position}`)}</span>
  const name = (p: Player) => <button className="name-link" aria-label={t('transfers.view', { player: fullName(p) })} onClick={() => setOpenId(p.id)}>{fullName(p)}</button>
  const listed = (p: Player) => p.listed && <span className="tag listed">{t('transfers.listed')}</span>

  return (
    <div className="card">
      <h2>{t('squad.title')}</h2>
      {phone ? (
        <ul className="squad-cards">
          {squad.map((p) => (
            <li key={p.id} className="squad-card">
              <Avatar face={playerFace(p, state.clubs)} size={44} />
              <div className="squad-main">
                <div className="squad-top">{name(p)}{listed(p)}</div>
                <div className="squad-line small">{pos(p)} <span className="muted">{t('transfers.ageShort', { n: p.age })}</span> <Status p={p} /></div>
              </div>
              <div className="squad-side">
                <span><strong className="ovr">{Math.round(overall(p))}</strong> <Progress p={p} /></span>
                <Fitness p={p} />
              </div>
              <div className="squad-line squad-deal small muted">
                <span>{formatRM(playerValue(p, state.season))}</span>
                <span>{t('squad.perWeek', { wage: formatRM(p.wage) })}</span>
                  {p.contractEnd <= state.season ? <span className="tag bad"><Icon name="alert" size={14} /> {t('squad.expiring')}</span> : <span>{t('squad.until', { year: p.contractEnd })}</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{t('squad.pos')}</th><th className="left">{t('squad.name')}</th><th>{t('squad.age')}</th><th>{t('squad.ovr')}</th><th>{t('squad.fitness')}</th><th>{t('squad.status')}</th><th>{t('transfers.value')}</th><th>{t('transfers.wage')}</th><th>{t('transfers.contract')}</th></tr>
            </thead>
            <tbody>
              {squad.map((p) => (
                <tr key={p.id}>
                  <td>{pos(p)}</td>
                  <td className="left"><span className="who"><Avatar face={playerFace(p, state.clubs)} size={30} />{name(p)}{listed(p)}</span></td>
                  <td>{p.age}</td>
                  <td className="nowrap"><strong>{Math.round(overall(p))}</strong> <Progress p={p} /></td>
                  <td><Fitness p={p} /></td>
                  <td><Status p={p} /></td>
                  <td className="nowrap">{formatRM(playerValue(p, state.season))}</td>
                  <td className="nowrap">{formatRM(p.wage)}</td>
                  <td>{p.contractEnd <= state.season ? <span className="tag bad nowrap" title={t('squad.expiring')}><Icon name="alert" size={14} /> {p.contractEnd}<span className="sr-only">{t('squad.expiring')}</span></span> : p.contractEnd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {openId && <PlayerDialog key={openId} state={state} playerId={openId} actions={actions} onClose={() => setOpenId(null)} />}
    </div>
  )
}
