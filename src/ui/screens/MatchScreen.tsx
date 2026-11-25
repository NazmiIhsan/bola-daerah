import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../LanguageContext'
import { applyChange, createMatch, stepMinute } from '../../game/match/sim'
import { energy } from '../../game/match/minutes'
import { penalties } from '../../game/match/penalties'
import { bestPlayer } from '../../game/match/ratings'
import { scorers } from '../../game/match/stats'
import type { MatchEvent, MatchState, Side } from '../../game/match/types'
import { matchOptions, matchTactics, userFixture } from '../../game/season'
import { FORMATIONS } from '../../game/tactics'
import { createRng } from '../../game/rng'
import { commentary } from '../../i18n'
import type { FormationId, GameState, Style } from '../../game/types'
import { PitchCanvas, teamColors, type Highlight } from '../match/PitchCanvas'
import { buildHighlight, type Frame } from '../match/highlights'
import { slotPositions } from '../components/formationLayout'
import { GoalBanner } from '../match/GoalBanner'
import { MatchStats } from '../match/MatchStats'
import { Icon } from '../components/Icon'
import { Kit } from '../components/bits'

const STYLES: Style[] = ['attacking', 'balanced', 'defensive', 'counter']
const MS_PER_MINUTE = 400
const GOAL_MS = 2400

function kickoffFrame(m: MatchState): Frame {
  const home = slotPositions(m.home.tactics.formation).map((s) => ({ x: (100 - s.y) * 0.5, y: s.x }))
  const away = slotPositions(m.away.tactics.formation).map((s) => ({ x: 50 + s.y * 0.5, y: 100 - s.x }))
  return { t: 0, ball: { x: 50, y: 50 }, home, away }
}

