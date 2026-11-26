import { derbyEdge, isRamadan, storyWeek } from './story'
import { createRng, type Rng } from './rng'
import { advanceCup, cupDue, cupFixture, cupPrize, cupTieOf, newCup } from './cup'
import { cupNews } from './cupNews'
import { penalties } from './match/penalties'
import { CUP_SEED, overall } from './generate'
import { minutesPlayed } from './match/minutes'
import { matchRatings } from './match/ratings'
import { simulateFull } from './match/sim'
import type { MatchOptions, MatchState } from './match/types'
import { buildFixtures } from './schedule'
import { computeTable } from './table'
import { isAvailable, pickBestLineup } from './tactics'
import type { CupTie, Division, Fixture, GameState, Player, Tactics } from './types'
import { applyWeek, attendance, divisionOf, prizeMoney, TICKET_PRICE } from './finance'
import { applyReaction, expectationFor, resultReaction, seasonEndReaction, shouldSack, userPosition, weeklyBoardCheck } from './reactions'
import { addNews, matchdayNews, seasonEndNews, seasonStartNews } from './news'
import { maybePress } from './press'
import { aiTactics, isAiRun, managerOf, trainingByClub, trainingOf } from './manager'
import { developWeek } from './development'
import { aiIntake, intakeNews, youthIntake, youthWeek } from './youth'
import { darkHorseNews, moveReputations, rollForm, underdogNews } from './momentum'
import { isRivalry } from './rivals'
import { awardNews, seasonRecord } from './stats'
import { sack, takeJob } from './career'
import { departureNews, expireContracts, refillSquads, resetMarket, transferWeek, trimFreeAgents } from './transferWeek'

export const ROUNDS_PER_SEASON = 18
export const RETIRE_AFTER_AGE = 35
const FOCUS_EDGE = 1.02

/** The user's next match: a cup tie when its round is due, else the league game. */
export function userFixture(state: GameState): Fixture | undefined {
  return cupFixture(state, state.userClubId) ?? state.fixtures.find(
    (f) => f.round === state.matchday && (f.homeId === state.userClubId || f.awayId === state.userClubId),
  )
}

export function isSeasonOver(state: GameState): boolean {
  return state.matchday > ROUNDS_PER_SEASON
}

const squadOf = (state: GameState, clubId: string): Player[] =>
  Object.values(state.players).filter((p) => p.clubId === clubId)

/** AI managers plan afresh. The user's formation and style stay, and the XI too unless it is invalid. */
function refreshTactics(state: GameState, clubId: string): Tactics {
  if (isAiRun(state, clubId)) return aiTactics(state, clubId)
  const t = state.tactics[clubId]
  const squad = squadOf(state, clubId)
  const valid =
    t.lineup.length === 11 &&
    [...t.lineup, ...t.subs].every((id) => state.players[id]?.clubId === clubId && isAvailable(state.players[id]))
  if (valid) return t
  return { ...t, ...pickBestLineup(squad, t.formation) }
}

