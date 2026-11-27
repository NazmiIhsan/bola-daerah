import { useEffect, useMemo, useRef } from 'react'
import { useT } from '../LanguageContext'
import { matchTactics, userFixture } from '../../game/season'
import { FORMATIONS, matchup, reslot, slotRoles, teamStrength, troubledBy } from '../../game/tactics'
import { overall } from '../../game/generate'
import { formOf } from '../../game/table'
import { isRivalry } from '../../game/rivals'
import { managerOf } from '../../game/manager'
import type { FormationId, GameState, Style, Tactics } from '../../game/types'
import { Crest } from '../components/Crest'
import { Avatar } from '../avatars/Avatar'
import { playerFace } from '../avatars/face'
import { teamColors } from '../match/PitchCanvas'

const STYLES: Style[] = ['attacking', 'balanced', 'defensive', 'counter']

/**
 * The two shapes and the three lines side by side, so the formation and style choice above it
 * is made knowing what it is up against. Updates as the user changes their own shape.
 */
function HeadToHead({ state, mine, theirs, myId, theirId, homeIsMine }: { state: GameState; mine: Tactics; theirs: Tactics; myId: string; theirId: string; homeIsMine: boolean }) {
  const { t } = useT()
  const edge = matchup(mine.formation, theirs.formation)
  const p = { mine: mine.formation, theirs: theirs.formation }
  const better = troubledBy(theirs.formation)
  const verdict = edge > 0 ? t('prematch.shapeGood', p) : edge < 0 ? `${t('prematch.shapeBad', p)} ${t('prematch.shapeTry', { list: better.join(', ') })}` : t('prematch.shapeEven', p)
  const a = teamStrength(mine.lineup.map((id) => state.players[id]), mine.formation)
  const b = teamStrength(theirs.lineup.map((id) => state.players[id]), theirs.formation)
  const lines: Array<[string, number, number]> = [[t('tactics.attack'), a.attack, b.attack], [t('tactics.midfield'), a.midfield, b.midfield], [t('tactics.defence'), a.defence, b.defence]]
  // Same clash rules as the pitch, so the bars use the colours the teams will wear.
  const kit = teamColors(state.clubs[homeIsMine ? myId : theirId].colors, state.clubs[homeIsMine ? theirId : myId].colors)
  const myColor = kit[homeIsMine ? 'home' : 'away'][0], theirColor = kit[homeIsMine ? 'away' : 'home'][0]
  return (
    <section className="pm-h2h" aria-label={t('prematch.headToHead')}>
      <h2 className="small muted">{t('prematch.headToHead')}</h2>
      <p className={`pm-shape ${edge > 0 ? 'good' : edge < 0 ? 'bad' : ''}`} data-testid="shape-verdict">{verdict}</p>
      <div className="pm-cnames small"><strong>{state.clubs[myId].name}</strong><strong>{state.clubs[theirId].name}</strong></div>
      {lines.map(([label, x, y]) => (
        <div key={label} className="mstat" role="img" aria-label={t('prematch.compareLine', { line: label, mine: x.toFixed(1), theirs: y.toFixed(1) })}>
          <div className="mstat-top"><strong>{x.toFixed(1)}</strong><span className="small muted">{label}</span><strong>{y.toFixed(1)}</strong></div>
          <div className="mstat-bar" aria-hidden>
            <span style={{ flexGrow: x, background: myColor }} />
            <span style={{ flexGrow: y, background: theirColor }} />
          </div>
        </div>
      ))}
    </section>
  )
}

/** How an AI manager tends to play, in a word. */
function leaning(m: { attack: number }): Style {
  return m.attack > 0.66 ? 'attacking' : m.attack < 0.33 ? 'defensive' : 'balanced'
}

/**
 * Before kick-off: both line-ups, both managers, form and the key men, with a last chance to
 * change the user's shape and style.
 */
