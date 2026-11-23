import { createStore, del, get, set, type UseStore } from 'idb-keyval'
import type { GameState } from '../game/types'

export interface SaveMeta {
  slot: number
  clubId: string
  season: number
  matchday: number
  savedAt: number
}

export class SaveError extends Error {
  constructor(public code: 'invalid_json' | 'wrong_shape' | 'unsupported_version') {
    super(`Save error: ${code}`)
    this.name = 'SaveError'
  }
}

export const SLOTS = [1, 2, 3] as const
interface Stored { meta: SaveMeta; state: GameState }

let store: UseStore | undefined
function getStore(): UseStore {
  if (typeof indexedDB === 'undefined') throw new Error('Storage unavailable')
  store ??= createStore('bola-daerah', 'saves')
  return store
}

const key = (slot: number) => {
  if (!SLOTS.includes(slot as 1 | 2 | 3)) throw new Error(`Invalid slot ${slot}`)
  return `slot-${slot}`
}

export async function storageAvailable(): Promise<boolean> {
  try {
    const s = getStore()
    await set('__probe__', 1, s)
    await del('__probe__', s)
    return true
  } catch {
    return false
  }
}

export async function saveGame(slot: number, state: GameState): Promise<void> {
  const stored: Stored = {
    meta: { slot, clubId: state.userClubId, season: state.season, matchday: state.matchday, savedAt: Date.now() },
    state,
  }
  await set(key(slot), stored, getStore())
}

export async function loadGame(slot: number): Promise<GameState | undefined> {
  const s = await get<Stored>(key(slot), getStore())
  return s?.state
}

export async function listSaves(): Promise<SaveMeta[]> {
  const out: SaveMeta[] = []
  for (const slot of SLOTS) {
    const s = await get<Stored>(key(slot), getStore())
    if (s) out.push(s.meta)
  }
  return out
}

export async function deleteSave(slot: number): Promise<void> {
  await del(key(slot), getStore())
}

export function exportSave(state: GameState): string {
  return JSON.stringify({ app: 'bola-daerah', ...state })
}

const SHAPE: Array<[keyof GameState, string]> = [
  ['version', 'number'], ['seed', 'number'], ['rngState', 'number'], ['season', 'number'], ['matchday', 'number'],
  ['userClubId', 'string'], ['clubs', 'object'], ['players', 'object'], ['divisions', 'object'], ['fixtures', 'object'], ['tactics', 'object'],
]

export function importSave(json: string): GameState {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new SaveError('invalid_json')
  }
  if (!data || typeof data !== 'object') throw new SaveError('wrong_shape')
  const d = data as Record<string, unknown>
  for (const [k, type] of SHAPE) if (typeof d[k] !== type || d[k] === null) throw new SaveError('wrong_shape')
  if (!Array.isArray(d.fixtures) || !Array.isArray(d.divisions)) throw new SaveError('wrong_shape')
  if (d.version !== 1) throw new SaveError('unsupported_version')
  if (!(d.userClubId as string in (d.clubs as object))) throw new SaveError('wrong_shape')
  const { app: _app, ...state } = d
  return state as unknown as GameState
}
