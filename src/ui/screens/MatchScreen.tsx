import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../LanguageContext'
import { applyChange, canShout, createMatch, stepMinute } from '../../game/match/sim'
import { assistantPrompt, type Prompt, type PromptOption } from '../../game/match/assistant'
import { energy } from '../../game/match/minutes'
import { penalties } from '../../game/match/penalties'
import { bestPlayer } from '../../game/match/ratings'
import { scorers } from '../../game/match/stats'
import type { MatchEvent, MatchState, Shout, Side } from '../../game/match/types'
import { matchOptions, matchTactics, userFixture } from '../../game/season'
import { touchlineBan } from '../../game/story'
import { FORMATIONS } from '../../game/tactics'
import { createRng } from '../../game/rng'
import { commentary } from '../../i18n'
import type { FormationId, GameState, Style } from '../../game/types'
import { PitchCanvas, teamColors, type Highlight } from '../match/PitchCanvas'
import { ambientFrame, buildHighlight, type Frame } from '../match/highlights'
import { slotPositions } from '../components/formationLayout'
import { GoalBanner } from '../match/GoalBanner'
import { MatchStats } from '../match/MatchStats'
import { Icon } from '../components/Icon'
import { Kit } from '../components/bits'

const STYLES: Style[] = ['attacking', 'balanced', 'defensive', 'counter']
const SHOUTS: Shout[] = ['attack', 'calm', 'waste', 'encourage']
const MS_PER_MINUTE = 400
const GOAL_MS = 2400
/** Minutes without anything to report before the ticker describes the flow of play. */
const LULL_MINUTES = 6
const LULL_TILT = 0.2

function kickoffFrame(m: MatchState): Frame {
  const home = slotPositions(m.home.tactics.formation).map((s) => ({ x: (100 - s.y) * 0.5, y: s.x }))
  const away = slotPositions(m.away.tactics.formation).map((s) => ({ x: 50 + s.y * 0.5, y: 100 - s.x }))
  return { t: 0, ball: { x: 50, y: 50 }, home, away }
}

/** 90+3' in stoppage time. */
export const clockText = (minute: number) => (minute > 90 ? `90+${minute - 90}'` : `${minute}'`)