/** Mutates `players` (a copy owned by the caller) with cards, injuries and fatigue from one match. */
function applyMatchEffects(players: Record<string, Player>, match: MatchState, rng: Rng, tiring = 1) {
  const touch = (id: string) => (players[id] = { ...players[id] })
  const ratings = matchRatings(match, players)
  for (const e of match.events) {
    if (!e.playerId || !players[e.playerId]) continue
    if (e.type === 'goal') {
      touch(e.playerId).goals += 1
      if (e.assistId && players[e.assistId]) touch(e.assistId).assists += 1
    }
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
  for (const [id, minutes] of Object.entries(minutesPlayed(match))) {
    if (!players[id]) continue
    const p = touch(id)
    p.apps += 1
    if (ratings[id] !== undefined) {
      p.ratingSum += ratings[id]
      p.rated += 1
    }
    // Added time is not counted: a full match costs the same however long the referee plays on.
    p.fitness = Math.max(0, p.fitness - (tiring * (30 - p.attrs.stamina) * Math.min(90, minutes)) / 90)
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
  for (const clubId of Object.keys(state.clubs)) tactics[clubId] = refreshTactics(state, clubId)
  return tactics
}

function simulateRound(state: GameState, userMatch?: MatchState): GameState {
  const round = state.fixtures.filter((f) => f.round === state.matchday)
  const playing = new Set(round.flatMap((f) => [f.homeId, f.awayId]))

  // 1. Lineups for this round
  const tactics = matchTactics(state)

  // 2. Weekly ticks: injuries heal, bans are served by clubs that play
  const players: Record<string, Player> = {}
  for (const p of Object.values(state.players)) {
    players[p.id] = {
      ...p,
      injuredWeeks: Math.max(0, p.injuredWeeks - 1),
      suspendedMatches: playing.has(p.clubId) ? Math.max(0, p.suspendedMatches - 1) : p.suspendedMatches,
      ...(p.away ? { away: playing.has(p.clubId) ? p.away - 1 : p.away } : {}),
    }
  }

  // 3. Play the round
  const rng = createRng(state.rngState)
  const results = new Map<string, { home: number; away: number }>()
  for (const f of round) {
    const isUser = f.homeId === state.userClubId || f.awayId === state.userClubId
    const match = isUser && userMatch ? userMatch : simulateFull(f.homeId, f.awayId, tactics, state.players, rng.int(1, 2 ** 31), matchOptions(state, f))
    applyMatchEffects(players, match, rng, isRamadan(state) ? RAMADAN_TIRING : 1)
    results.set(f.id, { ...match.score })
  }

  // 4. A week's rest before the next kick-off
  const focus = trainingByClub(state)
  for (const p of Object.values(players)) players[p.id] = { ...p, fitness: Math.min(100, p.fitness + (focus[p.clubId] === 'fitness' ? 25 : 20)) }

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

function rollOverSeason(ended: GameState): { state: GameState; left: Player[] } {
  const rng = createRng(ended.rngState)
  const { state, left } = expireContracts(ended, rng)
  const { promoted, relegated, champions } = seasonSummary(state)
  const divisions: [Division, Division] = [
    { id: 1, clubIds: [...state.divisions[0].clubIds.filter((c) => !relegated.includes(c)), ...promoted] },
    { id: 2, clubIds: [...state.divisions[1].clubIds.filter((c) => !promoted.includes(c)), ...relegated] },
  ]

  const players: Record<string, Player> = {}
  for (const p of Object.values(state.players)) {
    const aged = { ...p, age: p.age + 1, fitness: 100, yellowCards: 0, suspendedMatches: 0, apps: 0, goals: 0, assists: 0, ratingSum: 0, rated: 0, ovrStart: overall(p) }
    if (aged.age <= RETIRE_AFTER_AGE) players[aged.id] = aged
  }

  let next: GameState = {
    ...state,
    season: state.season + 1,
    matchday: 1,
    divisions,
    clubs: moveReputations(state),
    players,
    fixtures: buildFixtures(divisions),
  }
  next = { ...next, cup: newCup(next, createRng((next.seed ^ CUP_SEED ^ Math.imul(next.season, 2654435761)) >>> 0)) }
  next = resetMarket(trimFreeAgents(refillSquads(aiIntake(next, rng), rng)))
  next = { ...next, form: rollForm(next, rng, champions), youth: { intake: next.career.kind === 'employed' ? youthIntake(rng, next, next.userClubId) : [] } }
  next = { ...next, rngState: rng.state() }
  const tactics = { ...state.tactics }
  for (const clubId of Object.keys(state.clubs)) tactics[clubId] = refreshTactics(next, clubId)
  return { state: { ...next, tactics }, left }
}

/** 1 + (fan mood − 50) / 1000 when the user plays at home this round, else 1. */
export function userHomeBoost(state: GameState): number {
  const f = userFixture(state)
  if (!f || f.homeId !== state.userClubId) return 1
  return 1 + (state.fans.mood - 50) / 1000
}

/** A club's edge in matches: training focus, and season form for AI clubs. */
function clubSharpness(state: GameState, clubId: string): { attack: number; defence: number } {
  const focus = trainingOf(state, clubId)
  const form = isAiRun(state, clubId) ? state.form[clubId] ?? 1 : 1
  return { attack: form * (focus === 'attack' ? FOCUS_EDGE : 1), defence: form * (focus === 'defence' ? FOCUS_EDGE : 1) }
}

/** Crowd and form effects for a fixture, and who is on each touchline. */
export function matchOptions(state: GameState, f: Pick<Fixture, 'homeId' | 'awayId'> & { id?: string }): MatchOptions {
  // Fighting talk before a derby fires the user's players up a little.
  const edge = f.id ? derbyEdge(state, f.id) : 1
  const sharp = (clubId: string) => {
    const base = clubSharpness(state, clubId)
    return clubId === state.userClubId && edge !== 1 ? { attack: base.attack * edge, defence: base.defence * edge } : base
  }
  return {
    homeBoost: f.homeId === state.userClubId ? userHomeBoost(state) : 1,
    sharpness: { home: sharp(f.homeId), away: sharp(f.awayId) },
    managers: {
      ...(isAiRun(state, f.homeId) ? { home: managerOf(state, f.homeId) } : {}),
      ...(isAiRun(state, f.awayId) ? { away: managerOf(state, f.awayId) } : {}),
    },
  }
}

/** Before the user's match: maybe a pre-match press conference. */
export function preMatch(state: GameState): GameState {
  if (state.career.kind === 'sacked' || state.press) return state
  const f = userFixture(state)
  if (!f || f.cup) return state
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

const MIDWEEK_REST = 10
/** Fasting weeks: matches take more out of the legs. */
const RAMADAN_TIRING = 1.2

/** Play the cup round that is due. The league matchday does not move. */
function playCupRound(state: GameState, userMatch?: MatchState): GameState {
  const me = state.userClubId
  const round = state.cup!.rounds.length - 1
  const tactics = matchTactics(state)
  const players = { ...state.players }
  const rng = createRng(state.rngState)
  let mine: { tie: CupTie; match: MatchState } | undefined
  const played = state.cup!.rounds[round].map((t): CupTie => {
    const isMine = t.homeId === me || t.awayId === me
    const match = isMine && userMatch ? userMatch : simulateFull(t.homeId, t.awayId, tactics, state.players, rng.int(1, 2 ** 31), matchOptions(state, t))
    const pens = match.score.home === match.score.away ? penalties(match, state.players) : undefined
    applyMatchEffects(players, match, rng)
    const homeWon = pens ? pens.home > pens.away : match.score.home > match.score.away
    const tie: CupTie = { ...t, result: { ...match.score }, ...(pens ? { pens } : {}), winnerId: homeWon ? t.homeId : t.awayId }
    if (isMine) mine = { tie, match }
    return tie
  })
  for (const p of Object.values(players)) players[p.id] = { ...p, fitness: Math.min(100, p.fitness + MIDWEEK_REST) }
  let s: GameState = { ...state, press: null, players, cup: advanceCup(state, played, rng) }

  if (mine) {
    const { tie, match } = mine
    const won = tie.winnerId === me, home = tie.homeId === me
    const club = s.clubs[me]
    const { position, size } = userPosition(state)
    const crowd = home ? attendance(club, state.fans.mood, position, size, isRivalry(club, s.clubs[tie.awayId])) : undefined
    const tickets = (crowd ?? 0) * TICKET_PRICE[divisionOf(state, me)]
    const prize = won ? cupPrize(round) : 0
    s = { ...s, finance: { ...s.finance, balance: s.finance.balance + tickets + prize, history: [{ season: s.season, matchday: s.matchday, tickets, sponsor: 0, prize, wages: 0, ...(crowd !== undefined ? { attendance: crowd } : {}) }, ...s.finance.history].slice(0, 40) } }
    // Fans and players judge a shoot-out by who went through.
    const score = tie.pens ? { home: tie.result!.home + (won === home ? 1 : 0), away: tie.result!.away + (won === home ? 0 : 1) } : tie.result!
    s = applyReaction(s, resultReaction(s, { id: tie.id, division: 1, round: s.matchday, homeId: tie.homeId, awayId: tie.awayId, result: score, cup: true }))
    s = adjustMorale(s, match[home ? 'home' : 'away'].tactics.lineup, won ? 5 : -5)
  }
  s = addNews(s, cupNews(state, s, played, round), rng)
  return { ...s, rngState: rng.state() }
}

/** Rounds the user is not part of play themselves, so nobody has to wait for them. */
function settleCup(state: GameState): GameState {
  return cupDue(state) && !cupTieOf(state, state.userClubId) ? playCupRound(state) : state
}

export function playMatchday(given: GameState, userMatch?: MatchState): GameState {
  if (isSeasonOver(given) || given.career.kind === 'sacked') return given
  if (cupDue(given) && cupTieOf(given, given.userClubId)) return settleCup(playCupRound(given, userMatch))
  const state = settleCup(given)
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
  s = youthWeek(before, s, rng)
  s = developWeek(before, s, rng)
  s = transferWeek(s, rng)
  s = storyWeek(before, s, rng)
  // In-season rule only; the season-end verdict is endSeason's job.
  if (shouldSack({ ...s, matchday: Math.min(s.matchday, ROUNDS_PER_SEASON) })) s = sack(s, rng)
  return settleCup({ ...s, rngState: rng.state() })
}

export function endSeason(state: GameState): GameState {
  const rng = createRng(state.rngState)
  let ended: GameState = { ...state, press: null }
  if (ended.career.kind === 'employed') {
    const { position, division } = userPosition(ended)
    ended = { ...ended, finance: applyWeek(ended, { prize: prizeMoney(division, position) }) }
    ended = applyReaction(ended, seasonEndReaction(ended))
  }
  const record = seasonRecord(ended)
  ended = addNews(ended, [...underdogNews(ended), ...seasonEndNews(ended), ...awardNews(record)], rng)
  ended = { ...ended, history: [record, ...ended.history] }
  const sacked = ended.career.kind === 'employed' && shouldSack(ended)
  const rolled = rollOverSeason({ ...ended, rngState: rng.state() })
  let next = rolled.state
  const rng2 = createRng(next.rngState)
  if (next.career.kind === 'employed') {
    next = { ...next, board: { ...expectationFor(next), confidence: next.board.confidence } }
    if (sacked) next = sack(next, rng2)
    else next = addNews(next, [...departureNews(next.userClubId, rolled.left), ...intakeNews(next), ...seasonStartNews(next), ...darkHorseNews(next, rng2)], rng2)
  }
  next = transferWeek(next, rng2)
  return { ...next, rngState: rng2.state() }
}

/** Take a job offer; if the old season has ended, roll it over first so the new club starts fresh. */
export function acceptJob(state: GameState, clubId: string): GameState {
  return takeJob(isSeasonOver(state) ? endSeason(state) : state, clubId)
}
