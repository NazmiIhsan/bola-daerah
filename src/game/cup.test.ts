import { CUP_WEEKS, cupDue, cupPrize, cupRoundName, cupTieOf, newCup } from './cup'
import { newGame } from './generate'
import { migrate } from './migrate'
import { penalties } from './match/penalties'
import { createMatch, simulateFull } from './match/sim'
import { matchRatings } from './match/ratings'
import { createRng } from './rng'
import { acceptJob, endSeason, isSeasonOver, matchTactics, playMatchday, preMatch, userFixture } from './season'
import { honours } from './stats'
import { makeV4 } from './testUtils'
import type { GameState } from './types'

const base = newGame(6, 'petaling')
const keep = (s: GameState): GameState => ({ ...s, press: null, career: { kind: 'employed' }, board: { ...s.board, confidence: 80 } })
const season = (s: GameState) => { let n = 0; while (!isSeasonOver(s) && n++ < 60) s = playMatchday(keep(s)); return s }
const until = (s: GameState, stop: (x: GameState) => boolean) => { let n = 0; while (!stop(s) && !isSeasonOver(s) && n++ < 60) s = playMatchday(keep(s)); return s }
const ended = season(base)

test('the draw: six smallest clubs play a preliminary round and nobody is drawn twice', () => {
  const cup = newCup(base, createRng(1))
  expect(cup.rounds).toHaveLength(1)
  const ids = cup.rounds[0].flatMap((t) => [t.homeId, t.awayId])
  const small = Object.values(base.clubs).sort((a, b) => a.reputation - b.reputation || a.id.localeCompare(b.id)).slice(0, 6).map((c) => c.id)
  expect([...ids].sort()).toEqual([...small].sort())
})

test('a season plays 3, 8, 4, 2 and 1 ties and finds one winner', () => {
  expect(ended.cup!.rounds.map((r) => r.length)).toEqual([3, 8, 4, 2, 1])
  for (const t of ended.cup!.rounds.flat()) {
    expect(t.result).toBeDefined()
    expect([t.homeId, t.awayId]).toContain(t.winnerId)
    if (t.result!.home === t.result!.away) expect(t.pens!.home).not.toBe(t.pens!.away)
    else expect(t.pens).toBeUndefined()
  }
  expect(ended.cup!.rounds[4][0].winnerId).toBeDefined()
})

test('every round is made of the winners of the last, plus those who entered late', () => {
  const r = ended.cup!.rounds
  for (let i = 1; i < r.length; i++) {
    const ids = r[i].flatMap((t) => [t.homeId, t.awayId])
    expect(new Set(ids).size).toBe(ids.length)
    for (const w of r[i - 1].map((t) => t.winnerId!)) expect(ids).toContain(w)
  }
  expect(r[1].flatMap((t) => [t.homeId, t.awayId])).toHaveLength(16)
})

test('a club from the lower division is always at home to one from the higher', () => {
  const div = (id: string) => base.divisions.findIndex((d) => d.clubIds.includes(id))
  for (const t of ended.cup!.rounds.flat()) expect(div(t.homeId)).toBeGreaterThanOrEqual(div(t.awayId))
})

test('the user plays a cup tie before the league round, and the matchday waits', () => {
  const s = until(base, (x) => cupDue(x) && !!cupTieOf(x, 'petaling'))
  const tie = cupTieOf(s, 'petaling')!
  expect(CUP_WEEKS).toContain(s.matchday)
  expect(userFixture(s)).toMatchObject({ id: tie.id, cup: true })
  const n = playMatchday(keep(s))
  expect(n.matchday).toBe(s.matchday)
  expect(userFixture(n)?.cup).toBeFalsy()
  expect(n.cup!.rounds.flat().find((t) => t.id === tie.id)!.winnerId).toBeDefined()
})

test('league fixtures are untouched by the cup and all get played', () => {
  expect(ended.fixtures).toHaveLength(base.fixtures.length)
  expect(ended.fixtures.every((f) => f.result)).toBe(true)
})

test('a user who is out never has to wait for the cup', () => {
  let s = base
  for (let n = 0; n < 60 && !isSeasonOver(s); n++) {
    if (cupDue(s)) expect(cupTieOf(s, 'petaling')).toBeDefined()
    s = playMatchday(keep(s))
  }
})

test('the live match counts: the result the user played is the one recorded', () => {
  const s = until(base, (x) => cupDue(x) && !!cupTieOf(x, 'petaling'))
  const f = userFixture(s)!
  const m = simulateFull(f.homeId, f.awayId, matchTactics(s), s.players, 4)
  const t = playMatchday(keep(s), m).cup!.rounds.flat().find((x) => x.id === f.id)!
  expect(t.result).toEqual(m.score)
  if (m.score.home === m.score.away) expect(t.pens).toEqual(penalties(m, s.players))
})

