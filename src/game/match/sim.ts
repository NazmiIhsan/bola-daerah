import { createRng, type Rng } from '../rng'
import { manage } from './bench'
import { contribution, matchup, slotRoles, teamStrength } from '../tactics'
import type { Player, Position, Style, Tactics } from '../types'
import type { ChanceKind, LiveTeam, MatchEvent, MatchOptions, MatchState, Shout, Side, TeamChange } from './types'

/** Tuning constants (calibrated by balance.test.ts). */
export const SIM = {
  chanceBase: 0.116,
  chanceExponent: 1.6,
  homeAttack: 1.04,
  homePossession: 1.04,
  conversionBase: 0.24,
  onTargetShare: 0.5,
  bigMissHighlight: 0.3,
  /** a miss at least this good always gets a highlight */
  bigChance: 0.3,
  yellowPerMinute: 0.02,
  straightRedPerMinute: 0.0006,
  injuryPerMinute: 0.0012,
}

/** How much a style creates chances for itself. */
const OWN: Record<Style, number> = { attacking: 1.25, balanced: 1, defensive: 0.72, counter: 0.88 }
/** How open a style leaves you to the opponent. */
const OPEN: Record<Style, number> = { attacking: 1.2, balanced: 1, defensive: 0.72, counter: 0.95 }
const COUNTER_VS_ATTACKING = 1.35
/** How many more (or fewer) chances a formation creates against one it troubles (or that troubles it). */
const MATCHUP_EDGE = 0.09

/** Share of chances that come from set pieces. */
const SET_PIECE = { penalty: 0.025, corner: 0.12, freekick: 0.07 }
/** How much likelier a goal is from each kind of chance than from an average one. */
const KIND_CONVERSION: Record<Exclude<ChanceKind, 'penalty'>, number> = {
  cross: 0.9, through: 1.4, long: 0.45, counter: 1.35, solo: 1.1, corner: 0.75, freekick: 0.55,
}

/** Momentum: how fast it fades each minute and how much it moves chances and possession. */
const MOMENTUM = { decay: 0.92, chance: 0.25, possession: 0.15, goal: 0.3, red: 0.4, save: 0.08, encourage: 0.35 }

/** Shouts last this many minutes. */
export const SHOUT_MINUTES = 10
/** What a shout does to your chances and to the opponent's. */
const SHOUT_EFFECT: Record<Shout, { own: number; opp: number; cards: number }> = {
  attack: { own: 1.22, opp: 1.12, cards: 1 },
  calm: { own: 0.92, opp: 0.86, cards: 0.6 },
  waste: { own: 0.7, opp: 0.85, cards: 1.2 },
  encourage: { own: 1, opp: 1, cards: 1 },
}

const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

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
    possession: { home: 0, away: 0 },
    homeBoost: opts.homeBoost ?? 1,
    momentum: 0,
    ...(opts.sharpness ? { sharpness: opts.sharpness } : {}),
    ...(opts.managers ? { managers: opts.managers } : {}),
  }
}

function cloneTeam(t: LiveTeam): LiveTeam {
  return { ...t, tactics: { ...t.tactics }, onPitch: [...t.onPitch], bench: [...t.bench], sentOff: [...t.sentOff], ...(t.since ? { since: { ...t.since } } : {}) }
}

