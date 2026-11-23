import { createRng, type Rng } from '../rng'
import { slotRoles, teamStrength } from '../tactics'
import type { Player, Position, Style, Tactics } from '../types'
import type { LiveTeam, MatchEvent, MatchOptions, MatchState, Side, TeamChange } from './types'

/** Tuning constants (calibrated by balance.test.ts). */
export const SIM = {
  chanceBase: 0.12,
  chanceExponent: 1.6,
  homeAttack: 1.04,
  homePossession: 1.04,
  conversionBase: 0.24,
  onTargetShare: 0.5,
  bigMissHighlight: 0.35,
  yellowPerMinute: 0.02,
  straightRedPerMinute: 0.0006,
  injuryPerMinute: 0.0012,
}

/** How much a style creates chances for itself. */
const OWN: Record<Style, number> = { attacking: 1.25, balanced: 1, defensive: 0.72, counter: 0.88 }
/** How open a style leaves you to the opponent. */
const OPEN: Record<Style, number> = { attacking: 1.2, balanced: 1, defensive: 0.72, counter: 0.95 }
const COUNTER_VS_ATTACKING = 1.35

const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')

function liveTeam(clubId: string, t: Tactics): LiveTeam {
  const onPitch = Array.from({ length: 11 }, (_, i) => t.lineup[i] ?? '')
  return { clubId, tactics: { ...t, lineup: [...t.lineup], subs: [...t.subs] }, onPitch, bench: [...t.subs], subsUsed: 0, sentOff: [] }
}

export function createMatch(homeId: string, awayId: string, tactics: Record<string, Tactics>, seed: number, opts: MatchOptions = {}): MatchState {
  return {
    minute: 0,
    score: { home: 0, away: 0 },
    events: [{ minute: 0, type: 'kickoff', highlight: false }],
    home: liveTeam(homeId, tactics[homeId]),
    away: liveTeam(awayId, tactics[awayId]),
    rngState: createRng(seed).state(),
    finished: false,
    homeBoost: opts.homeBoost ?? 1,
    ...(opts.sharpness ? { sharpness: opts.sharpness } : {}),
  }
}

function cloneTeam(t: LiveTeam): LiveTeam {
  return { ...t, tactics: { ...t.tactics }, onPitch: [...t.onPitch], bench: [...t.bench], sentOff: [...t.sentOff] }
}

/** Pick a player on the pitch, weighted by role. */
function pickByRole(rng: Rng, team: LiveTeam, weights: Record<Position, number>, exclude?: string): string | undefined {
  const roles = slotRoles(team.tactics.formation)
  const cands: Array<[string, number]> = []
  team.onPitch.forEach((id, i) => {
    if (id && id !== exclude) cands.push([id, weights[roles[i]]])
  })
  const total = cands.reduce((s, [, w]) => s + w, 0)
  if (total <= 0) return undefined
  let r = rng.next() * total
  for (const [id, w] of cands) {
    r -= w
    if (r <= 0) return id
  }
  return cands[cands.length - 1][0]
}

function removeFromPitch(team: LiveTeam, id: string) {
  const i = team.onPitch.indexOf(id)
  if (i >= 0) team.onPitch[i] = ''
}

