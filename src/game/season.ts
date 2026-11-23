import { createRng, type Rng } from './rng'
import { generatePlayer, squadQuality } from './generate'
import { simulateFull } from './match/sim'
import type { MatchState } from './match/types'
import { buildFixtures } from './schedule'
import { computeTable } from './table'
import { isAvailable, pickBestLineup } from './tactics'
import type { Division, Fixture, GameState, Player, Tactics } from './types'
import { applyWeek, attendance, prizeMoney } from './finance'
import { applyReaction, expectationFor, resultReaction, seasonEndReaction, shouldSack, userPosition, weeklyBoardCheck } from './reactions'
import { addNews, matchdayNews, seasonEndNews, seasonStartNews } from './news'
import { maybePress } from './press'
import { isRivalry } from './rivals'
import { sack, takeJob } from './career'

export const ROUNDS_PER_SEASON = 18
export const RETIRE_AFTER_AGE = 35

export function userFixture(state: GameState): Fixture | undefined {
  return state.fixtures.find(
    (f) => f.round === state.matchday && (f.homeId === state.userClubId || f.awayId === state.userClubId),
  )
}

export function isSeasonOver(state: GameState): boolean {
  return state.matchday > ROUNDS_PER_SEASON
}

const squadOf = (state: GameState, clubId: string): Player[] =>
  Object.values(state.players).filter((p) => p.clubId === clubId)

/** Re-pick a valid XI keeping formation and style. AI clubs always re-pick; the user only when the XI is invalid. */
function refreshTactics(state: GameState, clubId: string, force: boolean): Tactics {
  const t = state.tactics[clubId]
  const squad = squadOf(state, clubId)
  const valid =
    t.lineup.length === 11 &&
    [...t.lineup, ...t.subs].every((id) => state.players[id]?.clubId === clubId && isAvailable(state.players[id]))
  if (!force && valid) return t
  return { ...t, ...pickBestLineup(squad, t.formation) }
}

/** Mutates `players` (a copy owned by the caller) with cards, injuries and fatigue from one match. */
function applyMatchEffects(players: Record<string, Player>, match: MatchState, rng: Rng) {
  const touch = (id: string) => (players[id] = { ...players[id] })
  const played = new Set<string>()
  for (const t of [match.home, match.away]) {
    for (const id of [...t.tactics.lineup, ...t.onPitch, ...t.sentOff]) if (id) played.add(id)
  }
  for (const e of match.events) {
    if (e.type === 'sub' && e.subOnId) played.add(e.subOnId)
    if (!e.playerId || !players[e.playerId]) continue
    if (e.type === 'yellow') {
      const p = touch(e.playerId)
      p.yellowCards += 1
      if (p.yellowCards >= 5) {
        p.yellowCards = 0
        p.suspendedMatches += 1
      }
    } else if (e.type === 'red') {
      touch(e.playerId).suspendedMatches = 1
    } else if (e.type === 'injury') {
      touch(e.playerId).injuredWeeks = rng.int(1, 4)
    }
  }
  for (const id of played) {
    if (!players[id]) continue
    const p = touch(id)
    p.fitness = Math.max(0, p.fitness - (30 - p.attrs.stamina))
  }
}

export function applyResult(state: GameState, fixtureId: string, match: MatchState): GameState {
  const rng = createRng(state.rngState)
  const players = { ...state.players }
  applyMatchEffects(players, match, rng)
  return {
    ...state,
    rngState: rng.state(),
    players,
    fixtures: state.fixtures.map((f) => (f.id === fixtureId ? { ...f, result: { ...match.score } } : f)),
  }
}

/** Lineups as they will be at kick-off: AI clubs re-pick, the user's XI is kept unless invalid. */
export function matchTactics(state: GameState): Record<string, Tactics> {
  const tactics: Record<string, Tactics> = {}
  for (const clubId of Object.keys(state.clubs)) tactics[clubId] = refreshTactics(state, clubId, clubId !== state.userClubId)
  return tactics
}

