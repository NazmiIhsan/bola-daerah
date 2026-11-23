import { simulateFull } from './sim'
import { fixtureOf, makeTeam } from './testTeams'
import type { Style } from '../types'

const N = 2000

function run(hq: number, aq: number, hs: Style = 'balanced', as: Style = 'balanced') {
  const f = fixtureOf(makeTeam('h', hq, 11, hs), makeTeam('a', aq, 12, as))
  let hw = 0, d = 0, aw = 0, goals = 0, highlights = 0
  for (let s = 0; s < N; s++) {
    const m = simulateFull('h', 'a', f.tactics, f.players, s * 7919 + 1)
    goals += m.score.home + m.score.away
    highlights += m.events.filter((e) => e.highlight).length
    if (m.score.home > m.score.away) hw++
    else if (m.score.home === m.score.away) d++
    else aw++
  }
  return { hw: hw / N, d: d / N, aw: aw / N, goals: goals / N, highlights: highlights / N }
}

const equal = run(11, 11)

test('equal teams: 2.2–3.2 goals, home wins 40–50%, draws 22–32%', () => {
  expect(equal.goals).toBeGreaterThanOrEqual(2.2)
  expect(equal.goals).toBeLessThanOrEqual(3.2)
  expect(equal.hw).toBeGreaterThanOrEqual(0.4)
  expect(equal.hw).toBeLessThanOrEqual(0.5)
  expect(equal.d).toBeGreaterThanOrEqual(0.22)
  expect(equal.d).toBeLessThanOrEqual(0.32)
})

test('strong (13) vs weak (8): strong wins > 65%', () => {
  expect(run(13, 8).hw).toBeGreaterThan(0.65)
  expect(run(8, 13).aw).toBeGreaterThan(0.65)
})

test('defensive vs defensive averages ≥ 0.5 fewer goals than attacking vs attacking', () => {
  expect(run(11, 11, 'attacking', 'attacking').goals - run(11, 11, 'defensive', 'defensive').goals).toBeGreaterThanOrEqual(0.5)
})

test('counter beats attacking more often than balanced does', () => {
  const counter = run(11, 11, 'counter', 'attacking').hw
  const balanced = run(11, 11, 'balanced', 'attacking').hw
  expect(counter).toBeGreaterThan(balanced)
})

test('highlights per match average 6–12', () => {
  expect(equal.highlights).toBeGreaterThanOrEqual(6)
  expect(equal.highlights).toBeLessThanOrEqual(12)
})
