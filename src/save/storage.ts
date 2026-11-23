import { createStore, del, get, set, type UseStore } from 'idb-keyval'
import { FREE_AGENT, type GameState } from '../game/types'
import { SaveError } from './errors'
import { migrate } from '../game/migrate'

export interface SaveMeta {
  slot: number
  clubId: string
  season: number
  matchday: number
  savedAt: number
}

export { SaveError }

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
  return s ? migrate(s.state as unknown as Record<string, unknown>) : undefined
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
  if (d.version !== 1 && d.version !== 2 && d.version !== 3) throw new SaveError('unsupported_version')
  const { app: _app, ...rest } = d
  const state = migrate(rest)
  if (!isConsistent(state)) throw new SaveError('wrong_shape')
  return state
}

/** Semantic checks so a save that passes the shape test can't crash the game later. */
function isConsistent(s: GameState): boolean {
  const isArr = Array.isArray
  if (!(s.userClubId in s.clubs)) return false
  if (s.divisions.length !== 2 || !s.divisions.every((d) => d && isArr(d.clubIds))) return false
  const inDivs = s.divisions.flatMap((d) => d.clubIds)
  if (inDivs.filter((c) => c === s.userClubId).length !== 1) return false
  for (const c of inDivs) {
    if (!(c in s.clubs)) return false
    const t = s.tactics[c]
    if (!t || !isArr(t.lineup) || !isArr(t.subs)) return false
    if (![...t.lineup, ...t.subs].every((id) => typeof id === 'string' && id in s.players)) return false
  }
  const tr = s.transfers
  if (!tr || typeof tr !== 'object' || !isArr(tr.offers) || !isArr(tr.blocked) || !isArr(tr.history)) return false
  if (!tr.agreed || typeof tr.agreed !== 'object' || !tr.budgets || typeof tr.budgets !== 'object') return false
  if (!inDivs.every((c) => typeof tr.budgets[c]?.transfer === 'number' && typeof tr.budgets[c]?.wage === 'number')) return false
  if (!tr.offers.every((o) => o && o.playerId in s.players && o.clubId in s.clubs)) return false
  if (!Object.values(s.players).every((p) => p && (p.clubId === FREE_AGENT || p.clubId in s.clubs))) return false
  return s.fixtures.every((f) => f && f.homeId in s.clubs && f.awayId in s.clubs && typeof f.round === 'number')
}
