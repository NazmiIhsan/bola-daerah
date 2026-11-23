import { generatePlayer, overall, squadQuality } from './generate'
import { AI_SQUAD_MAX, POSITION_MIN, squad } from './market'
import type { Rng } from './rng'
import { FREE_AGENT, type Club, type GameState, type Player, type Position } from './types'

const POSITIONS: Position[] = ['GK', 'DF', 'MF', 'FW']
/** A comfortable number per position; the intake favours whatever is furthest below it. */
const IDEAL: Record<Position, number> = { GK: 3, DF: 8, MF: 8, FW: 4 }
const CONTRACT_YEARS = 2
export const YOUTH_TUNING = { below: 3.6, minGrowth: 1, maxGrowth: 5.1, goldenChance: 0.08, goldenBonus: 3 }

export function generateYouth(rng: Rng, club: Club, position: Position, season: number, bonus = 0): Player {
  const p = generatePlayer(rng, club.id, position, squadQuality(club) - YOUTH_TUNING.below + bonus, rng.int(16, 18))
  const ability = overall(p)
  const growth = YOUTH_TUNING.minGrowth + rng.next() * (YOUTH_TUNING.maxGrowth - YOUTH_TUNING.minGrowth)
  return { ...p, homeClubId: club.id, contractEnd: season + CONTRACT_YEARS, potential: Math.min(20, Math.max(Math.ceil(ability + 0.5), Math.round(ability + growth))) }
}

/** Three or four academy graduates, thin positions first. Now and then they are a golden generation. */
export function youthIntake(rng: Rng, state: GameState, clubId: string): Player[] {
  const count = Object.fromEntries(POSITIONS.map((pos) => [pos, 0])) as Record<Position, number>
  for (const p of squad(state, clubId)) count[p.position]++
  const bonus = rng.chance(YOUTH_TUNING.goldenChance) ? YOUTH_TUNING.goldenBonus : 0
  return Array.from({ length: rng.int(3, 4) }, () => {
    const need = (pos: Position) => count[pos] / IDEAL[pos]
    const low = Math.min(...POSITIONS.map(need))
    const position = low < 0.75 ? POSITIONS.find((pos) => need(pos) === low)! : rng.pick(['DF', 'DF', 'MF', 'MF', 'FW', 'GK'] as Position[])
    count[position]++
    return generateYouth(rng, state.clubs[clubId], position, state.season, bonus)
  })
}

/** What a player is worth keeping for: ability now, plus some credit for the future. */
const keepValue = (p: Player) => overall(p) + (p.age <= 22 ? 0.6 * Math.max(0, p.potential - overall(p)) : 0) - (p.age >= 33 ? 1 : 0)

/** Every AI club adds its intake and lets its least useful players go. */
export function aiIntake(state: GameState, rng: Rng): GameState {
  const players = { ...state.players }
  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId && state.career.kind === 'employed') continue
    let mates = [...squad(state, club.id), ...youthIntake(rng, state, club.id)]
    for (const p of mates) players[p.id] = p
    while (mates.length > AI_SQUAD_MAX) {
      const spare = mates.filter((p) => mates.filter((x) => x.position === p.position).length > POSITION_MIN[p.position])
      const worst = spare.reduce((a, b) => (keepValue(b) < keepValue(a) ? b : a))
      players[worst.id] = { ...worst, clubId: FREE_AGENT }
      mates = mates.filter((p) => p.id !== worst.id)
    }
  }
  return { ...state, players }
}