export function PreMatchScreen({ state, onTactics, onKickoff }: { state: GameState; onTactics(t: Tactics): void; onKickoff(): void }) {
  const { t } = useT()
  const go = useRef<HTMLButtonElement>(null)
  useEffect(() => { go.current?.focus() }, [])
  const f = userFixture(state)!
  const plans = useMemo(() => matchTactics(state), [state])
  const me = state.userClubId
  const derby = isRivalry(state.clubs[f.homeId], state.clubs[f.awayId])
  const name = (id: string) => { const p = state.players[id]; return p ? `${p.firstName.split(' ')[0]} ${p.lastName}` : '' }

  const side = (clubId: string) => {
    const club = state.clubs[clubId]
    const tac = plans[clubId]
    const roles = slotRoles(tac.formation)
    const xi = tac.lineup.map((id, i) => ({ id, role: roles[i], p: state.players[id] })).filter((x) => x.p)
    const key = xi.reduce((a, b) => (overall(b.p) > overall(a.p) ? b : a), xi[0])
    const mine = clubId === me
    const m = state.managers?.[clubId] ?? managerOf(state, clubId)
    const manager = mine ? t('prematch.you', { name: state.managerName || '—' }) : (state.managers?.[clubId]?.name ?? '—')
    const form = formOf(clubId, state.fixtures.filter((x) => !x.cup))
    return (
      <section key={clubId} className={`card pm-side ${mine ? 'mine' : ''}`} role="region" aria-label={club.name}>
        <header className="pm-head">
          <Crest club={club} size={48} />
          <div>
            <h2>{club.name}</h2>
            <p className="small muted">{t('prematch.manager', { name: manager })}</p>
            <p className="small"><strong>{tac.formation}</strong> · {t(`style.${mine ? tac.style : leaning(m)}`)}</p>
          </div>
        </header>
        <p className="pm-form small" aria-label={t('prematch.form')}>
          <span className="muted">{t('prematch.form')}</span>
          {form.length ? form.map((r, i) => <span key={i} className={`res ${r}`}>{r}</span>) : <span className="muted">—</span>}
        </p>
        {key && (
          <div className="pm-key">
            <Avatar face={playerFace(key.p, state.clubs)} size={40} />
            <div><span className="small muted">{t('prematch.keyMan')}</span><strong>{name(key.id)}</strong></div>
            <span className="ovr">{Math.round(overall(key.p))}</span>
          </div>
        )}
        <ol className="pm-xi" aria-label={t('prematch.lineups')}>
          {xi.map(({ id, role, p }) => (
            <li key={id}><span className={`pos ${role}`}>{t(`pos.${role}`)}</span><span className="pm-name">{name(id)}</span><span className="muted small">{Math.round(overall(p))}</span></li>
          ))}
        </ol>
        <p className="small muted pm-bench"><strong>{t('prematch.bench')}:</strong> {tac.subs.map((id) => state.players[id]?.lastName).filter(Boolean).join(', ')}</p>
      </section>
    )
  }

  const mine = plans[me]
  const them = f.homeId === me ? f.awayId : f.homeId
  const set = (next: Tactics) => onTactics(next)
  return (
    <div className="prematch">
      <div className="card pm-top">
        <p className="result-kicker">
          {f.cup ? t('prematch.cup') : t('prematch.title', { n: state.matchday })}
          {derby && <span className="tag bad pm-derby">{t('prematch.derby')}</span>}
        </p>
        <p className="pm-vs"><strong>{state.clubs[f.homeId].name}</strong> <span className="muted">vs</span> <strong>{state.clubs[f.awayId].name}</strong></p>
        <div className="pm-controls">
          <label className="field">
            <span className="small muted">{t('tactics.formation')}</span>
            <select value={mine.formation} onChange={(e) => set(reslot(mine, e.target.value as FormationId, state.players))}>
              {(Object.keys(FORMATIONS) as FormationId[]).map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <div className="row" role="group" aria-label={t('tactics.style')}>
            {STYLES.map((s) => <button key={s} className={mine.style === s ? 'on' : ''} aria-pressed={mine.style === s} onClick={() => set({ ...mine, style: s })}>{t(`style.${s}`)}</button>)}
          </div>
        </div>
        <HeadToHead state={state} mine={mine} theirs={plans[them]} myId={me} theirId={them} homeIsMine={f.homeId === me} />
        <div className="pm-controls">
          <button ref={go} className="primary big" onClick={onKickoff}>{t('prematch.kickoff')}</button>
        </div>
      </div>
      <div className="pm-grid">
        {side(f.homeId)}
        {side(f.awayId)}
      </div>
    </div>
  )
}
