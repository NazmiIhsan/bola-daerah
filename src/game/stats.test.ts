import { newGame } from './generate'
import { migrate } from './migrate'
import { createMatch, simulateFull } from './match/sim'
import { bestPlayer, matchRatings } from './match/ratings'
import type { MatchEvent, MatchState } from './match/types'
import { averageRating, honours, seasonAwards, topScorers } from './stats'
import { acceptJob, applyResult, endSeason, isSeasonOver, matchTactics, playMatchday, userFixture } from './season'
import { makeV3, makeV4 } from './testUtils'
import type { GameState, Player } from './types'

const base = newGame(6, 'kapar')
const f = userFixture(base)!
const side = f.homeId === 'kapar' ? ('home' as const) : ('away' as const)
const xi = matchTactics(base).kapar.lineup

function finished(events: MatchEvent[]): MatchState {
  const m = createMatch(f.homeId, f.awayId, matchTactics(base), 1)
  const goals = events.filter((e) => e.type === 'goal' && e.side === side).length
  return { ...m, minute: 90, finished: true, score: { home: 0, away: 0, [side]: goals }, events: [...m.events, ...events] }
}
const goal = (playerId: string, assistId?: string): MatchEvent => ({ minute: 20, side, type: 'goal', playerId, assistId, highlight: true })
const season = (s: GameState) => {
  while (!isSeasonOver(s)) s = playMatchday({ ...s, press: null, board: { ...s.board, confidence: 80 } })
  return s
}
const ended = season(base)

test('goals, assists, appearances and ratings are added up', () => {
  const s = applyResult(base, f.id, finished([goal(xi[9], xi[6]), goal(xi[9])]))
  expect(s.players[xi[9]]).toMatchObject({ goals: 2, assists: 0, apps: 1 })
  expect(s.players[xi[6]]).toMatchObject({ goals: 0, assists: 1 })
  expect(averageRating(s.players[xi[9]])).toBeGreaterThan(averageRating(s.players[xi[8]])!)
  expect(averageRating(base.players[xi[9]])).toBeNull()
})

test('ratings stay between 3 and 10, reward scorers and punish red cards', () => {
  for (let k = 0; k < 60; k++) for (const r of Object.values(matchRatings(simulateFull(f.homeId, f.awayId, matchTactics(base), base.players, k), base.players))) { expect(r).toBeGreaterThanOrEqual(3); expect(r).toBeLessThanOrEqual(10) }
  const plain = matchRatings(finished([]), base.players), scored = matchRatings(finished([goal(xi[9])]), base.players), red = matchRatings(finished([{ minute: 20, side, type: 'red', playerId: xi[5], highlight: true }]), base.players)
  expect(scored[xi[9]]).toBeGreaterThan(plain[xi[9]] + 0.5)
  expect(red[xi[5]]).toBeLessThan(plain[xi[5]] - 0.8)
})

test('only players who were on the pitch are rated, and the best of them is player of the match', () => {
  const m = finished([goal(xi[9]), goal(xi[9])])
  const r = matchRatings(m, base.players)
  expect(Object.keys(r)).toHaveLength(22)
  expect(bestPlayer(m, base.players)).toMatchObject({ playerId: xi[9] })
})

test('every league and cup goal of a season belongs to a player', () => {
  const scored = [...ended.fixtures, ...ended.cup!.rounds.flat()].reduce((n, x) => n + (x.result ? x.result.home + x.result.away : 0), 0)
  const credited = Object.values(ended.players).reduce((n, p) => n + p.goals, 0)
  expect(credited).toBe(scored)
})

test('top scorers are listed per division, best first', () => {
  for (const d of ended.divisions) {
    const list = topScorers(ended, d.id, 5)
    expect(list).toHaveLength(5)
    for (let i = 1; i < list.length; i++) expect(list[i - 1].goals).toBeGreaterThanOrEqual(list[i].goals)
    for (const p of list) expect(d.clubIds).toContain(p.clubId)
  }
  expect(topScorers(base, 1, 5)).toEqual([])
})

test('a season ends with a golden boot and a best player per division', () => {
  const a = seasonAwards(ended)
  expect(a.goldenBoot[0]!.value).toBe(topScorers(ended, 1, 1)[0].goals)
  for (const x of a.bestPlayer) { expect(x!.value).toBeGreaterThan(6); expect(x!.name.length).toBeGreaterThan(2) }
})

test('the season is recorded, stats start again, and the awards make the news', () => {
  const n = endSeason(ended)
  expect(n.history).toHaveLength(1)
  expect(n.history[0]).toMatchObject({ season: 2027, me: { clubId: 'kapar', division: 2 } })
  expect(n.history[0].goldenBoot).toEqual(seasonAwards(ended).goldenBoot)
  for (const p of Object.values(n.players)) expect([p.goals, p.assists, p.ratingSum, p.rated, p.apps]).toEqual([0, 0, 0, 0, 0])
  expect(n.inbox.some((x) => x.key === 'news.season.goldenBoot')).toBe(true)
})

test('honours count a club’s trophies', () => {
  const champion = endSeason(ended).history[0].champions[0]
  expect(honours(endSeason(ended), champion)).toMatchObject({ division1: 1, division2: 0 })
  expect(honours(base, 'kapar')).toMatchObject({ division1: 0, division2: 0 })
})

test('history follows the manager to a new club', () => {
  const s = endSeason(ended)
  const moved = acceptJob({ ...s, career: { kind: 'sacked', offers: ['jugra'] } }, 'jugra')
  expect(moved.history).toEqual(s.history)
})

test('older saves gain stats and an empty history', () => {
  const m = migrate(makeV3())
  expect(m.version).toBe(5)
  expect(m.history).toEqual([])
  for (const p of Object.values(m.players) as Player[]) expect([p.goals, p.assists, p.ratingSum, p.rated]).toEqual([0, 0, 0, 0])
})

test('matches from before the update do not drag the average down', () => {
  const raw = makeV4() as unknown as GameState
  for (const p of Object.values(raw.players)) p.apps = 9
  const m = migrate(raw as never)
  const id = m.tactics.kapar.lineup[5]
  expect(averageRating(m.players[id])).toBeNull()
  const n = playMatchday({ ...m, press: null })
  expect(n.players[id].apps).toBe(10)
  expect(averageRating(n.players[id])).toBeGreaterThan(5)
})
