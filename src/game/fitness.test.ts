import { newGame } from './generate'
import { squad } from './market'
import { createMatch } from './match/sim'
import type { MatchEvent, MatchState } from './match/types'
import { applyResult, endSeason, isSeasonOver, matchTactics, playMatchday, userFixture } from './season'
import type { GameState } from './types'

const base = newGame(6, 'kapar')
const f = userFixture(base)!
const side = f.homeId === 'kapar' ? ('home' as const) : ('away' as const)
const xi = matchTactics(base).kapar
const cost = (id: string) => 30 - base.players[id].attrs.stamina

/** The user's match, played to the end with only these events. */
function played(events: MatchEvent[], change: (m: MatchState) => void = () => {}): GameState {
  const m = createMatch(f.homeId, f.awayId, matchTactics(base), 1)
  m.minute = 90
  m.finished = true
  m.events = [...m.events, ...events]
  change(m)
  return applyResult(base, f.id, m)
}

test('a full match costs a starter the full amount', () => {
  expect(played([]).players[xi.lineup[5]].fitness).toBeCloseTo(100 - cost(xi.lineup[5]))
})

test('players pay only for the minutes they were on the pitch', () => {
  const off = xi.lineup[5], on = xi.subs[0]
  const s = played([{ minute: 60, side, type: 'sub', playerId: off, subOnId: on, highlight: false }], (m) => { m[side].onPitch[5] = on })
  expect(s.players[off].fitness).toBeCloseTo(100 - (cost(off) * 60) / 90)
  expect(s.players[on].fitness).toBeCloseTo(100 - (cost(on) * 30) / 90)
})

test('a player sent off stops tiring', () => {
  const id = xi.lineup[5]
  const s = played([{ minute: 30, side, type: 'red', playerId: id, highlight: true }], (m) => { m[side].onPitch[5] = ''; m[side].sentOff.push(id) })
  expect(s.players[id].fitness).toBeCloseTo(100 - (cost(id) * 30) / 90)
})

test('an injured player nobody replaces stops tiring', () => {
  const id = xi.lineup[5]
  const s = played([{ minute: 45, side, type: 'injury', playerId: id, highlight: false }], (m) => { m[side].onPitch[5] = '' })
  expect(s.players[id].fitness).toBeCloseTo(100 - (cost(id) * 45) / 90)
})

test('an unused substitute does not tire', () => {
  expect(played([]).players[xi.subs[0]].fitness).toBe(100)
})

test('the week’s rest comes before the next kick-off', () => {
  const m = createMatch(f.homeId, f.awayId, matchTactics(base), 1)
  m.minute = 90
  m.finished = true
  const id = xi.lineup[5]
  expect(playMatchday(base, m).players[id].fitness).toBeCloseTo(100 - cost(id) + 20)
})

test('everyone starts a new season fresh', () => {
  let s: GameState = base
  while (!isSeasonOver(s)) s = playMatchday({ ...s, press: null, board: { ...s.board, confidence: 80 } })
  expect(squad(s, 'kapar').some((p) => p.fitness < 100)).toBe(true)
  for (const p of Object.values(endSeason(s).players)) expect(p.fitness).toBe(100)
})
