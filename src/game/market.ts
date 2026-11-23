import { overall, wageFor } from './generate'
import { createRng } from './rng'
import { isRivalry } from './rivals'
import { FREE_AGENT, type GameState, type Player, type Position } from './types'

export const SQUAD_MAX = 28
export const SQUAD_MIN = 17
export const POSITION_MIN: Record<Position, number> = { GK: 2, DF: 6, MF: 5, FW: 3 }
const KEY_PLAYERS = 5
const MAX_STEP_DOWN = 20

/** Which transfer window is open on this matchday, if any. */
export function transferWindow(matchday: number): 'pre' | 'mid' | null {
  if (matchday >= 1 && matchday <= 3) return 'pre'
  if (matchday >= 9 && matchday <= 11) return 'mid'
  return null
}

export function squad(state: GameState, clubId: string): Player[] {
  return Object.values(state.players).filter((p) => p.clubId === clubId)
}

function ageFactor(age: number): number {
  if (age <= 20) return 1.3
  if (age <= 23) return 1.2
  if (age <= 27) return 1
  if (age <= 29) return 0.8
  if (age <= 31) return 0.55
  if (age <= 33) return 0.35
  return 0.2
}

/** Market value in RM, rounded to thousands. */
export function playerValue(p: Player, season: number): number {
  const ovr = overall(p)
  const growth = 1 + 0.08 * Math.max(0, p.potential - ovr)
  const left = p.contractEnd - season
  const contract = left <= 0 ? 0.5 : left === 1 ? 0.8 : 1
  return Math.max(1, Math.round((ovr ** 3 * 100 * ageFactor(p.age) * growth * contract) / 1000)) * 1000
}

/** Position of a player in their club's pecking order, 1 = best. */
export function squadRank(state: GameState, p: Player): number {
  const mine = overall(p)
  return 1 + squad(state, p.clubId).filter((x) => overall(x) > mine).length
}

export function isKeyPlayer(state: GameState, p: Player): boolean {
  return p.clubId !== FREE_AGENT && squadRank(state, p) <= KEY_PLAYERS
}

/** How attached a club is to a player this season: 0.92..1.12, stable for the whole season. */
function clubMood(p: Player, season: number): number {
  let h = season
  for (const ch of p.id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0
  return 0.92 + 0.2 * createRng(h).next()
}

/** What the player's club wants from `buyerId` (the user by default), rounded to RM 1,000. */
export function askingPrice(state: GameState, playerId: string, buyerId = state.userClubId): number {
  const p = state.players[playerId]
  if (p.clubId === FREE_AGENT) return 0
  const status = p.listed ? 0.85 : isKeyPlayer(state, p) ? 1.5 : 1.15
  const rival = isRivalry(state.clubs[p.clubId], state.clubs[buyerId]) ? 1.25 : 1
  return Math.max(1, Math.round((playerValue(p, state.season) * status * rival * clubMood(p, state.season)) / 1000)) * 1000
}

/** True when the player's club would still have a full enough squad without them. */
export function canLeave(state: GameState, playerId: string): boolean {
  const p = state.players[playerId]
  if (p.clubId === FREE_AGENT) return true
  const mates = squad(state, p.clubId)
  return mates.length > SQUAD_MIN && mates.filter((x) => x.position === p.position).length > POSITION_MIN[p.position]
}

/** Players turn down clubs far below their current one. */
export function willJoin(state: GameState, playerId: string, clubId: string): boolean {
  const p = state.players[playerId]
  if (p.clubId === FREE_AGENT) return true
  return state.clubs[p.clubId].reputation - state.clubs[clubId].reputation <= MAX_STEP_DOWN
}

/** Weekly wage the player wants from `clubId` (a renewal when it is their own club). */
export function wageDemand(state: GameState, playerId: string, clubId: string): number {
  const p = state.players[playerId]
  const market = wageFor(p, state.clubs[clubId])
  let wage: number
  if (p.clubId === FREE_AGENT) wage = market
  else if (p.clubId === clubId) wage = Math.max(p.wage, market) * (1 + 0.005 * Math.max(0, 50 - p.morale))
  else {
    const drop = state.clubs[p.clubId].reputation - state.clubs[clubId].reputation
    wage = Math.max(market, p.wage * 1.05) * (1 + 0.02 * Math.max(0, drop - 5))
  }
  return Math.ceil(wage / 10) * 10
}

export function maxYears(p: Player): number {
  return p.age >= 32 ? 2 : 4
}