/** Pick a player on the pitch, weighted by role (and optionally by the player). */
function pickByRole(rng: Rng, team: LiveTeam, weights: Record<Position, number>, exclude?: string, players?: Record<string, Player>, by?: (p: Player) => number): string | undefined {
  const roles = slotRoles(team.tactics.formation)
  const cands: Array<[string, number]> = []
  team.onPitch.forEach((id, i) => {
    if (id && id !== exclude) cands.push([id, weights[roles[i]] * (by && players?.[id] ? by(players[id]) : 1)])
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

/** The outfield player on the pitch who is best at something (penalties, free kicks, corners). */
function bestAt(team: LiveTeam, players: Record<string, Player>, score: (p: Player) => number, exclude?: string): string | undefined {
  let best: string | undefined
  team.onPitch.forEach((id, i) => {
    if (!id || i === 0 || id === exclude || !players[id]) return
    if (!best || score(players[id]) > score(players[best])) best = id
  })
  return best
}

function removeFromPitch(team: LiveTeam, id: string) {
  const i = team.onPitch.indexOf(id)
  if (i >= 0) team.onPitch[i] = ''
}

/** The bench player who would do best in a slot. A goalkeeper covers an outfield slot only when nobody else is left. */
function replacementFor(team: LiveTeam, slot: number, players: Record<string, Player>): string {
  const role = slotRoles(team.tactics.formation)[slot]
  const outfield = team.bench.filter((id) => players[id].position !== 'GK')
  const options = role !== 'GK' && outfield.length ? outfield : team.bench
  return options.reduce((a, b) => (contribution(players[b], role) > contribution(players[a], role) ? b : a))
}

/** Average of an attribute over the players in some roles, on a 0..2 scale around an ordinary 10. */
function roleAvg(team: LiveTeam, players: Record<string, Player>, roles: Position[], attr: (p: Player) => number): number {
  const slots = slotRoles(team.tactics.formation)
  let sum = 0, n = 0
  team.onPitch.forEach((id, i) => {
    if (id && players[id] && roles.includes(slots[i])) { sum += attr(players[id]); n++ }
  })
  return n ? sum / n / 10 : 0.5
}

const penaltySkill = (p: Player) => p.attrs.finishing * 0.7 + p.attrs.composure * 0.3
const freeKickSkill = (p: Player) => p.attrs.finishing * 0.4 + p.attrs.passing * 0.4 + p.attrs.composure * 0.2
const cornerSkill = (p: Player) => p.attrs.passing

/** How a chance came about: set pieces first, then open play shaped by the players and the style. */
export function chanceKind(rng: Rng, att: LiveTeam, def: LiveTeam, players: Record<string, Player>): ChanceKind {
  const r = rng.next()
  if (r < SET_PIECE.penalty) return 'penalty'
  if (r < SET_PIECE.penalty + SET_PIECE.corner) return 'corner'
  if (r < SET_PIECE.penalty + SET_PIECE.corner + SET_PIECE.freekick) return 'freekick'
  const a = (roles: Position[], f: (p: Player) => number) => roleAvg(att, players, roles, f)
  const weights: Array<[ChanceKind, number]> = [
    ['cross', 1.2 * a(['DF', 'MF'], (p) => p.attrs.passing * 0.5 + p.attrs.pace * 0.5) * a(['FW'], (p) => p.attrs.strength)],
    ['through', 1.0 * a(['MF'], (p) => p.attrs.passing) * a(['FW'], (p) => p.attrs.pace)],
    ['long', 0.75 * a(['MF'], (p) => p.attrs.finishing)],
    ['solo', 0.6 * a(['FW', 'MF'], (p) => p.attrs.dribbling) ** 2],
    ['counter', 0.35 * (att.tactics.style === 'counter' ? 2.4 : 1) * (def.tactics.style === 'attacking' ? 1.6 : 1) * a(['FW'], (p) => p.attrs.pace)],
  ]
  const total = weights.reduce((s, [, w]) => s + w, 0)
  let x = rng.next() * total
  for (const [k, w] of weights) {
    x -= w
    if (x <= 0) return k
  }
  return 'cross'
}

/** Who takes the shot for each kind of chance. */
function shooterFor(kind: ChanceKind, rng: Rng, team: LiveTeam, players: Record<string, Player>): string | undefined {
  switch (kind) {
    case 'penalty': return bestAt(team, players, penaltySkill)
    case 'freekick': return bestAt(team, players, freeKickSkill)
    case 'corner': return pickByRole(rng, team, { GK: 0, DF: 1.6, MF: 0.6, FW: 2 }, bestAt(team, players, cornerSkill), players, (p) => p.attrs.strength)
    case 'long': return pickByRole(rng, team, { GK: 0, DF: 0.3, MF: 3, FW: 0.8 })
    case 'solo': return pickByRole(rng, team, { GK: 0, DF: 0.1, MF: 1, FW: 3 }, undefined, players, (p) => p.attrs.dribbling)
    case 'counter': return pickByRole(rng, team, { GK: 0, DF: 0.1, MF: 1, FW: 3.5 }, undefined, players, (p) => p.attrs.pace)
    default: return pickByRole(rng, team, { GK: 0, DF: 0.4, MF: 1.5, FW: 3 })
  }
}

/** How good the shooter is at this kind of finish. */
function shotQuality(kind: ChanceKind, p: Player): number {
  const a = p.attrs
  switch (kind) {
    case 'cross':
    case 'corner': return a.strength * 0.45 + a.positioning * 0.3 + a.finishing * 0.25
    case 'solo': return a.dribbling * 0.4 + a.finishing * 0.4 + a.composure * 0.2
    case 'through':
    case 'counter': return a.finishing * 0.6 + a.composure * 0.25 + a.pace * 0.15
    case 'long': return a.finishing * 0.65 + a.composure * 0.2 + a.passing * 0.15
    case 'freekick': return freeKickSkill(p)
    case 'penalty': return penaltySkill(p)
  }
}

/** Who set the chance up, if anyone. */
function assistFor(kind: ChanceKind, rng: Rng, team: LiveTeam, players: Record<string, Player>, shooterId: string): string | undefined {
  switch (kind) {
    case 'penalty':
    case 'freekick':
    case 'solo': return undefined
    case 'corner': {
      const taker = bestAt(team, players, cornerSkill, shooterId)
      return rng.chance(0.8) ? taker : undefined
    }
    case 'cross': return pickByRole(rng, team, { GK: 0, DF: 1.2, MF: 2, FW: 0.6 }, shooterId)
    case 'through': return pickByRole(rng, team, { GK: 0, DF: 0.2, MF: 3, FW: 1 }, shooterId, players, (p) => p.attrs.passing)
    case 'long': return rng.chance(0.4) ? pickByRole(rng, team, { GK: 0, DF: 0.5, MF: 2, FW: 1 }, shooterId) : undefined
    default: return rng.chance(0.75) ? pickByRole(rng, team, { GK: 0.05, DF: 0.5, MF: 2, FW: 1.5 }, shooterId) : undefined
  }
}

/** Chance of a goal before the roll. */
function goalChance(kind: ChanceKind, shooter: Player, keeper: number): number {
  const gk = Math.max(1, keeper)
  if (kind === 'penalty') return clamp(0.76 + (penaltySkill(shooter) - gk) * 0.012, 0.55, 0.92)
  const q = shotQuality(kind, shooter)
  return clamp(SIM.conversionBase * KIND_CONVERSION[kind] * (q / gk) ** 0.8, 0.03, 0.6)
}

/** Momentum from one side's point of view, −1..1. */
const momentumFor = (s: MatchState, side: Side) => (side === 'home' ? 1 : -1) * (s.momentum ?? 0)
function swing(s: MatchState, side: Side, amount: number) {
  s.momentum = clamp((s.momentum ?? 0) + (side === 'home' ? amount : -amount), -1, 1)
}
const shoutOf = (s: MatchState, side: Side) => s.shouts?.[side]?.shout

/** Added time: more for goals, cards, changes and time-wasting. */
function stoppage(s: MatchState, rng: Rng): number {
  const second = s.events.filter((e) => e.minute > 45)
  const n = (...types: MatchEvent['type'][]) => second.filter((e) => types.includes(e.type)).length
  const wasting = s.events.filter((e) => e.type === 'shout' && e.shout === 'waste').length
  const raw = 1 + n('goal') * 0.5 + n('sub') * 0.3 + n('yellow', 'red') * 0.3 + n('injury') * 1 + wasting + rng.int(0, 1)
  return clamp(Math.round(raw), 1, 7)
}

/** When the match ends: 90 plus stoppage, once that is known. */
export const endMinute = (s: Pick<MatchState, 'added'>) => 90 + (s.added ?? 0)

export function stepMinute(state: MatchState, players: Record<string, Player>): MatchState {
  if (state.finished) return state
  const rng = createRng(state.rngState)
  const s: MatchState = {
    ...state,
    minute: state.minute + 1,
    score: { ...state.score },
    possession: { ...state.possession },
    events: [...state.events],
    home: cloneTeam(state.home),
    away: cloneTeam(state.away),
    ...(state.shouts ? { shouts: { ...state.shouts } } : {}),
  }
  const minute = s.minute
  // Shouts run out
  for (const side of ['home', 'away'] as Side[]) {
    if (s.shouts?.[side] && s.shouts[side]!.until < minute) delete s.shouts[side]
  }
  const strength = (side: Side) => {
    const base = teamStrength(s[side].onPitch.map((id) => (id ? players[id] : undefined)), s[side].tactics.formation, (p) => minute - (s[side].since?.[p.id] ?? 0))
    const edge = s.sharpness?.[side]
    return edge ? { ...base, attack: base.attack * edge.attack, defence: base.defence * edge.defence } : base
  }
  const st = { home: strength('home'), away: strength('away') }

  // Who attacks this minute
  const mom = s.momentum ?? 0
  const mh = st.home.midfield ** 2 * SIM.homePossession * (1 + MOMENTUM.possession * mom)
  const ma = st.away.midfield ** 2 * (1 - MOMENTUM.possession * mom)
  const att: Side = rng.next() < mh / (mh + ma || 1) ? 'home' : 'away'
  const def = other(att)
  s.possession[att]++
  const aStyle = s[att].tactics.style
  const dStyle = s[def].tactics.style
  let styleMod = OWN[aStyle] * OPEN[dStyle]
  if (aStyle === 'counter' && dStyle === 'attacking') styleMod *= COUNTER_VS_ATTACKING
  const shapeMod = 1 + MATCHUP_EDGE * matchup(s[att].tactics.formation, s[def].tactics.formation)
  const homeMod = att === 'home' ? SIM.homeAttack * (s.homeBoost ?? 1) : 1
  const momMod = 1 + MOMENTUM.chance * momentumFor(s, att)
  const aShout = shoutOf(s, att), dShout = shoutOf(s, def)
  const shoutMod = (aShout ? SHOUT_EFFECT[aShout].own : 1) * (dShout ? SHOUT_EFFECT[dShout].opp : 1)
  const ratio = st[att].attack / Math.max(0.5, st[def].defence)
  const pChance = Math.min(0.6, SIM.chanceBase * ratio ** SIM.chanceExponent * styleMod * shapeMod * homeMod * momMod * shoutMod)

  if (rng.next() < pChance) {
    const kind = chanceKind(rng, s[att], s[def], players)
    const shooterId = shooterFor(kind, rng, s[att], players)
    if (shooterId) {
      const shooter = players[shooterId]
      const pGoal = goalChance(kind, shooter, st[def].goalkeeping)
      const xg = Math.round(pGoal * 100) / 100
      const setPiece = kind === 'penalty' || kind === 'freekick' || kind === 'corner'
      const roll = rng.next()
      if (roll < pGoal) {
        const assistId = assistFor(kind, rng, s[att], players, shooterId)
        s.score[att]++
        s.events.push({ minute, side: att, type: 'goal', playerId: shooterId, assistId, highlight: true, kind, xg })
        swing(s, att, MOMENTUM.goal)
      } else if (roll < pGoal + (1 - pGoal) * SIM.onTargetShare) {
        s.events.push({ minute, side: att, type: 'save', playerId: shooterId, highlight: true, kind, xg })
        swing(s, def, MOMENTUM.save)
      } else {
        const big = setPiece || xg >= SIM.bigChance
        s.events.push({ minute, side: att, type: 'miss', playerId: shooterId, highlight: big || rng.chance(SIM.bigMissHighlight), kind, xg })
      }
    }
  }

  // Discipline and injuries, both sides
  for (const side of ['home', 'away'] as Side[]) {
    const team = s[side]
    const sh = shoutOf(s, side)
    const cards = sh ? SHOUT_EFFECT[sh].cards : 1
    if (rng.next() < SIM.yellowPerMinute * cards) {
      const id = pickByRole(rng, team, { GK: 0.1, DF: 2, MF: 1.5, FW: 0.7 })
      if (id) {
        const already = s.events.some((e) => e.type === 'yellow' && e.playerId === id)
        s.events.push({ minute, side, type: 'yellow', playerId: id, highlight: false })
        if (already) {
          s.events.push({ minute, side, type: 'red', playerId: id, highlight: true })
          team.sentOff.push(id)
          removeFromPitch(team, id)
          swing(s, other(side), MOMENTUM.red)
        }
      }
    }
    if (rng.next() < SIM.straightRedPerMinute) {
      const id = pickByRole(rng, team, { GK: 0.2, DF: 2, MF: 1, FW: 0.5 })
      if (id) {
        s.events.push({ minute, side, type: 'red', playerId: id, highlight: true })
        team.sentOff.push(id)
        removeFromPitch(team, id)
        swing(s, other(side), MOMENTUM.red)
      }
    }
    if (rng.next() < SIM.injuryPerMinute) {
      const id = pickByRole(rng, team, { GK: 0.3, DF: 1, MF: 1, FW: 1 })
      if (id) {
        s.events.push({ minute, side, type: 'injury', playerId: id, highlight: false })
        // automatic replacement if possible, else the slot stays empty
        const slot = team.onPitch.indexOf(id)
        if (team.subsUsed < 5 && team.bench.length > 0) {
          const onId = replacementFor(team, slot, players)
          team.bench = team.bench.filter((x) => x !== onId)
          team.onPitch[slot] = onId
          team.since = { ...team.since, [onId]: minute }
          team.subsUsed++
          s.events.push({ minute, side, type: 'sub', playerId: id, subOnId: onId, highlight: false })
        } else {
          team.onPitch[slot] = ''
        }
      }
    }
  }

  for (const side of ['home', 'away'] as Side[]) {
    const m = s.managers?.[side]
    if (m && minute < 90) manage(s, side, m, players)
  }

  s.momentum = Math.round((s.momentum ?? 0) * MOMENTUM.decay * 1000) / 1000

  if (minute === 45) s.events.push({ minute, type: 'halftime', highlight: false })
  if (minute === 90) {
    s.added = stoppage(s, rng)
    s.events.push({ minute, type: 'stoppage', added: s.added, highlight: false })
  }
  if (minute >= 90 && minute >= endMinute(s)) {
    s.events.push({ minute, type: 'fulltime', highlight: false })
    s.finished = true
  }
  s.rngState = rng.state()
  return s
}

/** Whether a side may shout this now, and if not, why. */
export function canShout(state: MatchState, side: Side, shout: Shout): boolean {
  if (state.finished) return false
  const active = state.shouts?.[side]
  if (active && active.until >= state.minute + 1) return false
  if (shout === 'waste' && state.score[side] <= state.score[other(side)]) return false
  return true
}

export function applyChange(state: MatchState, side: Side, change: TeamChange): MatchState {
  if (change.kind === 'shout') {
    if (!canShout(state, side, change.shout)) throw new Error('Cannot shout that now')
    const next: MatchState = {
      ...state,
      events: [...state.events, { minute: state.minute, side, type: 'shout', shout: change.shout, highlight: false }],
      shouts: { ...state.shouts, [side]: { shout: change.shout, until: state.minute + SHOUT_MINUTES } },
    }
    if (change.shout === 'encourage') swing(next, side, MOMENTUM.encourage)
    return next
  }
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
    team.since = { ...team.since, [change.onId]: state.minute }
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
