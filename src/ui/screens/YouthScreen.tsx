import { useState } from 'react'
import { useT } from '../LanguageContext'
import { formatRM } from '../../game/finance'
import { overall } from '../../game/generate'
import { squad } from '../../game/market'
import { fullName } from '../../game/transfers'
import { INTAKE_DEADLINE, type signYouth } from '../../game/youth'
import { TRAINING_FOCUSES, type GameState, type TrainingFocus } from '../../game/types'
import { Progress, ScoutStars } from '../components/bits'

export interface YouthActions {
  train(focus: TrainingFocus): void
  sign(playerId: string): ReturnType<typeof signYouth>['outcome']
  release(playerId: string): void
}

const YOUNG = 21

export function YouthScreen({ state, actions }: { state: GameState; actions: YouthActions }) {
  const { t } = useT()
  const [message, setMessage] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null)
  const me = state.userClubId
  const young = squad(state, me).filter((p) => p.age <= YOUNG).sort((a, b) => overall(b) - overall(a))

  const promote = (id: string, name: string) => {
    const o = actions.sign(id)
    setMessage(o.kind === 'signed' ? { text: t('youth.joined', { player: name }), tone: 'good' } : { text: t(`transfers.refused.${o.reason}`), tone: 'bad' })
  }

  return (
    <div className="youth-screen">
      <section className="card">
        <h2>{t('youth.training')}</h2>
        <div className="focus-grid" role="group" aria-label={t('youth.training')}>
          {TRAINING_FOCUSES.map((f) => (
            <button key={f} className={`focus ${state.training === f ? 'on' : ''}`} aria-pressed={state.training === f} onClick={() => actions.train(f)}>
              <strong>{t(`training.${f}`)}</strong>
              <span className="small muted">{t(`training.${f}.desc`)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>{t('youth.intake')}</h2>
        {message && <p role="status" className={`deal-msg ${message.tone}`}>{message.text}</p>}
        {state.youth.intake.length === 0 ? <p className="muted">{t('youth.noIntake')}</p> : (
          <>
            <p className="muted small">{t('youth.deadline', { n: INTAKE_DEADLINE })}</p>
            <ul className="offers">
              {state.youth.intake.map((p) => (
                <li key={p.id} className="offer">
                  <div>
                    <span className={`pos ${p.position}`}>{t(`pos.${p.position}`)}</span> <strong>{fullName(p)}</strong> <span className="muted small">{t('transfers.ageShort', { n: p.age })}</span>
                    <div className="small">{t('squad.ovr')} <strong>{Math.round(overall(p))}</strong> · {t('transfers.wage')} {formatRM(p.wage)}</div>
                    <ScoutStars p={p} />
                  </div>
                  <div className="row">
                    <button className="primary" onClick={() => promote(p.id, fullName(p))}>{t('youth.promote')}</button>
                    <button onClick={() => { actions.release(p.id); setMessage(null) }}>{t('youth.release')}</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card">
        <h2>{t('youth.young')}</h2>
        {young.length === 0 ? <p className="muted">{t('youth.noYoung')}</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('squad.pos')}</th><th className="left">{t('squad.name')}</th><th>{t('squad.age')}</th><th>{t('squad.ovr')}</th><th>{t('youth.progress')}</th><th>{t('youth.apps')}</th><th>{t('youth.potential')}</th></tr></thead>
              <tbody>
                {young.map((p) => (
                  <tr key={p.id}>
                    <td><span className={`pos ${p.position}`}>{t(`pos.${p.position}`)}</span></td>
                    <td className="left"><strong>{fullName(p)}</strong>{p.homeClubId === me && <span className="tag listed">{t('youth.homegrown')}</span>}</td>
                    <td>{p.age}</td><td><strong>{Math.round(overall(p))}</strong></td><td><Progress p={p} /></td><td>{p.apps}</td><td><ScoutStars p={p} bare /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