function simulateRound(state: GameState, userMatch?: MatchState): GameState {
  const round = state.fixtures.filter((f) => f.round === state.matchday)
  const playing = new Set(round.flatMap((f) => [f.homeId, f.awayId]))

  // 1. Lineups for this round
  const tactics = matchTactics(state)

  // 2. Weekly ticks: injuries heal, bans are served by clubs that play, fitness recovers
  const players: Record<string, Player> = {}
  for (const p of Object.values(state.players)) {
    players[p.id] = {
      ...p,
      injuredWeeks: Math.max(0, p.injuredWeeks - 1),
      suspendedMatches: playing.has(p.clubId) ? Math.max(0, p.suspendedMatches - 1) : p.suspendedMatches,
      fitness: Math.min(100, p.fitness + 20),
    }
  }

  // 3. Play the round
  const rng = createRng(state.rngState)
  const results = new Map<string, { home: number; away: number }>()
  for (const f of round) {
    const isUser = f.homeId === state.userClubId || f.awayId === state.userClubId
    const opts = isUser && f.homeId === state.userClubId ? { homeBoost: userHomeBoost(state) } : {}
    const match = isUser && userMatch ? userMatch : simulateFull(f.homeId, f.awayId, tactics, state.players, rng.int(1, 2 ** 31), opts)
    applyMatchEffects(players, match, rng)
    results.set(f.id, { ...match.score })
  }

  return {
    ...state,
    rngState: rng.state(),
    matchday: state.matchday + 1,
    tactics,
    players,
    fixtures: state.fixtures.map((f) => (results.has(f.id) ? { ...f, result: results.get(f.id) } : f)),
  }
}

export interface SeasonSummary {
  promoted: string[]
  relegated: string[]
  champions: [string, string]
}

export function seasonSummary(state: GameState): SeasonSummary {
  const t1 = computeTable(state.divisions[0].clubIds, state.fixtures.filter((f) => f.division === 1))
  const t2 = computeTable(state.divisions[1].clubIds, state.fixtures.filter((f) => f.division === 2))
  return {
    champions: [t1[0].clubId, t2[0].clubId],
    relegated: t1.slice(-2).map((r) => r.clubId),
    promoted: t2.slice(0, 2).map((r) => r.clubId),
  }
}

function rollOverSeason(state: GameState): GameState {
  const rng = createRng(state.rngState)
  const { promoted, relegated } = seasonSummary(state)
  const divisions: [Division, Division] = [
    { id: 1, clubIds: [...state.divisions[0].clubIds.filter((c) => !relegated.includes(c)), ...promoted] },
    { id: 2, clubIds: [...state.divisions[1].clubIds.filter((c) => !promoted.includes(c)), ...relegated] },
  ]

  const players: Record<string, Player> = {}
  for (const p of Object.values(state.players)) {
    const aged = { ...p, age: p.age + 1, yellowCards: 0, suspendedMatches: 0 }
    if (aged.age > RETIRE_AFTER_AGE) {
      const club = state.clubs[p.clubId]
      const youth = generatePlayer(rng, p.clubId, p.position, squadQuality(club) - 3, rng.int(17, 19))
      players[youth.id] = youth
    } else {
      players[aged.id] = aged
    }
  }

  const next: GameState = {
    ...state,
    rngState: rng.state(),
    season: state.season + 1,
    matchday: 1,
    divisions,
    players,
    fixtures: buildFixtures(divisions),
  }
  const tactics = { ...state.tactics }
  for (const clubId of Object.keys(state.clubs)) tactics[clubId] = refreshTactics(next, clubId, clubId !== state.userClubId)
  return { ...next, tactics }
}

/** 1 + (fan mood − 50) / 1000 when the user plays at home this round, else 1. */
export function userHomeBoost(state: GameState): number {
  const f = userFixture(state)
  if (!f || f.homeId !== state.userClubId) return 1
  return 1 + (state.fans.mood - 50) / 1000
}

