import { newGame } from './generate'
import { makeV1 } from './testUtils'
import { migrate } from './migrate'
import { playMatchday } from './season'
import { SaveError } from '../save/storage'

test('migrates a v1 save to v2 with defaults, and it plays', () => {
  const m = migrate(makeV1())
  expect(m.version).toBe(2)
  expect(Object.values(m.players).every((p) => p.wage > 0)).toBe(true)
  expect(m.fans.mood).toBe(60)
  expect(m.career.kind).toBe('employed')
  expect(m.finance.balance).toBe(m.clubs.kapar.reputation * 20000)
  expect(() => playMatchday(m)).not.toThrow()
})

test('passes a v2 state through unchanged', () => {
  const s = newGame(5, 'kapar')
  expect(migrate(JSON.parse(JSON.stringify(s)))).toEqual(s)
})

test('unknown versions throw unsupported_version', () => {
  expect(() => migrate({ ...makeV1(), version: 7 })).toThrow(SaveError)
  try { migrate({ ...makeV1(), version: 7 }) } catch (e) { expect((e as SaveError).code).toBe('unsupported_version') }
})

test('migrated saves get a real board expectation', () => {
  expect(migrate(makeV1()).board).toMatchObject({ expectation: 'promotion', targetPosition: 2 })
})
