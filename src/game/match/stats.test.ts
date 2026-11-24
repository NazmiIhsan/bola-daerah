import { matchStats, scorers } from './stats'
import { createMatch, simulateFull, stepMinute } from './sim'
import { newGame } from '../generate'
import type { MatchEvent } from './types'

const e = (type: MatchEvent['type'], side: 'home' | 'away', minute = 1, playerId = 'p'): MatchEvent => ({ type, side, minute, playerId, highlight: false })

test('shots, shots on target and cards per side', () => {
  const st = matchStats([e('goal', 'home'), e('save', 'home'), e('miss', 'home'), e('miss', 'away'), e('yellow', 'away'), e('red', 'away'), { minute: 45, type: 'halftime', highlight: false }])
  expect(st.home).toEqual({ shots: 3, onTarget: 2, yellow: 0, red: 0 })
  expect(st.away).toEqual({ shots: 1, onTarget: 0, yellow: 1, red: 1 })
})

test('scorers are grouped with their minutes, in order', () => {
  expect(scorers([e('goal', 'home', 10, 'a'), e('goal', 'home', 20, 'b'), e('goal', 'home', 30, 'a'), e('goal', 'away', 5, 'c')], 'home')).toEqual([{ playerId: 'a', minutes: [10, 30] }, { playerId: 'b', minutes: [20] }])
})

test('possession adds up to the minutes played and does not change results', () => {
  const s = newGame(4, 'klang')
  const m0 = createMatch('klang', 'petaling', s.tactics, 99)
  expect(m0.possession).toEqual({ home: 0, away: 0 })
  const m1 = stepMinute(m0, s.players)
  expect(m0.possession).toEqual({ home: 0, away: 0 })
  expect(m1.possession.home + m1.possession.away).toBe(1)
  const end = simulateFull('klang', 'petaling', s.tactics, s.players, 99)
  expect(end.possession.home + end.possession.away).toBe(90)
})
