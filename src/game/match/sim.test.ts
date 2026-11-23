import { applyChange, createMatch, simulateFull, stepMinute } from './sim'
import { fixtureOf, makeTeam } from './testTeams'

const h = makeTeam('h', 11, 1)
const a = makeTeam('a', 11, 2)
const { players, tactics } = fixtureOf(h, a)

test('simulateFull is deterministic for a seed', () => {
  expect(simulateFull('h', 'a', tactics, players, 9)).toEqual(simulateFull('h', 'a', tactics, players, 9))
})

test('ends at minute 90 with halftime and fulltime events, finished=true', () => {
  const m = simulateFull('h', 'a', tactics, players, 3)
  expect(m.minute).toBe(90)
  expect(m.finished).toBe(true)
  expect(m.events.some((e) => e.type === 'halftime' && e.minute === 45)).toBe(true)
  expect(m.events.at(-1)!.type).toBe('fulltime')
})

test('score equals number of goal events per side', () => {
  for (let s = 0; s < 50; s++) {
    const m = simulateFull('h', 'a', tactics, players, s)
    expect(m.events.filter((e) => e.type === 'goal' && e.side === 'home')).toHaveLength(m.score.home)
    expect(m.events.filter((e) => e.type === 'goal' && e.side === 'away')).toHaveLength(m.score.away)
  }
})

test('applyChange sub swaps players and a 6th sub throws', () => {
  let m = createMatch('h', 'a', tactics, 1)
  const bench = [...m.home.bench]
  for (let i = 0; i < 5; i++) {
    const off = m.home.onPitch[i + 1]
    m = applyChange(m, 'home', { kind: 'sub', offId: off, onId: bench[i] })
    expect(m.home.onPitch[i + 1]).toBe(bench[i])
    expect(m.home.bench).not.toContain(bench[i])
  }
  expect(m.home.subsUsed).toBe(5)
  expect(m.events.filter((e) => e.type === 'sub')).toHaveLength(5)
  expect(() => applyChange(m, 'home', { kind: 'sub', offId: m.home.onPitch[7], onId: bench[5] })).toThrow()
})

test('applyChange rejects a player who is not on the pitch', () => {
  const m = createMatch('h', 'a', tactics, 1)
  expect(() => applyChange(m, 'home', { kind: 'sub', offId: 'nobody', onId: m.home.bench[0] })).toThrow()
})

test('applyChange tactics updates style and formation', () => {
  const m = applyChange(createMatch('h', 'a', tactics, 1), 'away', { kind: 'tactics', style: 'defensive', formation: '5-3-2' })
  expect(m.away.tactics.style).toBe('defensive')
  expect(m.away.tactics.formation).toBe('5-3-2')
})

test('a red card leaves that side with 10 on the pitch', () => {
  let found = false
  for (let s = 0; s < 400 && !found; s++) {
    const m = simulateFull('h', 'a', tactics, players, s)
    const red = m.events.find((e) => e.type === 'red')
    if (!red) continue
    found = true
    const side = m[red.side!]
    expect(side.sentOff).toContain(red.playerId)
    expect(side.onPitch).not.toContain(red.playerId)
    expect(side.onPitch.filter(Boolean).length).toBeLessThanOrEqual(10)
  }
  expect(found).toBe(true)
})

test('a side with only 9 available players still completes a match', () => {
  const short = makeTeam('s', 11, 4, 'balanced', 9)
  const f = fixtureOf(short, a)
  const m = simulateFull('s', 'a', f.tactics, f.players, 1)
  expect(m.finished).toBe(true)
  expect(m.home.onPitch.filter(Boolean).length).toBeLessThanOrEqual(9)
})

test('stepping minute-by-minute equals simulateFull for the same seed', () => {
  let m = createMatch('h', 'a', tactics, 21)
  while (!m.finished) m = stepMinute(m, players)
  expect(m).toEqual(simulateFull('h', 'a', tactics, players, 21))
})

test('stepMinute does not mutate its input', () => {
  const m = createMatch('h', 'a', tactics, 2)
  const snapshot = JSON.stringify(m)
  stepMinute(m, players)
  expect(JSON.stringify(m)).toBe(snapshot)
})

test('homeBoost increases home goals', () => {
  let base = 0, boosted = 0
  for (let s = 0; s < 1000; s++) {
    base += simulateFull('h', 'a', tactics, players, s).score.home
    boosted += simulateFull('h', 'a', tactics, players, s, { homeBoost: 1.1 }).score.home
  }
  expect(boosted).toBeGreaterThan(base)
  expect(createMatch('h', 'a', tactics, 1).homeBoost).toBe(1)
})
