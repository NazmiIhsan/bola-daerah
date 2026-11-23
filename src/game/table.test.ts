import { computeTable } from './table'
import type { Fixture } from './types'

const fx = (homeId: string, awayId: string, home?: number, away?: number): Fixture => ({
  id: `${homeId}-${awayId}`, division: 1, round: 1, homeId, awayId,
  result: home === undefined ? undefined : { home, away: away! },
})

test('3-club example gives exact rows', () => {
  const rows = computeTable(['a', 'b', 'c'], [fx('a', 'b', 2, 0), fx('b', 'c', 1, 1), fx('c', 'a', 3, 1)])
  expect(rows).toEqual([
    { clubId: 'c', played: 2, won: 1, drawn: 1, lost: 0, gf: 4, ga: 2, gd: 2, points: 4 },
    { clubId: 'a', played: 2, won: 1, drawn: 0, lost: 1, gf: 3, ga: 3, gd: 0, points: 3 },
    { clubId: 'b', played: 2, won: 0, drawn: 1, lost: 1, gf: 1, ga: 3, gd: -2, points: 1 },
  ])
})

test('tie on points broken by gd, then gf, then id', () => {
  // all on 3 pts: x gd+2, y and z gd+1 with y more gf, w and v identical → id order
  const rows = computeTable(['z', 'y', 'x', 'w', 'v', 'u'], [
    fx('x', 'u', 2, 0),
    fx('y', 'u', 3, 2),
    fx('z', 'u', 1, 0),
    fx('w', 'u', 1, 0),
    fx('v', 'u', 1, 0),
  ])
  expect(rows.map((r) => r.clubId)).toEqual(['x', 'y', 'v', 'w', 'z', 'u'])
})

test('clubs with no games appear with zeros and unplayed fixtures are ignored', () => {
  const rows = computeTable(['a', 'b'], [fx('a', 'b')])
  expect(rows).toHaveLength(2)
  expect(rows.every((r) => r.played === 0 && r.points === 0)).toBe(true)
})