export function MatchScreen({ state, onFinish }: { state: GameState; onFinish(m: MatchState): void }) {
  const { t, lang } = useT()
  const fixture = userFixture(state)!
  const [match, setMatch] = useState<MatchState>(() =>
    createMatch(fixture.homeId, fixture.awayId, matchTactics(state), (state.rngState ^ (state.matchday * 2654435761)) >>> 0, matchOptions(state, fixture)),
  )
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [highlight, setHighlight] = useState<Highlight | null>(null)
  const [goal, setGoal] = useState<MatchEvent | null>(null)
  const [offId, setOffId] = useState('')
  const [onId, setOnId] = useState('')

  const mySide: Side = match.home.clubId === state.userClubId ? 'home' : 'away'
  const mine = match[mySide]
  const homeClub = state.clubs[match.home.clubId]
  const awayClub = state.clubs[match.away.clubId]
  const colors = useMemo(() => teamColors(homeClub.colors, awayClub.colors), [homeClub, awayClub])
  const idle = useMemo(() => kickoffFrame(match), [match.home.tactics.formation, match.away.tactics.formation]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clock
  const matchRef = useRef(match)
  matchRef.current = match
  useEffect(() => {
    if (!running || highlight || goal || match.finished) return
    const id = setInterval(() => {
      const m = matchRef.current
      const next = stepMinute(m, state.players)
      matchRef.current = next
      const fresh = next.events.slice(m.events.length)
      const hl = fresh.find((e) => e.highlight)
      if (hl) {
        const half = next.minute <= 45 ? 1 : 2
        setHighlight({ key: next.events.indexOf(hl), frames: buildHighlight(hl, next.home.tactics.formation, next.away.tactics.formation, half, createRng(next.rngState)) })
      }
      if (fresh.some((e) => e.type === 'halftime')) setRunning(false)
      setMatch(next)
    }, MS_PER_MINUTE / speed)
    return () => clearInterval(id)
  }, [running, highlight, goal, match.finished, speed, state.players])

  // Nothing is given away before its highlight has played.
  const events = highlight ? match.events.slice(0, highlight.key) : match.events
  const score = { home: 0, away: 0 }
  for (const e of events) if (e.type === 'goal' && e.side) score[e.side]++

  const endHighlight = useCallback(() => {
    const e = highlight && matchRef.current.events[highlight.key]
    if (e?.type === 'goal') setGoal(e)
    setHighlight(null)
  }, [highlight])

  useEffect(() => {
    if (!goal) return
    const id = setTimeout(() => setGoal(null), GOAL_MS / speed)
    return () => clearTimeout(id)
  }, [goal, speed])

  const skip = () => {
    let m = match
    while (!m.finished) m = stepMinute(m, state.players)
    setHighlight(null)
    setGoal(null)
    setRunning(false)
    setMatch(m)
  }

  const change = (c: Parameters<typeof applyChange>[2]) => setMatch((m) => applyChange(m, mySide, c))

  const name = (id?: string) => {
    if (!id) return undefined
    const p = state.players[id]
    return p ? `${p.firstName.split(' ')[0]} ${p.lastName}` : undefined
  }
  const onPitch = (ids: string[]) => ids.map((id) => state.players[id]?.lastName ?? '')
  const names = { home: onPitch(match.home.onPitch), away: onPitch(match.away.onPitch) }
  const line = (e: MatchEvent, i: number) =>
    commentary(lang, e, { player: name(e.playerId), assist: name(e.assistId), subOn: name(e.subOnId), club: e.side ? state.clubs[match[e.side].clubId].name : undefined }, createRng(i * 7919 + e.minute))
  const feed = events.map((e, i) => ({ e, i })).filter(({ e }) => e.type !== 'chance').reverse()

  const benchIds = mine.bench.filter((id) => state.players[id])
  const pitchIds = mine.onPitch.filter(Boolean)
  const canSub = mine.subsUsed < 5 && !!offId && pitchIds.includes(offId) && benchIds.length > 0
  const chosenOn = benchIds.includes(onId) ? onId : benchIds[0] ?? ''
  const left = (id: string) => `${Math.round(energy(mine, state.players[id], match.minute))}%`
  const pens = fixture.cup && match.finished && match.score.home === match.score.away ? penalties(match, state.players) : null
  const best = match.finished ? bestPlayer(match, state.players) : null
  const paused = !running && !match.finished

  return (
    <div className="match">
      <div className="scorebar card">
        <span className="team"><Kit colors={homeClub.colors} /> {homeClub.name}</span>
        <span className="score-big" data-testid="score">{score.home} – {score.away}</span>
        <span className="team right">{awayClub.name} <Kit colors={awayClub.colors} /></span>
        <span className="clock" data-testid="clock">{match.minute}'</span>
        {score.home + score.away > 0 && (['home', 'away'] as Side[]).map((side) => (
          <ul key={side} className={`scorers small ${side}`}>
            {scorers(events, side).map((g) => <li key={g.playerId}><Icon name="ball" size={13} /> {state.players[g.playerId]?.lastName} {g.minutes.map((m) => `${m}'`).join(', ')}</li>)}
          </ul>
        ))}
      </div>

      <div className="match-grid">
        <div className="pitch-wrap card">
          <div className="pitch-stage">
            <PitchCanvas idle={idle} highlight={highlight} speed={speed} colors={colors} names={names} onDone={endHighlight} />
            {goal?.side && <GoalBanner player={name(goal.playerId) ?? ''} club={state.clubs[match[goal.side].clubId].name} colors={colors[goal.side]} />}
          </div>
          <div className="controls row">
            {match.finished ? (
              <>
                <strong>{t('match.fulltime')}</strong>
                {pens && <strong>{t('cup.shootout', { home: pens.home, away: pens.away })}</strong>}
                {best && <span className="small">{t('stats.playerOfMatch', { player: name(best.playerId) ?? '', rating: best.rating.toFixed(1) })}</span>}
                <button className="primary" onClick={() => onFinish(match)}>{t('match.done')}</button>
              </>
            ) : (
              <>
                <button className="primary" onClick={() => setRunning((r) => !r)}>{running ? t('match.pause') : t('match.resume')}</button>
                <span className="row speed" role="group" aria-label={t('match.speed')}>
                  {[1, 2, 4].map((s) => (
                    <button key={s} className={speed === s ? 'on' : ''} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>
                  ))}
                </span>
                <button onClick={skip}>{t('match.skip')}</button>
                {match.minute === 45 && !running && <strong>{t('match.halftime')}</strong>}
              </>
            )}
          </div>
        </div>

        <div className="side">
          {paused && (
            <section className="card changes" role="region" aria-label={t('match.changes')}>
              <h3>{t('match.changes')}</h3>
              <p className="small">{t('match.subsLeft', { n: 5 - mine.subsUsed })}</p>
              <label className="field">
                <span className="small muted">{t('match.subOff')}</span>
                <select aria-label={t('match.subOff')} value={offId} onChange={(e) => setOffId(e.target.value)}>
                  <option value="">—</option>
                  {pitchIds.map((id) => <option key={id} value={id}>{name(id)} ({state.players[id].position}) {left(id)}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="small muted">{t('match.subOn')}</span>
                <select aria-label={t('match.subOn')} value={chosenOn} onChange={(e) => setOnId(e.target.value)}>
                  {benchIds.map((id) => <option key={id} value={id}>{name(id)} ({state.players[id].position}) {left(id)}</option>)}
                </select>
              </label>
              <button disabled={!canSub} onClick={() => { change({ kind: 'sub', offId, onId: chosenOn }); setOffId(''); setOnId('') }}>{t('match.makeSub')}</button>
              <div className="row style-row" role="group" aria-label={t('tactics.style')}>
                {STYLES.map((s) => (
                  <button key={s} className={mine.tactics.style === s ? 'primary' : ''} aria-pressed={mine.tactics.style === s} onClick={() => change({ kind: 'tactics', style: s })}>{t(`style.${s}`)}</button>
                ))}
              </div>
              <label className="field">
                <span className="small muted">{t('tactics.formation')}</span>
                <select value={mine.tactics.formation} onChange={(e) => change({ kind: 'tactics', formation: e.target.value as FormationId })}>
                  {(Object.keys(FORMATIONS) as FormationId[]).map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
            </section>
          )}
          <MatchStats events={events} possession={match.possession} colors={colors} />
          <section className="card feed-card">
            <ol className="feed" role="log" aria-live="polite">
              {feed.map(({ e, i }) => (
                <li key={i} className={`ev ${e.type}`}>
                  <span className="min">{e.minute}'</span>
                  <span>{line(e, i)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}
