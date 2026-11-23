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

test('squads stay 17–28 after endSeason retirements', () => {
  let s = rigSeason(fresh(), ['kapar', 'jugra'], ['petaling', 'klang'])
  // make some players old so they retire
  const players = { ...s.players }
  for (const p of Object.values(players).slice(0, 60)) players[p.id] = { ...p, age: 35 }
  s = endSeason({ ...s, players })
  for (const c of Object.keys(s.clubs)) {
    expect(squadSize(s, c)).toBeGreaterThanOrEqual(17)
    expect(squadSize(s, c)).toBeLessThanOrEqual(28)
  }
  expect(Object.values(s.players).every((p) => p.age <= 35)).toBe(true)
  for (const c of Object.keys(s.clubs)) for (const id of s.tactics[c].lineup) expect(s.players[id]).toBeDefined()
})

test('deterministic: same state + same calls gives same result', () => {
  expect(playMatchday(playMatchday(fresh()))).toEqual(playMatchday(playMatchday(fresh())))
})

test('matchTactics fixes an invalid user lineup and keeps a valid one', async () => {
  const { matchTactics } = await import('./season')
  const s = fresh()
  expect(matchTactics(s).kapar).toEqual(s.tactics.kapar)
  const hurt = s.tactics.kapar.lineup[4]
  const s2 = { ...s, players: { ...s.players, [hurt]: { ...s.players[hurt], injuredWeeks: 2 } } }
  const t = matchTactics(s2).kapar
  expect(t.lineup).not.toContain(hurt)
  expect(t.lineup).toHaveLength(11)
  expect(t.style).toBe(s.tactics.kapar.style)
})

describe('season integration (plan 2)', () => {
  test('playMatchday books the week, reacts, and writes news', async () => {
    const s0 = fresh()
    const s = playMatchday(s0)
    expect(s.finance.history).toHaveLength(1)
    expect(s.finance.history[0].matchday).toBe(1)
    expect(s.inbox.some((n) => n.kind === 'match')).toBe(true)
    const f = s.fixtures.find((x) => x.round === 1 && (x.homeId === 'kapar' || x.awayId === 'kapar'))!
    const g = f.homeId === 'kapar' ? f.result!.home : f.result!.away
    const c = f.homeId === 'kapar' ? f.result!.away : f.result!.home
    if (g !== c) expect(s.fans.log[0].delta).not.toBe(0)
    if (f.homeId === 'kapar') expect(s.finance.history[0].attendance).toBeGreaterThan(0)
  })

  test('starters gain morale after a win and lose it after a loss', () => {
    const s0 = fresh()
    const fx = userFixture(s0)!
    const home = fx.homeId === 'kapar'
    const make = (mine: number, theirs: number) => {
      const m = { ...createMatch(fx.homeId, fx.awayId, s0.tactics, 1), minute: 90, finished: true, score: home ? { home: mine, away: theirs } : { home: theirs, away: mine } }
      return playMatchday(s0, m)
    }
    const starter = s0.tactics.kapar.lineup[3]
    expect(make(3, 0).players[starter].morale).toBeGreaterThan(s0.players[starter].morale)
    expect(make(0, 3).players[starter].morale).toBeLessThan(s0.players[starter].morale)
  })

  test('preMatch creates a press conference before a derby, none on a bye', async () => {
    const { preMatch } = await import('./season')
    const k = newGame(1, 'klang')
    const derby = k.fixtures.find((f) => [f.homeId, f.awayId].sort().join() === 'klang,petaling')!
    expect(preMatch({ ...k, matchday: derby.round }).press).not.toBeNull()
    const p = newGame(1, 'petaling')
    const played = new Set(p.fixtures.filter((f) => f.homeId === 'petaling' || f.awayId === 'petaling').map((f) => f.round))
    const bye = [...Array(18).keys()].map((i) => i + 1).find((r) => !played.has(r))!
    expect(preMatch({ ...p, matchday: bye }).press).toBeNull()
  })

  test('endSeason adds prize money, resets the board target for the new division, adds season news', () => {
    const s = endSeason(rigSeason(fresh(), ['kapar', 'jugra'], ['petaling', 'klang']))
    expect(s.finance.history.some((h) => h.prize > 0)).toBe(true)
    expect(s.board.expectation).toBe('avoidRelegation') // kapar is now in div 1 with low reputation
    expect(s.inbox.some((n) => n.key === 'news.season.promoted')).toBe(true)
    expect(s.inbox.some((n) => n.key.startsWith('news.board.expectation.'))).toBe(true)
  })

  test('userHomeBoost', async () => {
    const { userHomeBoost } = await import('./season')
    const s = fresh()
    const fx = userFixture(s)!
    const atHome = fx.homeId === 'kapar'
    const boost = userHomeBoost({ ...s, fans: { ...s.fans, mood: 100 } })
    expect(boost).toBe(atHome ? 1.05 : 1)
  })
})
