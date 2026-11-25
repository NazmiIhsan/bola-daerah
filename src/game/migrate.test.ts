import { newGame } from './generate'
import { makeV1, makeV2 } from './testUtils'
import { migrate } from './migrate'
import { playMatchday } from './season'
import { FREE_AGENT } from './types'
import { SaveError } from '../save/storage'

test('migrates a v1 save with defaults, and it plays', () => {
  const m = migrate(makeV1())
  expect(m.version).toBe(5)
  expect(Object.values(m.players).every((p) => p.wage > 0)).toBe(true)
  expect(m.fans.mood).toBe(60)
  expect(m.career.kind).toBe('employed')
  expect(m.finance.balance).toBe(m.clubs.kapar.reputation * 20000)
  expect(() => playMatchday(m)).not.toThrow()
})

test.each([['v1', makeV1], ['v2', makeV2]])('%s saves get contracts, free agents and transfer state', (_n, make) => {
  const m = migrate(make())
  expect(m.version).toBe(5)
  const all = Object.values(m.players)
  expect(all.filter((p) => p.clubId === FREE_AGENT)).toHaveLength(24)
  for (const p of all) if (p.clubId !== FREE_AGENT) expect(p.contractEnd).toBeGreaterThan(m.season)
  expect(m.finance.transferNet).toBe(0)
  expect(m.transfers.budgets.kapar.transfer).toBeGreaterThan(0)
  expect(() => playMatchday(m)).not.toThrow()
})

test('v2 progress survives migration', () => {
  const v2 = makeV2()
  ;(v2.finance as { balance: number }).balance = 123456
  const m = migrate(v2)
  expect(m.finance.balance).toBe(123456)
  expect(m.transfers.budgets.kapar.transfer).toBe(Math.round(123456 * 0.4))
})

test('passes a v4 state through unchanged', () => {
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
