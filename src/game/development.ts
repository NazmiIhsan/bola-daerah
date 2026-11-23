import { overall, POSITION_WEIGHTS } from './generate'
import type { Rng } from './rng'
import { FREE_AGENT, type AttrKey, type GameState, type Player, type TrainingFocus } from './types'

const YOUTH_AGE = 21
const PHYSICAL: AttrKey[] = ['pace', 'stamina', 'strength']

function baseGrowth(age: number): number {
  if (age <= 18) return 0.55
  if (age <= 20) return 0.5
  if (age <= 22) return 0.4
  if (age <= 24) return 0.28
  if (age <= 26) return 0.15
  if (age <= 29) return 0.05
  return 0
}

/** Chance that a player gains an attribute point this week. */
export function growthChance(p: Player, played: boolean, focus: TrainingFocus): number {
  const gap = p.potential - overall(p)
  if (gap <= 0) return 0
  let c = baseGrowth(p.age) * Math.min(1, gap / 2) * (played ? 1.25 : 0.6)
  if (focus === 'youth' && p.age <= YOUTH_AGE) c *= 1.35
  if (focus === 'attack' && (p.position === 'MF' || p.position === 'FW')) c *= 1.2
  if (focus === 'defence' && (p.position === 'GK' || p.position === 'DF')) c *= 1.2
  return c
}

/** Chance that a player loses an attribute point this week. Keepers last three years longer. */
export function declineChance(p: Player, focus: TrainingFocus): number {
  const years = p.age - (p.position === 'GK' ? 33 : 30)
  if (years <= 0) return 0
  const c = [0.12, 0.2, 0.3, 0.4][Math.min(years, 4) - 1]
  return focus === 'fitness' ? c * 0.7 : c
}

function pickWeighted(rng: Rng, options: Array<[AttrKey, number]>): AttrKey | undefined {
  const total = options.reduce((sum, [, w]) => sum + w, 0)
  let r = rng.next() * total
  for (const [k, w] of options) {
    r -= w
    if (r <= 0) return k
  }
  return options[options.length - 1]?.[0]
}

const bump = (p: Player, k: AttrKey, by: 1 | -1): Player => ({ ...p, attrs: { ...p.attrs, [k]: p.attrs[k] + by } })

function grow(p: Player, rng: Rng): Player {
  const weights = Object.entries(POSITION_WEIGHTS[p.position]) as Array<[AttrKey, number]>
  const open = weights.filter(([k]) => p.attrs[k] < 20 && overall(bump(p, k, 1)) <= p.potential)
  const k = pickWeighted(rng, open)
  return k ? bump(p, k, 1) : p
}

function fade(p: Player, rng: Rng): Player {
  const weights = POSITION_WEIGHTS[p.position]
  const options = (Object.keys(weights) as AttrKey[])
    .map((k): [AttrKey, number] => [k, PHYSICAL.includes(k) ? 3 : 1])
    .filter(([k]) => p.attrs[k] > 1)
  const k = pickWeighted(rng, options)
  return k ? bump(p, k, -1) : p
}

/** A week of training and match experience for everyone with a club. Players whose `apps` went up have played. */
export function developWeek(before: GameState, after: GameState, rng: Rng): GameState {
  const players = { ...after.players }
  for (const p of Object.values(players)) {
    if (p.clubId === FREE_AGENT) continue
    const focus: TrainingFocus = p.clubId === after.userClubId && after.career.kind === 'employed' ? after.training : 'balanced'
    const played = p.apps > (before.players[p.id]?.apps ?? p.apps)
    if (rng.chance(growthChance(p, played, focus))) players[p.id] = grow(p, rng)
    else if (rng.chance(declineChance(p, focus))) players[p.id] = fade(p, rng)
  }
  return { ...after, players }
}