/** Before the user's match: maybe a pre-match press conference. */
export function preMatch(state: GameState): GameState {
  if (state.career.kind === 'sacked' || state.press) return state
  const f = userFixture(state)
  if (!f) return state
  const rng = createRng(state.rngState)
  const press = maybePress(state, 'pre', f, rng)
  return { ...state, press, rngState: rng.state() }
}

function adjustMorale(state: GameState, ids: string[], delta: number): GameState {
  const players = { ...state.players }
  for (const id of ids) {
    const p = players[id]
    if (p) players[id] = { ...p, morale: Math.max(0, Math.min(100, p.morale + delta)) }
  }
  return { ...state, players }
}

export function playMatchday(state: GameState, userMatch?: MatchState): GameState {
  if (isSeasonOver(state) || state.career.kind === 'sacked') return state
  const me = state.userClubId
  const before = { ...state, press: null }
  let s = simulateRound(before, userMatch)
  const rng = createRng(s.rngState)
  const fixture = s.fixtures.find((f) => f.round === state.matchday && (f.homeId === me || f.awayId === me))

  // Money: home gate if the user played at home
  let homeAttendance: number | undefined
  if (fixture && fixture.homeId === me) {
    const { position, size } = userPosition(state)
    homeAttendance = attendance(s.clubs[me], state.fans.mood, position, size, isRivalry(s.clubs[me], s.clubs[fixture.awayId]))
  }
  s = { ...s, finance: applyWeek({ ...s, matchday: state.matchday }, { homeAttendance }) }

  // Fans, board, morale
  if (fixture?.result) {
    s = applyReaction({ ...s, matchday: state.matchday }, resultReaction(s, fixture))
    const mine = fixture.homeId === me ? fixture.result.home : fixture.result.away
    const theirs = fixture.homeId === me ? fixture.result.away : fixture.result.home
    const playedIds = userMatch ? [...userMatch.home.tactics.lineup, ...userMatch.away.tactics.lineup].filter((id) => s.players[id]?.clubId === me) : s.tactics[me].lineup
    if (mine !== theirs) s = adjustMorale(s, playedIds, mine > theirs ? 5 : -5)
  }
  s = applyReaction({ ...s, matchday: state.matchday }, weeklyBoardCheck(s))
  s = { ...s, matchday: state.matchday + 1 }

  // News, post-match press, sacking
  s = addNews({ ...s, matchday: state.matchday }, matchdayNews(before, s), rng)
  s = { ...s, matchday: state.matchday + 1 }
  if (fixture?.result) s = { ...s, press: maybePress(s, 'post', fixture, rng) }
  // In-season rule only; the season-end verdict is endSeason's job.
  if (shouldSack({ ...s, matchday: Math.min(s.matchday, ROUNDS_PER_SEASON) })) s = sack(s, rng)
  return { ...s, rngState: rng.state() }
}

export function endSeason(state: GameState): GameState {
  const rng = createRng(state.rngState)
  let ended: GameState = { ...state, press: null }
  if (ended.career.kind === 'employed') {
    const { position, division } = userPosition(ended)
    ended = { ...ended, finance: applyWeek(ended, { prize: prizeMoney(division, position) }) }
    ended = applyReaction(ended, seasonEndReaction(ended))
  }
  ended = addNews(ended, seasonEndNews(ended), rng)
  const sacked = ended.career.kind === 'employed' && shouldSack(ended)
  let next = rollOverSeason({ ...ended, rngState: rng.state() })
  const rng2 = createRng(next.rngState)
  if (next.career.kind === 'employed') {
    next = { ...next, board: { ...expectationFor(next), confidence: next.board.confidence } }
    if (sacked) next = sack(next, rng2)
    else next = addNews(next, seasonStartNews(next), rng2)
  }
  return { ...next, rngState: rng2.state() }
}

/** Take a job offer; if the old season has ended, roll it over first so the new club starts fresh. */
export function acceptJob(state: GameState, clubId: string): GameState {
  return takeJob(isSeasonOver(state) ? endSeason(state) : state, clubId)
}
