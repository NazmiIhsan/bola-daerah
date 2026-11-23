import { applyReaction, expectationFor, resultReaction, seasonEndReaction, shouldSack, weeklyBoardCheck } from './reactions'
import { newGame } from './generate'
import type { Fixture, GameState } from './types'

const withResult = (s: GameState, homeId: string, awayId: string, home: number, away: number): Fixture => ({
  id: `t-${homeId}-${awayId}`, division: 1, round: 1, homeId, awayId, result: { home, away },
})

test('expectationFor by reputation rank in the division', () => {
  expect(expectationFor(newGame(1, 'petaling'))).toEqual({ expectation: 'title', targetPosition: 1, confidence: 60 })
  expect(expectationFor(newGame(1, 'klang')).expectation).toBe('topHalf')
  expect(expectationFor(newGame(1, 'sabak-bernam'))).toMatchObject({ expectation: 'avoidRelegation', targetPosition: 7 })
  expect(expectationFor(newGame(1, 'kapar'))).toMatchObject({ expectation: 'promotion', targetPosition: 2 })
  expect(expectationFor(newGame(1, 'rawang'))).toMatchObject({ expectation: 'topHalf', targetPosition: 5 })
  expect(expectationFor(newGame(1, 'jugra'))).toMatchObject({ expectation: 'midTable', targetPosition: 8 })
})

test('newGame uses expectationFor', () => {
  expect(newGame(1, 'petaling').board.expectation).toBe('title')
})

test('win raises fans and board, loss lowers both, derby win beats a normal win', () => {
  const s = newGame(1, 'kuala-selangor')
  const win = resultReaction(s, withResult(s, 'kuala-selangor', 'sepang', 2, 1))
  const loss = resultReaction(s, withResult(s, 'kuala-selangor', 'sepang', 0, 1))
  expect(win.fanDelta).toBeGreaterThan(0); expect(win.boardDelta).toBeGreaterThan(0)
  expect(loss.fanDelta).toBeLessThan(0); expect(loss.boardDelta).toBeLessThan(0)
  const k = newGame(1, 'klang')
  const derby = resultReaction(k, withResult(k, 'klang', 'petaling', 2, 1))
  const normal = resultReaction(k, withResult(k, 'klang', 'sepang', 2, 1))
  expect(derby.fanDelta).toBeGreaterThan(normal.fanDelta)
  const draw = resultReaction(s, withResult(s, 'kuala-selangor', 'sepang', 1, 1))
  expect(draw.fanDelta).toBe(0)
  expect(resultReaction(s, withResult(s, 'kuala-selangor', 'sepang', 4, 0)).fanDelta).toBeGreaterThan(win.fanDelta)
})

test('losing to a much smaller club costs more board confidence than losing to a bigger one', () => {
  const s = newGame(1, 'klang')
  const toSmall = resultReaction(s, withResult(s, 'klang', 'sabak-bernam', 0, 1))
  const toBig = resultReaction(s, withResult(s, 'klang', 'hulu-langat', 0, 1))
  // hulu-langat (72) is smaller than klang (77) but much bigger than sabak-bernam (55)
  expect(toSmall.boardDelta).toBeLessThan(toBig.boardDelta)
})

test('applyReaction clamps and keeps a short newest-first log', () => {
  let s = newGame(1, 'kapar')
  s = applyReaction(s, { fanDelta: 500, boardDelta: -500, reasons: [{ key: 'fans.reason.win', params: { opp: 'x' } }] })
  expect(s.fans.mood).toBe(100)
  expect(s.board.confidence).toBe(0)
  for (let i = 0; i < 20; i++) s = applyReaction(s, { fanDelta: -1, boardDelta: 0, reasons: [{ key: `r${i}` }] })
  expect(s.fans.log).toHaveLength(12)
  expect(s.fans.log[0].reason).toBe('r19')
})

test('shouldSack respects the 6-matchday grace period and season end', () => {
  const s = newGame(1, 'kapar')
  expect(shouldSack({ ...s, matchday: 3, board: { ...s.board, confidence: 5 } })).toBe(false)
  expect(shouldSack({ ...s, matchday: 10, board: { ...s.board, confidence: 10 } })).toBe(true)
  expect(shouldSack({ ...s, matchday: 10, board: { ...s.board, confidence: 40 } })).toBe(false)
  expect(shouldSack({ ...s, matchday: 19, board: { ...s.board, confidence: 20 } })).toBe(true)
})

function finishSeason(s: GameState, winner: string): GameState {
  return { ...s, matchday: 19, fixtures: s.fixtures.map((f) => ({ ...f, result: { home: f.homeId === winner ? 3 : 0, away: f.awayId === winner ? 3 : 0 } })) }
}

test('seasonEndReaction: promotion and relegation', () => {
  expect(seasonEndReaction(finishSeason(newGame(1, 'jugra'), 'jugra')).boardDelta).toBe(30) // div2 champion
  const s = newGame(1, 'kapar')
  // kapar second: everyone else draws 0-0, damansara wins all, kapar wins all except vs damansara
  const second = { ...s, matchday: 19, fixtures: s.fixtures.map((f) => {
    if (f.homeId === 'damansara' || f.awayId === 'damansara') return { ...f, result: { home: f.homeId === 'damansara' ? 2 : 0, away: f.awayId === 'damansara' ? 2 : 0 } }
    return { ...f, result: { home: f.homeId === 'kapar' ? 1 : 0, away: f.awayId === 'kapar' ? 1 : 0 } }
  }) }
  expect(seasonEndReaction(second).boardDelta).toBe(25)
  const rel = finishSeason(newGame(1, 'sabak-bernam'), 'petaling')
  // everyone except petaling scores 0 → ties broken by id; force sabak-bernam bottom by making it lose to all
  const relRigged = { ...rel, fixtures: rel.fixtures.map((f) => (f.homeId === 'sabak-bernam' ? { ...f, result: { home: 0, away: 1 } } : f.awayId === 'sabak-bernam' ? { ...f, result: { home: 1, away: 0 } } : f)) }
  expect(seasonEndReaction(relRigged).boardDelta).toBe(-35)
})

test('weeklyBoardCheck punishes debt and very angry fans', () => {
  const s = newGame(1, 'kapar')
  const calm = weeklyBoardCheck(s)
  const bad = weeklyBoardCheck({ ...s, finance: { ...s.finance, balance: -1 }, fans: { ...s.fans, mood: 10 } })
  expect(bad.boardDelta).toBeLessThan(calm.boardDelta)
})
