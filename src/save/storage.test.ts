import 'fake-indexeddb/auto'
import { deleteSave, exportSave, importSave, listSaves, loadGame, saveGame, SaveError, storageAvailable } from './storage'
import { newGame } from '../game/generate'

const state = newGame(1, 'kapar')

test('save then load round-trips; listSaves returns metadata; deleteSave removes', async () => {
  expect(await storageAvailable()).toBe(true)
  await saveGame(2, state)
  expect(await loadGame(2)).toEqual(state)
  const saves = await listSaves()
  expect(saves).toEqual([expect.objectContaining({ slot: 2, clubId: 'kapar', season: 2027, matchday: 1 })])
  expect(typeof saves[0].savedAt).toBe('number')
  await deleteSave(2)
  expect(await loadGame(2)).toBeUndefined()
  expect(await listSaves()).toEqual([])
})

test('rejects slots outside 1..3', async () => {
  await expect(saveGame(4, state)).rejects.toThrow()
})

test('exportSave → importSave round-trips', () => {
  expect(importSave(exportSave(state))).toEqual(state)
})

test('importSave errors carry codes', () => {
  const code = (json: string) => {
    try {
      importSave(json)
      return 'no error'
    } catch (e) {
      expect(e).toBeInstanceOf(SaveError)
      return (e as SaveError).code
    }
  }
  expect(code('not json')).toBe('invalid_json')
  expect(code('{"foo":1}')).toBe('wrong_shape')
  expect(code('null')).toBe('wrong_shape')
  expect(code(JSON.stringify({ ...JSON.parse(exportSave(state)), version: 99 }))).toBe('unsupported_version')
})

test('without indexedDB, storageAvailable is false and saveGame rejects', async () => {
  const saved = globalThis.indexedDB
  // @ts-expect-error simulate a browser that blocks storage
  delete globalThis.indexedDB
  try {
    expect(await storageAvailable()).toBe(false)
    const p = saveGame(1, state)
    await expect(p).rejects.toThrow()
  } finally {
    globalThis.indexedDB = saved
  }
})

test('importSave rejects saves that are broken inside (semantic checks)', () => {
  const base = JSON.parse(exportSave(state))
  const code = (obj: unknown) => {
    try { importSave(JSON.stringify(obj)); return 'no error' } catch (e) { return (e as SaveError).code }
  }
  // user club not in any division
  expect(code({ ...base, divisions: [{ id: 1, clubIds: base.divisions[0].clubIds }, { id: 2, clubIds: base.divisions[1].clubIds.filter((c: string) => c !== 'kapar') }] })).toBe('wrong_shape')
  // wrong number of divisions
  expect(code({ ...base, divisions: [base.divisions[0]] })).toBe('wrong_shape')
  // missing tactics for a club
  const { kapar: _k, ...tactics } = base.tactics
  expect(code({ ...base, tactics })).toBe('wrong_shape')
  // tactics without arrays
  expect(code({ ...base, tactics: { ...base.tactics, klang: { formation: '4-4-2' } } })).toBe('wrong_shape')
  // fixture referring to an unknown club
  expect(code({ ...base, fixtures: [...base.fixtures, { ...base.fixtures[0], id: 'x', homeId: 'atlantis' }] })).toBe('wrong_shape')
  // lineup referring to an unknown player
  expect(code({ ...base, tactics: { ...base.tactics, kapar: { ...base.tactics.kapar, lineup: ['ghost'] } } })).toBe('wrong_shape')
})

test('importSave upgrades older saves', async () => {
  const { makeV1, makeV2, makeV3 } = await import('../game/testUtils')
  expect(importSave(JSON.stringify(makeV1())).version).toBe(4)
  expect(importSave(JSON.stringify(makeV2())).version).toBe(4)
  expect(importSave(JSON.stringify(makeV3())).version).toBe(4)
})

test('importSave rejects saves with broken transfer data', () => {
  const base = JSON.parse(exportSave(state))
  const code = (obj: unknown) => {
    try { importSave(JSON.stringify(obj)); return 'no error' } catch (e) { return (e as SaveError).code }
  }
  const { transfers: _t, ...noTransfers } = base
  expect(code(noTransfers)).toBe('wrong_shape')
  expect(code({ ...base, transfers: { ...base.transfers, offers: null } })).toBe('wrong_shape')
  expect(code({ ...base, youth: { intake: null } })).toBe('wrong_shape')
  expect(code({ ...base, training: 'yoga' })).toBe('wrong_shape')
  expect(code({ ...base, transfers: { ...base.transfers, budgets: {} } })).toBe('wrong_shape')
  const [id] = Object.keys(base.players)
  expect(code({ ...base, players: { ...base.players, [id]: { ...base.players[id], clubId: 'atlantis' } } })).toBe('wrong_shape')
})
