import type { Rng } from './rng'
import { isRivalry } from './rivals'
import { applyReaction } from './reactions'
import { addNews } from './news'
import type { Answer, Fixture, GameState, PressConference, PressQuestion } from './types'

export const ANSWER_EFFECTS: Record<Answer, { fans: number; morale: number; board: number }> = {
  confident: { fans: 2, morale: 3, board: 0 },
  humble: { fans: -1, morale: 1, board: 1 },
  combative: { fans: 1, morale: 1, board: -2 },
}
const COMBATIVE_RIVALRY_FANS = 4

function lastResults(state: GameState, n: number): Array<'W' | 'D' | 'L'> {
  const me = state.userClubId
  return state.fixtures
    .filter((f) => f.result && (f.homeId === me || f.awayId === me))
    .sort((a, b) => b.round - a.round)
    .slice(0, n)
    .map((f) => {
      const g = f.homeId === me ? f.result!.home : f.result!.away
      const c = f.homeId === me ? f.result!.away : f.result!.home
      return g > c ? 'W' : g === c ? 'D' : 'L'
    })
}

export function maybePress(state: GameState, kind: 'pre' | 'post', fixture: Fixture, rng: Rng): PressConference | null {
  const me = state.userClubId
  const oppId = fixture.homeId === me ? fixture.awayId : fixture.homeId
  const rivalry = isRivalry(state.clubs[me], state.clubs[oppId])
  let first: string
  if (kind === 'pre') {
    const last3 = lastResults(state, 3)
    const streakW = last3.length === 3 && last3.every((r) => r === 'W')
    const streakL = last3.length === 3 && last3.every((r) => r === 'L')
    if (rivalry) first = 'press.q.pre.rival'
    else if (streakW) first = 'press.q.pre.streakWin'
    else if (streakL) first = 'press.q.pre.streakLoss'
    else if (rng.chance(0.35)) first = 'press.q.pre.generic'
    else return null
  } else {
    if (!fixture.result) return null
    const g = fixture.homeId === me ? fixture.result.home : fixture.result.away
    const c = fixture.homeId === me ? fixture.result.away : fixture.result.home
    const outcome = g > c ? 'press.q.post.win' : g < c ? 'press.q.post.loss' : 'press.q.post.draw'
    if (rivalry) first = 'press.q.post.derby'
    else if (Math.abs(g - c) >= 3 || rng.chance(0.25)) first = outcome
    else return null
  }
  const extraKey = kind === 'pre' ? 'press.q.pre.generic' : first === 'press.q.post.derby' ? 'press.q.post.derby' : first
  const n = rng.int(1, 3)
  const q = (key: string): PressQuestion => ({ key, params: { oppId, v: rng.int(0, 999) } })
  const questions = [q(first)]
  while (questions.length < n) questions.push(q(extraKey))
  return { kind, fixtureId: fixture.id, questions }
}

function pressIsRivalry(state: GameState): boolean {
  const f = state.press && state.fixtures.find((x) => x.id === state.press!.fixtureId)
  if (!f) return false
  return isRivalry(state.clubs[f.homeId], state.clubs[f.awayId])
}

export function answerPress(state: GameState, answers: Answer[], rng: Rng): GameState {
  const rivalry = pressIsRivalry(state)
  let fans = 0, morale = 0, board = 0
  for (const a of answers) {
    const e = ANSWER_EFFECTS[a]
    fans += a === 'combative' && rivalry ? COMBATIVE_RIVALRY_FANS : e.fans
    morale += e.morale
    board += e.board
  }
  const players = { ...state.players }
  for (const p of Object.values(players)) if (p.clubId === state.userClubId) players[p.id] = { ...p, morale: Math.max(0, Math.min(100, p.morale + morale)) }
  const counts = new Map<Answer, number>()
  for (const a of answers) counts.set(a, (counts.get(a) ?? 0) + 1)
  const dominant = answers.reduce((best, a) => ((counts.get(a) ?? 0) > (counts.get(best) ?? 0) ? a : best), answers[0] ?? 'humble')
  let s = applyReaction({ ...state, players }, { fanDelta: fans, boardDelta: board, reasons: [{ key: 'fans.reason.press' }] })
  s = addNews(s, [{ kind: 'press', key: `news.press.${dominant}`, params: { clubId: state.userClubId } }], rng)
  return { ...s, press: null }
}

export function skipPress(state: GameState, rng: Rng): GameState {
  let s = applyReaction(state, { fanDelta: -1, boardDelta: -1, reasons: [{ key: 'fans.reason.pressSkipped' }] })
  s = addNews(s, [{ kind: 'press', key: 'news.press.skipped', params: { clubId: state.userClubId } }], rng)
  return { ...s, press: null }
}