test('cup ties cost energy, with less rest than a full week, and count in the stats', () => {
  const s = until(base, (x) => cupDue(x) && !!cupTieOf(x, 'petaling'))
  const f = userFixture(s)!
  const m = simulateFull(f.homeId, f.awayId, matchTactics(s), s.players, 4)
  const n = playMatchday(keep(s), m)
  const id = m[f.homeId === 'petaling' ? 'home' : 'away'].tactics.lineup[0]
  const before = s.players[id]
  expect(n.players[id].fitness).toBeCloseTo(Math.min(100, Math.max(0, before.fitness - (30 - before.attrs.stamina)) + 10))
  expect(n.players[id].apps).toBe(before.apps + 1)
  expect(n.players[id].ratingSum).toBeCloseTo(before.ratingSum + matchRatings(m, s.players)[id])
})

test('a cup run earns money, and no wages are paid for the midweek game', () => {
  const s = until(base, (x) => cupDue(x) && !!cupTieOf(x, 'petaling'))
  const n = playMatchday(keep(s))
  const won = n.cup!.rounds.flat().find((t) => t.id === userFixture(s)!.id)!.winnerId === 'petaling'
  expect(n.finance.balance - s.finance.balance).toBeGreaterThanOrEqual(won ? cupPrize(n.cup!.rounds.length - 2) : 0)
  expect(n.finance.history[0].wages).toBe(0)
})

test('there are no press conferences before cup ties', () => {
  const s = until(base, (x) => cupDue(x) && !!cupTieOf(x, 'petaling'))
  for (let i = 0; i < 30; i++) expect(preMatch({ ...s, press: null, rngState: i * 977 }).press).toBeNull()
})

test('penalties always have a winner, repeat exactly, and follow a level match', () => {
  const t = matchTactics(base)
  for (let k = 0; k < 80; k++) {
    const m = simulateFull('petaling', 'klang', t, base.players, k)
    const p = penalties(m, base.players)
    expect(p.home).not.toBe(p.away)
    expect(penalties(m, base.players)).toEqual(p)
  }
})

test('a side with no keeper or almost nobody left still finishes a shoot-out', () => {
  const m = { ...createMatch('petaling', 'klang', matchTactics(base), 3), finished: true, minute: 90 }
  const p = penalties({ ...m, home: { ...m.home, onPitch: m.home.onPitch.map((id, i) => (i === 5 ? id : '')) } }, base.players)
  expect(p.home).not.toBe(p.away)
})

test('the winner is remembered, and next season has a new cup', () => {
  const final = ended.cup!.rounds[4][0]
  const n = endSeason(keep(ended))
  expect(n.history[0].cup).toEqual({ winnerId: final.winnerId, runnerUpId: final.winnerId === final.homeId ? final.awayId : final.homeId })
  expect(honours(n, final.winnerId!).cup).toBe(1)
  expect(n.cup!.rounds).toHaveLength(1)
  expect(n.cup!.rounds[0].every((t) => !t.result)).toBe(true)
})

test('small clubs knock out big ones often enough to dream, but big clubs usually win', () => {
  let shocks = 0, across = 0, big = 0
  const n = 12
  for (let seed = 1; seed <= n; seed++) {
    const s = season(newGame(seed, 'jugra'))
    const div = (id: string) => s.divisions.findIndex((d) => d.clubIds.includes(id))
    for (const t of s.cup!.rounds.flat()) if (div(t.homeId) !== div(t.awayId)) { across++; if (div(t.winnerId!) === 1) shocks++ }
    if (['petaling', 'klang', 'hulu-langat', 'gombak'].includes(s.cup!.rounds[4][0].winnerId!)) big++
  }
  expect(shocks / across).toBeGreaterThan(0.1)
  expect(shocks / across).toBeLessThan(0.5)
  expect(big / n).toBeGreaterThan(0.5)
}, 60000)

test('changing clubs in the middle of a cup round never blocks the season', () => {
  let s = until(newGame(9, 'kapar'), (x) => cupDue(x) && !!cupTieOf(x, 'kapar'))
  s = acceptJob({ ...s, career: { kind: 'sacked', offers: ['jugra'] } }, 'jugra')
  expect(isSeasonOver(season(s))).toBe(true)
})

test('a season in an older save finishes without a cup, then the next one has it', () => {
  const m = migrate(makeV4())
  expect(m.cup).toBeNull()
  const e = season(m)
  expect(isSeasonOver(e)).toBe(true)
  const n = endSeason(keep(e))
  expect(n.history[0].cup).toBeNull()
  expect(n.cup).not.toBeNull()
})

test('round names run from the preliminary round to the final', () => {
  expect([0, 1, 2, 3, 4].map(cupRoundName)).toEqual(['prelim', 'r16', 'qf', 'sf', 'final'])
})
