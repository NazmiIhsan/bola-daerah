import { newGame } from '../generate'
import { matchOptions, matchTactics, playMatchday } from '../season'
import { createMatch, simulateFull, stepMinute } from './sim'
import { fixtureOf, makeTeam } from './testTeams'
import type { MatchManager, MatchState } from './types'

const f = fixtureOf(makeTeam('h', 11, 1), makeTeam('a', 11, 2))
const bold: MatchManager = { attack: 0.8, bold: 1, youth: 0.2 }
const calm: MatchManager = { attack: 0.3, bold: 0, youth: 0.2 }
const at = (minute: number, home: number, away: number, managers: MatchState['managers']): MatchState => ({ ...createMatch('h', 'a', f.tactics, 5, { managers }), minute, score: { home, away } })
const until = (m: MatchState, minute: number) => { while (m.minute < minute && !m.finished) m = stepMinute(m, f.players); return m }

test('a losing AI side pushes forward late on', () => {
  const m = until(at(64, 0, 3, { home: bold }), 75)
  expect(m.home.tactics.style).toBe('attacking')
  expect(m.events.some((e) => e.type === 'push' && e.side === 'home')).toBe(true)
})

test('a cautious AI side protects a one-goal lead near the end', () => {
  for (let seed = 1; seed < 30; seed++) {
    const m = until({ ...at(70, 2, 1, { away: undefined, home: calm }), rngState: seed * 99 }, 80)
    if (m.score.home - m.score.away !== 1) continue
    expect(m.home.tactics.style).toBe('defensive')
    expect(m.events.some((e) => e.type === 'protect')).toBe(true)
    return
  }
  throw new Error('no quiet finish found')
})

test('a side without an AI manager is never changed, apart from forced injuries', () => {
  for (let seed = 0; seed < 40; seed++) {
    const m = simulateFull('h', 'a', f.tactics, f.players, seed, { managers: { away: bold } })
    expect(m.home.tactics.style).toBe('balanced')
    const injured = new Set(m.events.filter((e) => e.type === 'injury').map((e) => e.playerId))
    for (const e of m.events) if (e.type === 'sub' && e.side === 'home') expect(injured.has(e.playerId)).toBe(true)
  }
})

test('AI subs are legal: at most five, nobody twice, nobody sent off', () => {
  let subs = 0
  for (let seed = 0; seed < 150; seed++) {
    const m = simulateFull('h', 'a', f.tactics, f.players, seed, { managers: { home: bold, away: calm } })
    for (const side of ['home', 'away'] as const) {
      const t = m[side]
      expect(t.subsUsed).toBeLessThanOrEqual(5)
      const on = t.onPitch.filter(Boolean)
      expect(new Set(on).size).toBe(on.length)
      expect(on.some((id) => t.sentOff.includes(id))).toBe(false)
      expect(on.some((id) => t.bench.includes(id))).toBe(false)
      subs += t.subsUsed
    }
  }
  expect(subs / 300).toBeGreaterThan(1)
})

test('a tired player makes way for a fresh one', () => {
  const tired = f.tactics.h.lineup[8]
  const players = { ...f.players, [tired]: { ...f.players[tired], fitness: 5 } }
  const m = simulateFull('h', 'a', f.tactics, players, 4, { managers: { home: calm } })
  expect(m.events.some((e) => e.type === 'sub' && e.playerId === tired) || m.home.sentOff.includes(tired)).toBe(true)
})

test('decisions use no luck: the same match replays the same', () => {
  const run = () => simulateFull('h', 'a', f.tactics, f.players, 77, { managers: { home: bold, away: calm } })
  expect(run()).toEqual(run())
})

test('a heavily beaten side digs in without claiming to protect a lead', () => {
  const m = until(at(50, 0, 5, { home: bold }), 75)
  expect(m.home.tactics.style).toBe('defensive')
  expect(m.events.some((e) => e.type === 'protect' && e.side === 'home')).toBe(false)
})

test('nobody who came on is taken off again by his manager', () => {
  let subs = 0
  const taken: string[] = []
  for (const seed of [3, 6, 12]) {
    let g = newGame(seed, 'kapar')
    for (let round = 0; round < 6; round++) {
      const t = matchTactics(g)
      for (const x of g.fixtures.filter((y) => y.round === g.matchday)) {
        const m = simulateFull(x.homeId, x.awayId, t, g.players, seed * 1000 + round, matchOptions(g, x))
        const on = new Set<string>()
        for (const e of m.events) {
          if (e.type !== 'sub') continue
          subs++
          const injured = m.events.some((i) => i.type === 'injury' && i.playerId === e.playerId)
          if (!injured && on.has(e.playerId!)) taken.push(`${x.id} ${e.minute}`)
          on.add(e.subOnId!)
        }
      }
      g = { ...playMatchday({ ...g, press: null, career: { kind: 'employed' }, board: { ...g.board, confidence: 80 } }) }
    }
  }
  expect(subs).toBeGreaterThan(50)
  expect(taken).toEqual([])
})
