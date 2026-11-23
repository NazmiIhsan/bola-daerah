import { createRng, type Rng } from './rng'
import { CLUBS, DIVISION_1_IDS, DIVISION_2_IDS } from './data/clubs'
import * as N from './data/names'
import { buildFixtures } from './schedule'
import { pickBestLineup } from './tactics'
import { expectationFor } from './reactions'
import { FREE_AGENT } from './types'
import type { AttrKey, Attributes, Budget, Club, Division, GameState, Player, Position, Tactics, TransferState } from './types'

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
    wage: 0,
    contractEnd: 0,
  }
  const growth = Math.max(0, 24 - a) * 0.6
  p.potential = clamp(Math.round(overall(p) + rng.next() * growth), Math.round(overall(p)), 20)
  p.wage = wageFor(p, { reputation: reputationForQuality(quality) })
  return p
}

/** RM per week, rounded to RM 10. */
export function wageFor(p: Player, club: Pick<Club, 'reputation'>): number {
  return Math.max(10, Math.round((overall(p) ** 2 * 14 * (0.6 + club.reputation / 100)) / 10) * 10)
}

export function startingBalance(club: Pick<Club, 'reputation'>): number {
  return club.reputation * 20000
}

/** Inverse of squadQuality: the reputation a squad of this quality implies. */
const reputationForQuality = (q: number) => 30 + ((q - 7) * 50) / 6

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

const START_FREE_AGENTS = 24

/** What the board allows for weekly wages: a full squad a little under the club's best XI level,
 * which leaves every club some headroom over its starting wage bill. */
export function wageBudgetFor(club: Pick<Club, 'reputation'>): number {
  const q = 7 + ((club.reputation - 30) * 6) / 50 - 0.2
  return Math.round((23 * q ** 2 * 14 * (0.6 + club.reputation / 100)) / 100) * 100
}

export function budgetFor(club: Pick<Club, 'reputation'>, balance: number): Budget {
  return { transfer: Math.round(Math.max(0, balance) * 0.4), wage: wageBudgetFor(club) }
}

export function generateFreeAgents(rng: Rng, n: number): Player[] {
  const order: Position[] = ['GK', 'DF', 'DF', 'MF', 'MF', 'FW']
  return Array.from({ length: n }, (_, i) => generatePlayer(rng, FREE_AGENT, order[i % order.length], rng.int(5, 11)))
}

/** Budgets for every club and an empty market. AI clubs spend from a nominal balance. */
export function initialTransfers(clubs: Record<string, Club>, userClubId: string, userBalance: number): TransferState {
  const budgets: Record<string, Budget> = {}
  for (const c of Object.values(clubs)) budgets[c.id] = budgetFor(c, c.id === userClubId ? userBalance : startingBalance(c))
  return { budgets, offers: [], agreed: {}, blocked: [], history: [] }
}

/** Give every club player a contract ending `min`..`max` seasons from now, and add a pool of free agents. */
export function withContractsAndFreeAgents(players: Record<string, Player>, rng: Rng, season: number, min: number, max: number): Record<string, Player> {
  const out: Record<string, Player> = {}
  for (const p of Object.values(players)) out[p.id] = { ...p, contractEnd: season + rng.int(min, max) }
  for (const p of generateFreeAgents(rng, START_FREE_AGENTS)) out[p.id] = { ...p, contractEnd: season }
  return out
}

export const CONTRACT_SEED = 0x51ed270b

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
  const season = 2027
  const state: GameState = {
    version: 3,
    seed,
    rngState: rng.state(),
    season,
    matchday: 1,
    userClubId,
    clubs,
    players: withContractsAndFreeAgents(players, createRng(seed ^ CONTRACT_SEED), season, 0, 3),
    divisions,
    fixtures: buildFixtures(divisions),
    tactics,
    fans: { mood: 60, log: [] },
    board: { expectation: 'midTable', targetPosition: 5, confidence: 60 },
    finance: { balance: startingBalance(clubs[userClubId]), history: [], transferNet: 0 },
    inbox: [],
    press: null,
    career: { kind: 'employed' },
    transfers: initialTransfers(clubs, userClubId, startingBalance(clubs[userClubId])),
  }
  return { ...state, board: expectationFor(state) }
}
