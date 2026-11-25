import { declineChance, developWeek, growthChance } from './development'
import { newGame, overall } from './generate'
import { migrate } from './migrate'
import { playMatchday, endSeason, isSeasonOver } from './season'
import { createRng } from './rng'
import { makeV3 } from './testUtils'
import { FREE_AGENT, type GameState, type Player } from './types'

const base = newGame(6, 'petaling')
const any = Object.values(base.players).find((p) => p.clubId === 'petaling' && p.position === 'MF')!
const kid: Player = { ...any, age: 17, potential: 20 }

test('growth is faster when young, when playing, and stops at potential', () => {
  expect(growthChance(kid, true, 'balanced')).toBeGreaterThan(growthChance({ ...kid, age: 25 }, true, 'balanced'))
  expect(growthChance(kid, true, 'balanced')).toBeGreaterThan(growthChance(kid, false, 'balanced'))
  expect(growthChance({ ...kid, potential: Math.floor(overall(kid)) }, true, 'balanced')).toBe(0)
  expect(growthChance({ ...kid, age: 30 }, true, 'balanced')).toBe(0)
})

test('training focus changes who grows', () => {
  expect(growthChance(kid, true, 'youth')).toBeGreaterThan(growthChance(kid, true, 'balanced'))
  expect(growthChance({ ...kid, age: 24 }, true, 'youth')).toBe(growthChance({ ...kid, age: 24 }, true, 'balanced'))
  expect(growthChance({ ...kid, position: 'FW' }, true, 'attack')).toBeGreaterThan(growthChance({ ...kid, position: 'FW' }, true, 'balanced'))
  expect(growthChance({ ...kid, position: 'DF' }, true, 'defence')).toBeGreaterThan(growthChance({ ...kid, position: 'DF' }, true, 'balanced'))
})

test('older players decline, keepers later, fitness training slows it', () => {
  const old = (age: number, position: Player['position'] = 'MF') => declineChance({ ...any, age, position }, 'balanced')
  expect(old(30)).toBe(0)
  expect(old(31)).toBeGreaterThan(0)
  expect(old(34)).toBeGreaterThan(old(31))
  expect(old(33, 'GK')).toBe(0)
  expect(declineChance({ ...any, age: 33 }, 'fitness')).toBeLessThan(old(33))
})

test('over many weeks a kid improves but never past potential; attributes stay 1..20', () => {
  let s: GameState = { ...base, players: { [kid.id]: { ...kid, potential: Math.ceil(overall(kid)) + 2 } } }
  for (let i = 0; i < 300; i++) {
    const before = s
    const p = s.players[kid.id]
    s = developWeek(before, { ...s, players: { [kid.id]: { ...p, apps: p.apps + 1 } } }, createRng(i * 7919))
    for (const v of Object.values(s.players[kid.id].attrs)) expect(v >= 1 && v <= 20 && Number.isInteger(v)).toBe(true)
    expect(overall(s.players[kid.id])).toBeLessThanOrEqual(s.players[kid.id].potential)
  }
  expect(overall(s.players[kid.id])).toBeGreaterThan(overall(kid) + 1)
})

test('a veteran declines over a season but keeps attributes ≥ 1', () => {
  const vet: Player = { ...any, age: 35, attrs: Object.fromEntries(Object.keys(any.attrs).map((k) => [k, 2])) as Player['attrs'] }
  let s: GameState = { ...base, players: { [vet.id]: vet } }
  for (let i = 0; i < 200; i++) s = developWeek(s, s, createRng(i * 7919))
  const total = (p: Player) => Object.values(p.attrs).reduce((a, b) => a + b, 0)
  expect(total(s.players[vet.id])).toBeLessThan(total(vet))
  expect(Math.min(...Object.values(s.players[vet.id].attrs))).toBe(1)
})

test('appearances count up and reset, and ovrStart follows each season', () => {
  let s = playMatchday(newGame(11, 'kapar'))
  expect(s.tactics.kapar.lineup.every((id) => s.players[id].apps === 1)).toBe(true)
  while (!isSeasonOver(s)) s = playMatchday({ ...s, board: { ...s.board, confidence: 80 } })
  s = endSeason(s)
  for (const p of Object.values(s.players)) {
    expect(p.apps).toBe(0)
    expect(p.ovrStart).toBeCloseTo(overall(p), 5)
  }
})

test('v3 saves migrate with balanced training and an empty intake, and play', () => {
  const m = migrate(makeV3())
  expect(m.version).toBe(5)
  expect(m.training).toBe('balanced')
  expect(m.youth.intake).toEqual([])
  for (const p of Object.values(m.players)) { expect(p.apps).toBe(0); expect(p.ovrStart).toBeCloseTo(overall(p), 5) }
  expect(Object.values(m.players).filter((p) => p.clubId === FREE_AGENT)).toHaveLength(24)
  expect(() => playMatchday(m)).not.toThrow()
})
