import { computeTable } from './table'
import { isRivalry } from './rivals'
import { divisionOf } from './finance'
import type { BoardState, Expectation, Fixture, GameState } from './types'

export interface Reaction {
  fanDelta: number
  boardDelta: number
  reasons: Array<{ key: string; params?: Record<string, string | number> }>
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
const FAN_LOG_CAP = 12

export function expectationFor(state: GameState): BoardState {
  const div = divisionOf(state, state.userClubId)
  const ids = state.divisions[div - 1].clubIds
  const rank = [...ids].sort((a, b) => state.clubs[b].reputation - state.clubs[a].reputation || a.localeCompare(b)).indexOf(state.userClubId) + 1
  let expectation: Expectation, targetPosition: number
  if (div === 1) {
    if (rank === 1) [expectation, targetPosition] = ['title', 1]
    else if (rank <= 4) [expectation, targetPosition] = ['topHalf', 4]
    else [expectation, targetPosition] = ['avoidRelegation', 7]
  } else {
    if (rank <= 3) [expectation, targetPosition] = ['promotion', 2]
    else if (rank <= 6) [expectation, targetPosition] = ['topHalf', 5]
    else [expectation, targetPosition] = ['midTable', 8]
  }
  return { expectation, targetPosition, confidence: 60 }
}

export function userPosition(state: GameState): { position: number; size: number; division: 1 | 2 } {
  const division = divisionOf(state, state.userClubId)
  const ids = state.divisions[division - 1].clubIds
  const table = computeTable(ids, state.fixtures.filter((f) => f.division === division))
  return { position: table.findIndex((r) => r.clubId === state.userClubId) + 1, size: ids.length, division }
}

export function resultReaction(state: GameState, fixture: Fixture): Reaction {
  const me = state.userClubId
  const home = fixture.homeId === me
  const oppId = home ? fixture.awayId : fixture.homeId
  const mine = home ? fixture.result!.home : fixture.result!.away
  const theirs = home ? fixture.result!.away : fixture.result!.home
  const my = state.clubs[me], opp = state.clubs[oppId]
  const derby = isRivalry(my, opp)
  const margin = mine - theirs
  const params = { oppId, score: `${mine}–${theirs}` }
  if (margin === 0) return { fanDelta: 0, boardDelta: 0, reasons: [{ key: 'fans.reason.draw', params }] }
  const win = margin > 0
  const scale = Math.max(0.5, Math.min(1.5, win ? opp.reputation / my.reputation : my.reputation / opp.reputation))
  let fan = win ? 4 : -4
  if (derby) fan += win ? 3 : -3
  if (Math.abs(margin) >= 3) fan += win ? 2 : -2
  const key = win
    ? derby ? 'fans.reason.derbyWin' : margin >= 3 ? 'fans.reason.bigWin' : 'fans.reason.win'
    : derby ? 'fans.reason.derbyLoss' : margin <= -3 ? 'fans.reason.heavyLoss' : 'fans.reason.loss'
  return { fanDelta: fan, boardDelta: Math.round((win ? 3 : -3) * scale), reasons: [{ key, params }] }
}

export function weeklyBoardCheck(state: GameState): Reaction {
  const r: Reaction = { fanDelta: 0, boardDelta: 0, reasons: [] }
  const played = state.fixtures.filter((f) => f.result && (f.homeId === state.userClubId || f.awayId === state.userClubId)).length
  if (played >= 6) {
    const { position } = userPosition(state)
    if (position > state.board.targetPosition + 2) { r.boardDelta -= 2; r.reasons.push({ key: 'board.reason.belowTarget', params: { pos: position } }) }
    else if (position <= state.board.targetPosition) { r.boardDelta += 1; r.reasons.push({ key: 'board.reason.onTarget', params: { pos: position } }) }
  }
  if (state.fans.mood < 25) { r.boardDelta -= 1; r.reasons.push({ key: 'board.reason.angryFans' }) }
  if (state.finance.balance < 0) { r.boardDelta -= 2; r.reasons.push({ key: 'board.reason.debt' }) }
  return r
}

export function seasonEndReaction(state: GameState): Reaction {
  const { position, size, division } = userPosition(state)
  const target = state.board.targetPosition
  const pos = { pos: position }
  if (position === 1) return { boardDelta: 30, fanDelta: 20, reasons: [{ key: 'fans.reason.champions', params: pos }] }
  if (division === 2 && position <= 2) return { boardDelta: 25, fanDelta: 15, reasons: [{ key: 'fans.reason.promoted', params: pos }] }
  if (division === 1 && position >= size - 1) return { boardDelta: -35, fanDelta: -20, reasons: [{ key: 'fans.reason.relegated', params: pos }] }
  if (position <= target) return { boardDelta: 15, fanDelta: 5, reasons: [{ key: 'fans.reason.metTarget', params: pos }] }
  if (position - target <= 2) return { boardDelta: -10, fanDelta: -5, reasons: [{ key: 'fans.reason.missedTarget', params: pos }] }
  return { boardDelta: -25, fanDelta: -10, reasons: [{ key: 'fans.reason.badSeason', params: pos }] }
}

export function applyReaction(state: GameState, r: Reaction): GameState {
  const log = r.fanDelta !== 0 && r.reasons[0]
    ? [{ season: state.season, matchday: state.matchday, delta: r.fanDelta, reason: r.reasons[0].key, params: r.reasons[0].params }, ...state.fans.log].slice(0, FAN_LOG_CAP)
    : state.fans.log
  return {
    ...state,
    fans: { mood: clamp(state.fans.mood + r.fanDelta), log },
    board: { ...state.board, confidence: clamp(state.board.confidence + r.boardDelta) },
  }
}

export function shouldSack(state: GameState): boolean {
  if (state.matchday > 18) return state.board.confidence < 25
  return state.matchday > 6 && state.board.confidence < 15
}
