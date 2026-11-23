import { ANSWER_EFFECTS, answerPress, maybePress, skipPress } from './press'
import { newGame } from './generate'
import { createRng } from './rng'
import type { GameState } from './types'

const klang = () => newGame(1, 'klang')
const derbyFixture = (s: GameState) => s.fixtures.find((f) => [f.homeId, f.awayId].sort().join() === 'klang,petaling')!
const normalFixture = (s: GameState) => s.fixtures.find((f) => (f.homeId === 'klang' || f.awayId === 'klang') && ![f.homeId, f.awayId].includes('petaling'))!

test('pre-match press before a rivalry always happens, 1–3 questions, rival question first', () => {
  const s = klang()
  for (let seed = 0; seed < 30; seed++) {
    const p = maybePress(s, 'pre', derbyFixture(s), createRng(seed))!
    expect(p).not.toBeNull()
    expect(p.kind).toBe('pre')
    expect(p.questions.length).toBeGreaterThanOrEqual(1)
    expect(p.questions.length).toBeLessThanOrEqual(3)
    expect(p.questions[0].key).toBe('press.q.pre.rival')
  }
})

test('normal pre-match press happens sometimes, not always', () => {
  const s = klang()
  let n = 0
  for (let seed = 0; seed < 200; seed++) if (maybePress(s, 'pre', normalFixture(s), createRng(seed))) n++
  expect(n).toBeGreaterThan(30)
  expect(n).toBeLessThan(120)
})

test('post-match press uses the result', () => {
  const s = klang()
  const f = { ...normalFixture(s), result: { home: 5, away: 0 } }
  const p = maybePress(s, 'post', f, createRng(1))!
  expect(p.kind).toBe('post')
  expect(['press.q.post.win', 'press.q.post.loss']).toContain(p.questions[0].key)
})

test('confident answers raise squad morale and fans, clear press, add press news', () => {
  const s0 = klang()
  const press = { kind: 'pre' as const, fixtureId: normalFixture(s0).id, questions: [{ key: 'press.q.pre.generic', params: {} }, { key: 'press.q.pre.generic', params: {} }] }
  const s = { ...s0, press }
  const after = answerPress(s, ['confident', 'confident'], createRng(1))
  const squad = (st: GameState) => Object.values(st.players).filter((p) => p.clubId === 'klang')
  expect(squad(after)[0].morale).toBe(squad(s)[0].morale + 2 * ANSWER_EFFECTS.confident.morale)
  expect(after.fans.mood).toBe(s.fans.mood + 2 * ANSWER_EFFECTS.confident.fans)
  expect(after.press).toBeNull()
  expect(after.inbox[0]).toMatchObject({ kind: 'press', key: 'news.press.confident' })
})

test('combative answers in a rivalry give +4 fans each', () => {
  const s0 = klang()
  const s = { ...s0, press: { kind: 'pre' as const, fixtureId: derbyFixture(s0).id, questions: [{ key: 'press.q.pre.rival', params: {} }] } }
  expect(answerPress(s, ['combative'], createRng(1)).fans.mood).toBe(s.fans.mood + 4)
})

test('skipping lowers fans and board by 1 and clears press', () => {
  const s0 = klang()
  const s = { ...s0, press: { kind: 'pre' as const, fixtureId: normalFixture(s0).id, questions: [{ key: 'press.q.pre.generic', params: {} }] } }
  const after = skipPress(s, createRng(1))
  expect(after.fans.mood).toBe(s.fans.mood - 1)
  expect(after.board.confidence).toBe(s.board.confidence - 1)
  expect(after.press).toBeNull()
  expect(after.inbox[0].key).toBe('news.press.skipped')
})
