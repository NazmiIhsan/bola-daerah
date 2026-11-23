import { roundRobin, buildFixtures } from './schedule'
import type { Fixture } from './types'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`)
const byRound = (f: Fixture[]) => {
  const m = new Map<number, Fixture[]>()
  for (const x of f) m.set(x.round, [...(m.get(x.round) ?? []), x])
  return m
}
const games = (f: Fixture[], c: string) => f.filter((x) => x.homeId === c || x.awayId === c)

test('9 clubs → 18 rounds, 4 matches per round, each club plays 16 (8 home, 8 away), one bye per round', () => {
  const clubs = ids(9)
  const f = roundRobin(clubs, 1)
  const rounds = byRound(f)
  expect(rounds.size).toBe(18)
  for (const [, r] of rounds) {
    expect(r).toHaveLength(4)
    const playing = new Set(r.flatMap((x) => [x.homeId, x.awayId]))
    expect(clubs.filter((c) => !playing.has(c))).toHaveLength(1)
  }
  for (const c of clubs) {
    expect(games(f, c)).toHaveLength(16)
    expect(f.filter((x) => x.homeId === c)).toHaveLength(8)
  }
})

test('10 clubs → 18 rounds, 5 matches per round, each club plays 18 (9 home, 9 away)', () => {
  const clubs = ids(10)
  const f = roundRobin(clubs, 2)
  const rounds = byRound(f)
  expect(rounds.size).toBe(18)
  for (const [, r] of rounds) expect(r).toHaveLength(5)
  for (const c of clubs) {
    expect(games(f, c)).toHaveLength(18)
    expect(f.filter((x) => x.homeId === c)).toHaveLength(9)
  }
  expect(f.every((x) => x.division === 2)).toBe(true)
})

test('every pair meets exactly twice, once at each home', () => {
  for (const n of [9, 10]) {
    const clubs = ids(n)
    const f = roundRobin(clubs, 1)
    for (const a of clubs) for (const b of clubs) {
      if (a === b) continue
      expect(f.filter((x) => x.homeId === a && x.awayId === b)).toHaveLength(1)
    }
  }
})

test('no club plays twice in a round', () => {
  for (const n of [9, 10]) {
    for (const [, r] of byRound(roundRobin(ids(n), 1))) {
      const all = r.flatMap((x) => [x.homeId, x.awayId])
      expect(new Set(all).size).toBe(all.length)
    }
  }
})

test('second half mirrors first half with home/away swapped', () => {
  const f = roundRobin(ids(10), 1)
  const rounds = byRound(f)
  for (let r = 1; r <= 9; r++) {
    const first = rounds.get(r)!.map((x) => `${x.awayId}>${x.homeId}`).sort()
    const second = rounds.get(r + 9)!.map((x) => `${x.homeId}>${x.awayId}`).sort()
    expect(second).toEqual(first)
  }
})

test('buildFixtures totals 72 + 90 = 162 with unique ids', () => {
  const f = buildFixtures([{ id: 1, clubIds: ids(9) }, { id: 2, clubIds: ids(10).map((c) => `d${c}`) }])
  expect(f).toHaveLength(162)
  expect(new Set(f.map((x) => x.id)).size).toBe(162)
})
