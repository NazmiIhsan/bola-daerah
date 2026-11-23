import { newGame } from './generate'
import { applyResult, endSeason, isSeasonOver, playMatchday, userFixture } from './season'
import { createMatch } from './match/sim'
import type { MatchState } from './match/types'
import type { GameState } from './types'

const fresh = () => newGame(11, 'kapar')
const squadSize = (s: GameState, c: string) => Object.values(s.players).filter((p) => p.clubId === c).length

function playSeason(s: GameState): GameState {
  while (!isSeasonOver(s)) s = playMatchday(s)
  return s
}

/** Fill every fixture with a result so `winners` top their division and `losers` prop it up. */
function rigSeason(s: GameState, winners: string[], losers: string[]): GameState {
  return {
    ...s,
    matchday: 19,
    fixtures: s.fixtures.map((f) => {
      const score = (id: string) => (winners.includes(id) ? 5 + winners.indexOf(id) : losers.includes(id) ? 0 : 1)
      return { ...f, result: { home: score(f.homeId), away: score(f.awayId) } }
    }),
  }
}

test('playMatchday plays exactly that round\'s fixtures and increments matchday', () => {
  const s = playMatchday(fresh())
  expect(s.matchday).toBe(2)
  expect(s.fixtures.filter((f) => f.round === 1).every((f) => f.result)).toBe(true)
  expect(s.fixtures.filter((f) => f.round !== 1).some((f) => f.result)).toBe(false)
})

test('user bye week: userFixture is undefined and playMatchday still works', () => {
  let s = { ...newGame(11, 'petaling') }
  // find petaling's bye round
  const played = new Set(s.fixtures.filter((f) => f.homeId === 'petaling' || f.awayId === 'petaling').map((f) => f.round))
  const bye = [...Array(18).keys()].map((i) => i + 1).find((r) => !played.has(r))!
  s = { ...s, matchday: bye }
  expect(userFixture(s)).toBeUndefined()
  expect(playMatchday(s).matchday).toBe(bye + 1)
})

test('userFixture returns the user match on a match day', () => {
  const f = userFixture(fresh())!
  expect([f.homeId, f.awayId]).toContain('kapar')
  expect(f.round).toBe(1)
})

test('after 18 matchdays isSeasonOver is true and every fixture has a result', () => {
  const s = playSeason(fresh())
  expect(isSeasonOver(s)).toBe(true)
  expect(s.fixtures.every((f) => f.result)).toBe(true)
})

test('endSeason swaps bottom 2 of div1 with top 2 of div2', () => {
  const s = endSeason(rigSeason(fresh(), ['kapar', 'jugra'], ['petaling', 'klang']))
  expect(s.divisions[0].clubIds).toHaveLength(9)
  expect(s.divisions[1].clubIds).toHaveLength(10)
  expect(s.divisions[0].clubIds).toEqual(expect.arrayContaining(['kapar', 'jugra']))
  expect(s.divisions[1].clubIds).toEqual(expect.arrayContaining(['petaling', 'klang']))
  expect(s.season).toBe(2028)
  expect(s.matchday).toBe(1)
  expect(s.fixtures).toHaveLength(162)
  expect(s.fixtures.some((f) => f.result)).toBe(false)
})

test('promoted user club plays in div 1 next season (16 matches)', () => {
  const s = endSeason(rigSeason(fresh(), ['kapar', 'jugra'], ['petaling', 'klang']))
  expect(s.userClubId).toBe('kapar')
  const f = s.fixtures.filter((x) => x.homeId === 'kapar' || x.awayId === 'kapar')
  expect(f).toHaveLength(16)
  expect(f.every((x) => x.division === 1)).toBe(true)
})

test('relegated user club plays in div 2 next season (18 matches)', () => {
  const s = endSeason(rigSeason(newGame(3, 'petaling'), ['kapar', 'jugra'], ['petaling', 'klang']))
  const f = s.fixtures.filter((x) => x.homeId === 'petaling' || x.awayId === 'petaling')
  expect(f).toHaveLength(18)
  expect(userFixture(s)).toBeDefined()
})

test('red card gives a 1-match suspension that clears after the next matchday', () => {
  let s = fresh()
  const fx = userFixture(s)!
  let m: MatchState = createMatch(fx.homeId, fx.awayId, s.tactics, 1)
  const victim = s.tactics.kapar.lineup[3]
  const side = fx.homeId === 'kapar' ? 'home' : 'away'
  m = { ...m, minute: 90, finished: true, events: [...m.events, { minute: 30, side, type: 'red', playerId: victim, highlight: true }] }
  s = applyResult(s, fx.id, m)
  expect(s.players[victim].suspendedMatches).toBe(1)
  s = { ...s, matchday: 2 }
  // round 2: kapar plays (10 teams, no byes) → serves the ban
  s = playMatchday(s)
  expect(s.players[victim].suspendedMatches).toBe(0)
})

test('injury from a match keeps the player out for 1–4 weeks', () => {
  let s = fresh()
  const fx = userFixture(s)!
  const victim = s.tactics.kapar.lineup[5]
  const side = fx.homeId === 'kapar' ? 'home' : 'away'
  const m = { ...createMatch(fx.homeId, fx.awayId, s.tactics, 1), minute: 90, finished: true }
  m.events = [...m.events, { minute: 10, side, type: 'injury' as const, playerId: victim, highlight: false }]
  s = applyResult(s, fx.id, m)
  expect(s.players[victim].injuredWeeks).toBeGreaterThanOrEqual(1)
  expect(s.players[victim].injuredWeeks).toBeLessThanOrEqual(4)
})

test('suspended or injured players are not picked by AI clubs', () => {
  let s = fresh()
  const pid = s.tactics.klang.lineup[2]
  s = { ...s, players: { ...s.players, [pid]: { ...s.players[pid], injuredWeeks: 3 } } }
  s = playMatchday(s)
  expect(s.tactics.klang.lineup).not.toContain(pid)
})

test('squads stay 22–25 after endSeason retirements', () => {
  let s = rigSeason(fresh(), ['kapar', 'jugra'], ['petaling', 'klang'])
  // make some players old so they retire
  const players = { ...s.players }
  for (const p of Object.values(players).slice(0, 60)) players[p.id] = { ...p, age: 35 }
  s = endSeason({ ...s, players })
  for (const c of Object.keys(s.clubs)) {
    expect(squadSize(s, c)).toBeGreaterThanOrEqual(22)
    expect(squadSize(s, c)).toBeLessThanOrEqual(25)
  }
  expect(Object.values(s.players).every((p) => p.age <= 35)).toBe(true)
  for (const c of Object.keys(s.clubs)) for (const id of s.tactics[c].lineup) expect(s.players[id]).toBeDefined()
})

test('deterministic: same state + same calls gives same result', () => {
  expect(playMatchday(playMatchday(fresh()))).toEqual(playMatchday(playMatchday(fresh())))
})
