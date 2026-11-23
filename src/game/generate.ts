import { createRng, type Rng } from './rng'
import { CLUBS, DIVISION_1_IDS, DIVISION_2_IDS } from './data/clubs'
import * as N from './data/names'
import { buildFixtures } from './schedule'
import { pickBestLineup } from './tactics'
import type { Division } from './types'
import type { AttrKey, Attributes, Club, GameState, Player, Position, Tactics } from './types'

const ATTRS: AttrKey[] = ['finishing', 'passing', 'dribbling', 'tackling', 'positioning', 'pace', 'stamina', 'strength', 'goalkeeping', 'composure']

/** Weights per position; each row sums to 1. */
export const POSITION_WEIGHTS: Record<Position, Partial<Record<AttrKey, number>>> = {
  GK: { goalkeeping: 0.5, positioning: 0.2, composure: 0.15, strength: 0.15 },
  DF: { tackling: 0.3, positioning: 0.25, strength: 0.15, pace: 0.15, composure: 0.1, passing: 0.05 },
  MF: { passing: 0.3, dribbling: 0.15, stamina: 0.15, positioning: 0.1, tackling: 0.1, composure: 0.1, finishing: 0.1 },
  FW: { finishing: 0.35, pace: 0.2, composure: 0.15, dribbling: 0.15, strength: 0.1, passing: 0.05 },
}

export function ratingAt(p: Player, position: Position): number {
  const w = POSITION_WEIGHTS[position]
  let sum = 0
  for (const k of Object.keys(w) as AttrKey[]) sum += p.attrs[k] * (w[k] ?? 0)
  return sum
}

/** Position-weighted average of attributes, 1..20. */
export function overall(p: Player): number {
  return ratingAt(p, p.position)
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function makeName(rng: Rng): { firstName: string; lastName: string } {
  const r = rng.next()
  if (r < 0.6) return { firstName: rng.pick(N.MALAY_FIRST), lastName: rng.pick(N.MALAY_LAST) }
  if (r < 0.8) return { firstName: rng.pick(N.CHINESE_FIRST), lastName: rng.pick(N.CHINESE_LAST) }
  if (r < 0.95) return { firstName: rng.pick(N.INDIAN_FIRST), lastName: rng.pick(N.INDIAN_LAST) }
  return { firstName: rng.pick(N.FOREIGN_FIRST), lastName: rng.pick(N.FOREIGN_LAST) }
}

/** Deterministic, effectively collision-free id (40 random bits). */
function newId(rng: Rng): string {
  return Math.floor(rng.next() * 2 ** 40).toString(36).padStart(8, '0')
}

export function generatePlayer(rng: Rng, clubId: string, position: Position, quality: number, age?: number): Player {
  const weights = POSITION_WEIGHTS[position]
  const attrs = {} as Attributes
  for (const k of ATTRS) {
    const relevant = (weights[k] ?? 0) > 0
    let v: number
    if (k === 'goalkeeping' && position !== 'GK') v = rng.int(1, 4)
    else if (position === 'GK' && !relevant) v = quality - 5 + rng.int(-2, 2)
    else if (relevant) v = quality + rng.int(-2, 2)
    else v = quality - 2 + rng.int(-3, 3)
    attrs[k] = clamp(Math.round(v), 1, 20)
  }
  const a = age ?? rng.int(17, 34)
  const p: Player = {
    id: newId(rng),
    ...makeName(rng),
    age: a,
    position,
    attrs,
    potential: 0,
    fitness: 100,
    morale: 70,
    clubId,
    injuredWeeks: 0,
    suspendedMatches: 0,
    yellowCards: 0,
  }
  const growth = Math.max(0, 24 - a) * 0.6
  p.potential = clamp(Math.round(overall(p) + rng.next() * growth), Math.round(overall(p)), 20)
  return p
}

export function squadQuality(club: Club): number {
  return 7 + ((club.reputation - 30) * 6) / 50
}

const SQUAD_TEMPLATE: Position[] = [
  'GK', 'GK', 'GK',
  'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF',
  'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF',
  'FW', 'FW', 'FW', 'FW',
]

export function generateSquad(rng: Rng, club: Club): Player[] {
  const q = squadQuality(club)
  const seenPerPos: Record<Position, number> = { GK: 0, DF: 0, MF: 0, FW: 0 }
  const starters: Record<Position, number> = { GK: 1, DF: 4, MF: 4, FW: 2 }
  return SQUAD_TEMPLATE.map((pos) => {
    const n = seenPerPos[pos]++
    const depth = n < starters[pos] ? rng.int(-1, 1) : -rng.int(1, 4)
    return generatePlayer(rng, club.id, pos, q + depth)
  })
}

export function newGame(seed: number, userClubId: string): GameState {
  const rng = createRng(seed)
  const clubs: Record<string, Club> = {}
  const players: Record<string, Player> = {}
  const tactics: Record<string, Tactics> = {}
  for (const c of CLUBS) {
    clubs[c.id] = { ...c }
    const squad = generateSquad(rng, c)
    for (const p of squad) players[p.id] = p
    tactics[c.id] = { formation: '4-4-2', style: 'balanced', ...pickBestLineup(squad, '4-4-2') }
  }
  const divisions: [Division, Division] = [
    { id: 1, clubIds: [...DIVISION_1_IDS] },
    { id: 2, clubIds: [...DIVISION_2_IDS] },
  ]
  return {
    version: 1,
    seed,
    rngState: rng.state(),
    season: 2027,
    matchday: 1,
    userClubId,
    clubs,
    players,
    divisions,
    fixtures: buildFixtures(divisions),
    tactics,
  }
}
