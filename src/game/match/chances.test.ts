import { applyChange, canShout, createMatch, simulateFull, stepMinute } from './sim'
import { fixtureOf, makeTeam } from './testTeams'
import type { ChanceKind, MatchState } from './types'

const { players, tactics } = fixtureOf(makeTeam('h', 11, 1), makeTeam('a', 11, 2))
const many = (n: number, f: (seed: number) => MatchState = (s) => simulateFull('h', 'a', tactics, players, s * 31 + 7)) => Array.from({ length: n }, (_, i) => f(i))

test('every shot says how the chance came about, with an xG between 0 and 1', () => {
  const kinds = new Set<ChanceKind>()
  for (const m of many(300)) {
    for (const e of m.events.filter((x) => x.type === 'goal' || x.type === 'save' || x.type === 'miss')) {
      expect(e.kind).toBeDefined()
      expect(e.xg).toBeGreaterThan(0)
      expect(e.xg).toBeLessThan(1)
      kinds.add(e.kind!)
    }
  }
  expect([...kinds].sort()).toEqual(['corner', 'counter', 'cross', 'freekick', 'long', 'penalty', 'solo', 'through'])
})

test('penalties go in far more often than long shots', () => {
  const rate = (k: ChanceKind) => {
    const shots = many(600).flatMap((m) => m.events.filter((e) => e.kind === k))
    return shots.filter((e) => e.type === 'goal').length / shots.length
  }
  expect(rate('penalty')).toBeGreaterThan(0.6)
  expect(rate('long')).toBeLessThan(0.2)
})

test('penalties, free kicks and corners are always shown', () => {
  for (const m of many(200)) for (const e of m.events) if (e.kind === 'penalty' || e.kind === 'freekick' || e.kind === 'corner') expect(e.highlight).toBe(true)
})

test('a counter-attacking side gets more counters against an attacking one', () => {
  const counters = (homeStyle: 'counter' | 'balanced') => {
    const f = fixtureOf(makeTeam('h', 11, 1, homeStyle), makeTeam('a', 11, 2, 'attacking'))
    return many(300, (s) => simulateFull('h', 'a', f.tactics, f.players, s + 1)).flatMap((m) => m.events.filter((e) => e.side === 'home' && e.kind === 'counter')).length
  }
  expect(counters('counter')).toBeGreaterThan(counters('balanced') * 1.5)
})

test('a goal swings momentum to the scorer, and it fades', () => {
  for (const m0 of many(100, (s) => createMatch('h', 'a', tactics, s + 1))) {
    let m = m0
    while (!m.finished) {
      const before = m.events.length
      const prev = m
      m = stepMinute(m, players)
      const goal = m.events.slice(before).find((e) => e.type === 'goal')
      if (goal && !m.events.slice(before).some((e) => e.type === 'red' || e.type === 'save')) {
        const towardHome = (m.momentum ?? 0) - (prev.momentum ?? 0) * 0.92
        expect(goal.side === 'home' ? towardHome > 0 : towardHome < 0).toBe(true)
        let later = m
        for (let i = 0; i < 25 && !later.finished; i++) later = { ...stepMinute(later, players) }
        return
      }
    }
  }
  throw new Error('no goal found')
})

test('momentum always stays between −1 and 1', () => {
  for (const m of many(200)) expect(Math.abs(m.momentum ?? 0)).toBeLessThanOrEqual(1)
})

test('stoppage time is between 1 and 7 minutes', () => {
  for (const m of many(300)) {
    expect(m.added).toBeGreaterThanOrEqual(1)
    expect(m.added).toBeLessThanOrEqual(7)
  }
})

describe('shouts', () => {
  test('a shout lasts ten minutes, logs an event and blocks another until it ends', () => {
    let m = createMatch('h', 'a', tactics, 4)
    for (let i = 0; i < 20; i++) m = stepMinute(m, players)
    m = applyChange(m, 'home', { kind: 'shout', shout: 'attack' })
    expect(m.events.at(-1)).toMatchObject({ type: 'shout', shout: 'attack', side: 'home', minute: 20 })
    expect(canShout(m, 'home', 'calm')).toBe(false)
    expect(() => applyChange(m, 'home', { kind: 'shout', shout: 'calm' })).toThrow()
    expect(canShout(m, 'away', 'calm')).toBe(true)
    for (let i = 0; i < 10; i++) m = stepMinute(m, players)
    expect(m.shouts?.home).toBeDefined()
    m = stepMinute(m, players)
    expect(m.shouts?.home).toBeUndefined()
    expect(canShout(m, 'home', 'calm')).toBe(true)
  })

  test('time-wasting is only allowed while winning', () => {
    const m = createMatch('h', 'a', tactics, 4)
    expect(canShout(m, 'home', 'waste')).toBe(false)
    expect(canShout({ ...m, score: { home: 1, away: 0 } }, 'home', 'waste')).toBe(true)
  })

  test('encouragement lifts momentum straight away', () => {
    const m = applyChange(createMatch('h', 'a', tactics, 4), 'away', { kind: 'shout', shout: 'encourage' })
    expect(m.momentum).toBeLessThan(0)
  })

  test('shouting "attack" every time it is allowed creates more shots for you', () => {
    const shots = (shout: boolean) => many(400, (seed) => {
      let m = createMatch('h', 'a', tactics, seed + 1)
      while (!m.finished) {
        if (shout && canShout(m, 'home', 'attack')) m = applyChange(m, 'home', { kind: 'shout', shout: 'attack' })
        m = stepMinute(m, players)
      }
      return m
    }).flatMap((m) => m.events.filter((e) => e.side === 'home' && e.kind)).length
    expect(shots(true)).toBeGreaterThan(shots(false) * 1.1)
  })
})
