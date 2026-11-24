import { homeAlerts } from './alerts'
import { newGame } from './generate'
import { formOf } from './table'
import type { Fixture, GameState } from './types'

const clean = (): GameState => {
  const s = newGame(5, 'kapar')
  return { ...s, youth: { intake: [] }, players: Object.fromEntries(Object.values(s.players).map((p) => [p.id, { ...p, contractEnd: s.season + 2, injuredWeeks: 0, suspendedMatches: 0, fitness: 100 }])) }
}
const keys = (s: GameState) => homeAlerts(s).map((a) => a.key)
const patch = (s: GameState, id: string, p: object): GameState => ({ ...s, players: { ...s.players, [id]: { ...s.players[id], ...p } } })

test('nothing to report means no alerts', () => expect(homeAlerts(clean())).toEqual([]))

test('counts unavailable and tired starters, and points at tactics', () => {
  let s = clean()
  const [a, b, c] = s.tactics.kapar.lineup
  s = patch(patch(patch(s, a, { injuredWeeks: 2 }), b, { suspendedMatches: 1 }), c, { fitness: 40 })
  expect(homeAlerts(s)).toEqual([{ key: 'out', n: 2, tab: 'tactics' }, { key: 'tired', n: 1, tab: 'tactics' }])
})

test('counts expiring deals, offers, candidates and a short team', () => {
  let s = clean()
  const mine = Object.values(s.players).filter((p) => p.clubId === 'kapar')
  s = patch(s, mine[0].id, { contractEnd: s.season })
  s = { ...s, youth: { intake: [mine[1]] }, transfers: { ...s.transfers, offers: [{ id: 'o', playerId: mine[2].id, clubId: 'klang', fee: 1, expires: 3 }] } }
  s = { ...s, tactics: { ...s.tactics, kapar: { ...s.tactics.kapar, lineup: s.tactics.kapar.lineup.slice(0, 10) } } }
  expect(homeAlerts(s)).toEqual([
    { key: 'short', n: 10, tab: 'tactics' }, { key: 'offers', n: 1, tab: 'transfers' }, { key: 'youth', n: 1, tab: 'youth' }, { key: 'contracts', n: 1, tab: 'squad' },
  ])
})

test('another club never raises alerts, and an angry board does', () => {
  let s = clean()
  s = patch(s, s.tactics.klang.lineup[0], { injuredWeeks: 5, contractEnd: s.season })
  expect(keys(s)).toEqual([])
  expect(keys({ ...s, board: { ...s.board, confidence: 20 } })).toEqual(['board'])
})

test('form lists recent results oldest first', () => {
  const f = (round: number, homeId: string, awayId: string, home: number, away: number): Fixture => ({ id: `${round}`, division: 1, round, homeId, awayId, result: { home, away } })
  const fx = [f(3, 'a', 'b', 0, 0), f(1, 'a', 'b', 1, 0), f(2, 'c', 'a', 4, 1), { ...f(4, 'a', 'b', 0, 0), result: undefined }]
  expect(formOf('a', fx)).toEqual(['W', 'L', 'D'])
  expect(formOf('a', fx, 2)).toEqual(['L', 'D'])
  expect(formOf('z', fx)).toEqual([])
})
