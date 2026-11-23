import { newGame, overall } from './generate'
import type { GameState, Player } from './types'

const g: GameState = newGame(7, 'kapar')
const squad = (s: GameState, clubId: string): Player[] =>
  Object.values(s.players).filter((p) => p.clubId === clubId)

test('newGame creates 19 clubs, 9 in div 1 and 10 in div 2', () => {
  expect(Object.keys(g.clubs)).toHaveLength(19)
  expect(g.divisions[0].clubIds).toHaveLength(9)
  expect(g.divisions[1].clubIds).toHaveLength(10)
  expect(g.divisions[0].clubIds).toContain('petaling')
  expect(g.divisions[1].clubIds).toContain('kapar')
  expect(g.userClubId).toBe('kapar')
  expect(g.season).toBe(2027)
  expect(g.matchday).toBe(1)
})

test('every club has 22–25 players with at least 2 GK, 6 DF, 6 MF, 3 FW', () => {
  for (const id of Object.keys(g.clubs)) {
    const s = squad(g, id)
    expect(s.length).toBeGreaterThanOrEqual(22)
    expect(s.length).toBeLessThanOrEqual(25)
    const count = (pos: string) => s.filter((p) => p.position === pos).length
    expect(count('GK')).toBeGreaterThanOrEqual(2)
    expect(count('DF')).toBeGreaterThanOrEqual(6)
    expect(count('MF')).toBeGreaterThanOrEqual(6)
    expect(count('FW')).toBeGreaterThanOrEqual(3)
  }
})

test('stronger reputation means stronger squad', () => {
  const top16 = (id: string) => {
    const o = squad(g, id).map(overall).sort((a, b) => b - a).slice(0, 16)
    return o.reduce((a, b) => a + b, 0) / o.length
  }
  expect(top16('petaling')).toBeGreaterThan(top16('jugra'))
})

test('newGame is deterministic', () => {
  expect(newGame(7, 'kapar')).toEqual(newGame(7, 'kapar'))
})

test('attributes are within 1..20 and ages within 16..36', () => {
  for (const p of Object.values(g.players)) {
    for (const v of Object.values(p.attrs)) {
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(20)
    }
    expect(p.age).toBeGreaterThanOrEqual(16)
    expect(p.age).toBeLessThanOrEqual(36)
  }
})

test('every club has valid tactics', () => {
  for (const id of Object.keys(g.clubs)) {
    const t = g.tactics[id]
    expect(new Set(t.lineup).size).toBe(11)
    for (const pid of t.lineup) expect(g.players[pid].clubId).toBe(id)
    expect(g.players[t.lineup[0]].position).toBe('GK')
  }
})

test('newGame builds the season fixtures', () => {
  expect(g.fixtures).toHaveLength(162)
})