export function stepMinute(state: MatchState, players: Record<string, Player>): MatchState {
  if (state.finished) return state
  const rng = createRng(state.rngState)
  const s: MatchState = {
    ...state,
    minute: state.minute + 1,
    score: { ...state.score },
    events: [...state.events],
    home: cloneTeam(state.home),
    away: cloneTeam(state.away),
  }
  const minute = s.minute
  const strength = (side: Side) => {
    const base = teamStrength(s[side].onPitch.map((id) => (id ? players[id] : undefined)), s[side].tactics.formation)
    const edge = s.sharpness?.[side]
    return edge ? { ...base, attack: base.attack * edge.attack, defence: base.defence * edge.defence } : base
  }
  const st = { home: strength('home'), away: strength('away') }

  // Who attacks this minute
  const mh = st.home.midfield ** 2 * SIM.homePossession
  const ma = st.away.midfield ** 2
  const att: Side = rng.next() < mh / (mh + ma || 1) ? 'home' : 'away'
  const def = other(att)
  const aStyle = s[att].tactics.style
  const dStyle = s[def].tactics.style
  let styleMod = OWN[aStyle] * OPEN[dStyle]
  if (aStyle === 'counter' && dStyle === 'attacking') styleMod *= COUNTER_VS_ATTACKING
  const homeMod = att === 'home' ? SIM.homeAttack * (s.homeBoost ?? 1) : 1
  const ratio = st[att].attack / Math.max(0.5, st[def].defence)
  const pChance = Math.min(0.6, SIM.chanceBase * ratio ** SIM.chanceExponent * styleMod * homeMod)

  if (rng.next() < pChance) {
    const shooterId = pickByRole(rng, s[att], { GK: 0, DF: 0.4, MF: 1.5, FW: 3 })
    if (shooterId) {
      const shooter = players[shooterId]
      const q = shooter.attrs.finishing * 0.7 + shooter.attrs.composure * 0.3
      const gk = Math.max(1, st[def].goalkeeping)
      const pGoal = Math.min(0.5, Math.max(0.05, SIM.conversionBase * (q / gk) ** 0.8))
      const roll = rng.next()
      if (roll < pGoal) {
        const assistId = rng.chance(0.75) ? pickByRole(rng, s[att], { GK: 0.05, DF: 0.5, MF: 2, FW: 1.5 }, shooterId) : undefined
        s.score[att]++
        s.events.push({ minute, side: att, type: 'goal', playerId: shooterId, assistId, highlight: true })
      } else if (roll < pGoal + (1 - pGoal) * SIM.onTargetShare) {
        s.events.push({ minute, side: att, type: 'save', playerId: shooterId, highlight: true })
      } else {
        s.events.push({ minute, side: att, type: 'miss', playerId: shooterId, highlight: rng.chance(SIM.bigMissHighlight) })
      }
    }
  }

  // Discipline and injuries, both sides
  for (const side of ['home', 'away'] as Side[]) {
    const team = s[side]
    if (rng.next() < SIM.yellowPerMinute) {
      const id = pickByRole(rng, team, { GK: 0.1, DF: 2, MF: 1.5, FW: 0.7 })
      if (id) {
        const already = s.events.some((e) => e.type === 'yellow' && e.playerId === id)
        s.events.push({ minute, side, type: 'yellow', playerId: id, highlight: false })
        if (already) {
          s.events.push({ minute, side, type: 'red', playerId: id, highlight: true })
          team.sentOff.push(id)
          removeFromPitch(team, id)
        }
      }
    }
    if (rng.next() < SIM.straightRedPerMinute) {
      const id = pickByRole(rng, team, { GK: 0.2, DF: 2, MF: 1, FW: 0.5 })
      if (id) {
        s.events.push({ minute, side, type: 'red', playerId: id, highlight: true })
        team.sentOff.push(id)
        removeFromPitch(team, id)
      }
    }
    if (rng.next() < SIM.injuryPerMinute) {
      const id = pickByRole(rng, team, { GK: 0.3, DF: 1, MF: 1, FW: 1 })
      if (id) {
        s.events.push({ minute, side, type: 'injury', playerId: id, highlight: false })
        // automatic replacement if possible, else the slot stays empty
        const slot = team.onPitch.indexOf(id)
        if (team.subsUsed < 5 && team.bench.length > 0) {
          const onId = team.bench.shift()!
          team.onPitch[slot] = onId
          team.subsUsed++
          s.events.push({ minute, side, type: 'sub', playerId: id, subOnId: onId, highlight: false })
        } else {
          team.onPitch[slot] = ''
        }
      }
    }
  }

  if (minute === 45) s.events.push({ minute, type: 'halftime', highlight: false })
  if (minute === 90) {
    s.events.push({ minute, type: 'fulltime', highlight: false })
    s.finished = true
  }
  s.rngState = rng.state()
  return s
}

export function applyChange(state: MatchState, side: Side, change: TeamChange): MatchState {
  const team = cloneTeam(state[side])
  const events: MatchEvent[] = [...state.events]
  if (change.kind === 'sub') {
    if (team.subsUsed >= 5) throw new Error('No substitutions left')
    const slot = team.onPitch.indexOf(change.offId)
    if (!change.offId || slot < 0) throw new Error('Player is not on the pitch')
    const b = team.bench.indexOf(change.onId)
    if (b < 0) throw new Error('Player is not on the bench')
    team.onPitch[slot] = change.onId
    team.bench.splice(b, 1)
    team.subsUsed++
    events.push({ minute: state.minute, side, type: 'sub', playerId: change.offId, subOnId: change.onId, highlight: false })
  } else {
    if (change.formation) team.tactics.formation = change.formation
    if (change.style) team.tactics.style = change.style
  }
  return { ...state, events, [side]: team }
}

export function simulateFull(homeId: string, awayId: string, tactics: Record<string, Tactics>, players: Record<string, Player>, seed: number, opts: MatchOptions = {}): MatchState {
  let m = createMatch(homeId, awayId, tactics, seed, opts)
  while (!m.finished) m = stepMinute(m, players)
  return m
}
