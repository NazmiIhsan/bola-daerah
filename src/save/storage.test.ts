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
