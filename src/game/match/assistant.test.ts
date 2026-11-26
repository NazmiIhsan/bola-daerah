import { assistantPrompt, MAX_PROMPTS } from './assistant'
import { applyChange, createMatch, stepMinute } from './sim'
import { fixtureOf, makeTeam } from './testTeams'
import type { MatchState } from './types'

const { players, tactics } = fixtureOf(makeTeam('h', 11, 1), makeTeam('a', 11, 2))
const at = (minute: number, score = { home: 0, away: 0 }, extra: Partial<MatchState> = {}): MatchState => ({ ...createMatch('h', 'a', tactics, 1), minute, score, ...extra })

test('nothing to say early in a calm game', () => {
  expect(assistantPrompt(at(20), 'home', players, [])).toBeNull()
})

test('behind late: offers to push forward or go all out, and every option applies cleanly', () => {
  const m = at(70, { home: 0, away: 1 })
  const p = assistantPrompt(m, 'home', players, [])!
  expect(p.id).toBe('behind')
  expect(p.options.map((o) => o.key)).toEqual(['assistant.pushForward', 'assistant.allOut', 'assistant.keep'])
  for (const o of p.options) expect(() => o.changes.reduce((acc, c) => applyChange(acc, 'home', c), m)).not.toThrow()
})

test('one up near the end: offers to run the clock down', () => {
  const p = assistantPrompt(at(82, { home: 1, away: 0 }), 'home', players, [])!
  expect(p.id).toBe('protect')
  expect(p.options[0].changes).toEqual([{ kind: 'shout', shout: 'waste' }])
})

test('a red card for either side is raised straight away', () => {
  const red = (side: 'home' | 'away') => at(30, undefined, { events: [{ minute: 30, side, type: 'red', playerId: 'x', highlight: true }] })
  expect(assistantPrompt(red('home'), 'home', players, [])!.id).toBe('red-us')
  expect(assistantPrompt(red('away'), 'home', players, [])!.id).toBe('red-them')
})

test('a tired player: offers a fresh one in the same position', () => {
  const m = at(70)
  const tiredId = m.home.onPitch[3]
  const tired = { ...players, [tiredId]: { ...players[tiredId], fitness: 30 } }
  const p = assistantPrompt(m, 'home', tired, [])!
  expect(p.id).toBe('tired')
  const sub = p.options[0].changes[0]
  expect(sub).toMatchObject({ kind: 'sub', offId: tiredId })
  if (sub.kind === 'sub') expect(players[sub.onId].position).toBe(players[tiredId].position)
})

test('each moment comes up once, never after 88 minutes and never more than the limit', () => {
  const m = at(70, { home: 0, away: 1 })
  expect(assistantPrompt(m, 'home', players, ['behind'])?.id).not.toBe('behind')
  expect(assistantPrompt(at(89, { home: 0, away: 1 }), 'home', players, [])).toBeNull()
  expect(assistantPrompt(m, 'home', players, Array.from({ length: MAX_PROMPTS }, (_, i) => `x${i}`))).toBeNull()
})

test('asking the assistant never changes the match', () => {
  let m = createMatch('h', 'a', tactics, 5)
  const seen: string[] = []
  while (!m.finished) {
    const before = JSON.stringify(m)
    const p = assistantPrompt(m, 'home', players, seen)
    expect(JSON.stringify(m)).toBe(before)
    if (p) seen.push(p.id)
    m = stepMinute(m, players)
  }
})