/** Big moments play in slow motion: penalties, late goals and gilt-edged misses. */
function isBigMoment(e: MatchEvent) {
  return e.kind === 'penalty' || (e.type === 'goal' && e.minute >= 85) || (e.type !== 'goal' && (e.xg ?? 0) >= 0.35)
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
  const [ambient, setAmbient] = useState<Frame | null>(null)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [seen, setSeen] = useState<string[]>([])
  const [skipped, setSkipped] = useState(false)

  const mySide: Side = match.home.clubId === state.userClubId ? 'home' : 'away'
  const mine = match[mySide]
  const homeClub = state.clubs[match.home.clubId]
  const awayClub = state.clubs[match.away.clubId]
  const colors = useMemo(() => teamColors(homeClub.colors, awayClub.colors), [homeClub, awayClub])
  const kickoff = useMemo(() => kickoffFrame(match), [match.home.tactics.formation, match.away.tactics.formation]) // eslint-disable-line react-hooks/exhaustive-deps
  const idle = ambient ?? kickoff

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
      const half = next.minute <= 45 ? 1 : 2
      if (hl) {
        const team = hl.side ? next[hl.side] : undefined
        const slot = (id?: string) => {
          const i = id && team ? team.onPitch.indexOf(id) : -1
          return i > 0 ? i : undefined
        }
        setHighlight({
          key: next.events.indexOf(hl),
          frames: buildHighlight(hl, next.home.tactics.formation, next.away.tactics.formation, half, createRng(next.rngState), { shooter: slot(hl.playerId), assist: slot(hl.assistId), slow: isBigMoment(hl) }),
        })
      }
      // Ordinary play: the side that had the ball this minute pushes up.
      const attacking: Side = next.possession.home > m.possession.home ? 'home' : 'away'
      setAmbient(ambientFrame(next.home.tactics.formation, next.away.tactics.formation, attacking, next.momentum ?? 0, half, createRng(next.rngState ^ 0x9e3779b9)))
      if (fresh.some((e) => e.type === 'halftime')) setRunning(false)
      setMatch(next)
    }, MS_PER_MINUTE / speed)
    return () => clearInterval(id)
  }, [running, highlight, goal, match.finished, speed, state.players])

  // Nothing is given away before its highlight has played.
  // Your own shouts show at once, even while a highlight plays.
  const events = highlight ? match.events.filter((e, i) => i < highlight.key || e.type === 'shout') : match.events
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

  // The assistant speaks up at big moments, once the highlight and celebration are over.
  useEffect(() => {
    if (!running || highlight || goal || prompt || skipped || match.finished) return
    const p = assistantPrompt(match, mySide, state.players, seen)
    if (p) {
      setPrompt(p)
      setRunning(false)
    }
  }, [match, running, highlight, goal, prompt, skipped, seen, mySide, state.players])

  const choose = (o: PromptOption) => {
    if (!prompt) return
    setMatch((m) => o.changes.reduce((acc, c) => applyChange(acc, mySide, c), m))
    setSeen((x) => [...x, prompt.id])
    setPrompt(null)
    setRunning(true)
  }

  const skip = () => {
    let m = match
    while (!m.finished) m = stepMinute(m, state.players)
    setSkipped(true)
    setPrompt(null)
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
  const banned = touchlineBan(state)
  const shout = (sh: Shout) => change({ kind: 'shout', shout: sh })
  const activeShout = match.shouts?.[mySide]
  const momentum = match.momentum ?? 0
  const promptText = (key: string, params: Record<string, string | number> = {}) =>
    t(key, Object.fromEntries(Object.entries(params).map(([k, v]) => (k === 'playerId' ? ['player', name(String(v)) ?? ''] : [k, v]))))
  const goalLabel = (() => {
    if (!goal?.side) return undefined
    const before = { home: 0, away: 0 }
    for (const e of match.events) if (e.type === 'goal' && e.side && e !== goal && match.events.indexOf(e) < match.events.indexOf(goal)) before[e.side]++
    const other: Side = goal.side === 'home' ? 'away' : 'home'
    if (before[goal.side] === before[other] && goal.minute >= 80) return t('match.lateWinner')
    if (before[goal.side] + 1 === before[other]) return t('match.equaliser')
    return undefined
  })()
  const pens = fixture.cup && match.finished && match.score.home === match.score.away ? penalties(match, state.players) : null
  const best = match.finished ? bestPlayer(match, state.players) : null
  const paused = !running && !match.finished
  const leader: Side | null = momentum > LULL_TILT ? 'home' : momentum < -LULL_TILT ? 'away' : null
  const momentumText = leader ? t('match.lull.on', { club: state.clubs[match[leader].clubId].name }) : t('match.lull.even')
  // Long spells with nothing to report still say how the game is going, instead of an old line.
  const lull = !match.finished && !highlight && !goal && match.minute - (feed[0]?.e.minute ?? 0) >= LULL_MINUTES ? momentumText : null

  return (
    <div className="match">
      <div className="scorebar card">
        <span className="team"><Kit colors={homeClub.colors} /> {homeClub.name}</span>
        <span className="score-mid">
          <span className="score-big" data-testid="score">{score.home} – {score.away}</span>
          <span className="clock" data-testid="clock">{clockText(match.minute)}{match.added && match.minute >= 90 && !match.finished ? <small className="added"> {t('match.added', { n: match.added })}</small> : null}</span>
        </span>
        <span className="team right">{awayClub.name} <Kit colors={awayClub.colors} /></span>
        <div className="momentum" role="meter" aria-label={t('match.momentum')} aria-valuetext={momentumText} aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(momentum * 100)}>
          <span className="small muted">{t('match.momentum')}</span>
          <Kit colors={homeClub.colors} size={18} />
          <div className="momentum-track">
            <span className="momentum-fill" style={{ background: colors[momentum >= 0 ? 'home' : 'away'][0], left: momentum >= 0 ? '50%' : `${50 + momentum * 50}%`, width: `${Math.abs(momentum) * 50}%` }} />
          </div>
          <Kit colors={awayClub.colors} size={18} />
        </div>
        {score.home + score.away > 0 && (['home', 'away'] as Side[]).map((side) => (
          <ul key={side} className={`scorers small ${side}`}>
            {scorers(events, side).map((g) => <li key={g.playerId}><Icon name="ball" size={13} /> {state.players[g.playerId]?.lastName} {g.minutes.map((m) => `${m}'`).join(', ')}</li>)}
          </ul>
        ))}
      </div>

      <div className="match-grid">
        <div className="pitch-wrap card">
          <div className="pitch-stage">
            <PitchCanvas idle={idle} idleMs={MS_PER_MINUTE / speed} highlight={highlight} speed={speed} colors={colors} names={names} onDone={endHighlight} />
            {goal?.side && <GoalBanner player={name(goal.playerId) ?? ''} club={state.clubs[match[goal.side].clubId].name} colors={colors[goal.side]} label={goalLabel} />}
            {prompt && (
              <section className="assistant card" role="dialog" aria-label={t('match.assistant')}>
                <p><strong>{t('match.assistant')}:</strong> {promptText(prompt.key, prompt.params)}</p>
                <div className="row">
                  {prompt.options.map((o, i) => (
                    <button key={o.key + i} className={i === 0 ? 'primary' : ''} onClick={() => choose(o)}>{promptText(o.key, o.params)}</button>
                  ))}
                </div>
              </section>
            )}
          </div>
          <div className={`controls row ${match.finished ? '' : 'playing'}`}>
            {match.finished ? (
              <>
                <strong>{t('match.fulltime')}</strong>
                {pens && <strong>{t('cup.shootout', { home: pens.home, away: pens.away })}</strong>}
                {best && <span className="small">{t('stats.playerOfMatch', { player: name(best.playerId) ?? '', rating: best.rating.toFixed(1) })}</span>}
                <button className="primary" onClick={() => onFinish(match)}>{t('match.done')}</button>
              </>
            ) : (
              <>
                <button className="pause" onClick={() => { if (prompt) { setSeen((x) => [...x, prompt.id]); setPrompt(null) } setRunning((r) => !r) }}>{running ? t('match.pause') : t('match.resume')}</button>
                <span className="row speed" role="group" aria-label={t('match.speed')}>
                  {[1, 2, 4].map((s) => (
                    <button key={s} className={speed === s ? 'on' : ''} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>
                  ))}
                </span>
                <button className="skip" onClick={skip}>{t('match.skip')}</button>
                {match.minute === 45 && !running && <strong>{t('match.halftime')}</strong>}
              </>
            )}
          </div>
          {/* On phones the commentary sits further down, so the latest moments show here. */}
          <ol className="ticker" aria-hidden>
            {lull && <li className="ev lull"><span className="min">{clockText(match.minute)}</span> <span>{lull}</span></li>}
            {feed.slice(0, lull ? 1 : 2).map(({ e, i }) => (
              <li key={i} className={`ev ${e.type}`}><span className="min">{clockText(e.minute)}</span> <span>{line(e, i)}</span></li>
            ))}
          </ol>
          {!match.finished && (
            <div className="shouts" role="group" aria-label={t('match.shouts')}>
              <span className="small muted">{t('match.shouts')}</span>
              {SHOUTS.map((sh) => (
                <button
                  key={sh}
                  className={activeShout?.shout === sh ? 'on' : ''}
                  aria-pressed={activeShout?.shout === sh}
                  title={t(`match.shout.${sh}.desc`)}
                  disabled={banned || !canShout(match, mySide, sh) || !!prompt}
                  onClick={() => shout(sh)}
                >{t(`match.shout.${sh}`)}</button>
              ))}
              {banned && <span className="small shout-hint" role="note">{t('match.banned')}</span>}
              {!banned && !activeShout && !canShout(match, mySide, 'waste') && <span className="small muted shout-hint">{t('match.shout.wasteHint')}</span>}
              {activeShout && activeShout.until > match.minute && <span className="small" data-testid="shout-left">{t('match.shout.active', { shout: t(`match.shout.${activeShout.shout}`), n: activeShout.until - match.minute })}</span>}
            </div>
          )}
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
          <section className="card feed-card" role="log" tabIndex={0} aria-label={t('match.commentary')}>
            <ol className="feed" aria-live="polite" aria-label={t('match.commentary')}>
              {feed.map(({ e, i }) => (
                <li key={i} className={`ev ${e.type}`}>
                  <span className="min">{clockText(e.minute)}</span>
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
