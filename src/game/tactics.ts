import { ratingAt } from './generate'
import type { FormationId, Player, Position, Tactics } from './types'

export const FORMATIONS: Record<FormationId, { DF: number; MF: number; FW: number }> = {
  '4-4-2': { DF: 4, MF: 4, FW: 2 },
  '4-3-3': { DF: 4, MF: 3, FW: 3 },
  '4-2-3-1': { DF: 4, MF: 5, FW: 1 },
  '3-5-2': { DF: 3, MF: 5, FW: 2 },
  '5-3-2': { DF: 5, MF: 3, FW: 2 },
  '4-5-1': { DF: 4, MF: 5, FW: 1 },
}

export interface Strength {
  attack: number
  midfield: number
  defence: number
  goalkeeping: number
}

export function isAvailable(p: Player): boolean {
  return p.injuredWeeks === 0 && p.suspendedMatches === 0
}

/** Role of each of the 11 slots for a formation: slot 0 GK, then DF, MF, FW. */
export function slotRoles(formation: FormationId): Position[] {
  const f = FORMATIONS[formation]
  return ['GK', ...Array<Position>(f.DF).fill('DF'), ...Array<Position>(f.MF).fill('MF'), ...Array<Position>(f.FW).fill('FW')]
}

/** A player's contribution in a role: 70% out of position; tired players scale to 80% at fitness 0. */
export function contribution(p: Player, role: Position): number {
  const pos = p.position === role ? 1 : 0.7
  const fit = p.fitness >= 70 ? 1 : 0.8 + (0.2 * p.fitness) / 70
  const morale = 0.95 + 0.1 * (p.morale / 100)
  return ratingAt(p, role) * pos * fit * morale
}

/** Everyone's own position comes first; spare players cover a slot only when it is empty or they would do it better. */
export function pickBestLineup(squad: Player[], formation: FormationId): { lineup: string[]; subs: string[] } {
  const pool = squad.filter(isAvailable)
  const roles = slotRoles(formation)
  const used = new Set<string>()
  const pick: (Player | undefined)[] = roles.map(() => undefined)
  const bestFree = (role: Position, natural: boolean) => {
    const candidates = pool.filter((p) => !used.has(p.id) && (!natural || p.position === role))
    return candidates.length ? candidates.reduce((a, b) => (contribution(b, role) > contribution(a, role) ? b : a)) : undefined
  }
  for (const natural of [true, false]) {
    roles.forEach((role, i) => {
      if (pick[i]) return
      const p = bestFree(role, natural)
      if (p) { pick[i] = p; used.add(p.id) }
    })
  }
  roles.forEach((role, i) => {
    const now = pick[i], cover = bestFree(role, false)
    if (!now || !cover || contribution(cover, role) <= contribution(now, role)) return
    used.delete(now.id)
    used.add(cover.id)
    pick[i] = cover
  })
  const lineup = pick.flatMap((p) => (p ? [p.id] : []))
  const subs = pool
    .filter((p) => !used.has(p.id))
    .sort((a, b) => contribution(b, b.position) - contribution(a, a.position))
    .slice(0, 7)
    .map((p) => p.id)
  return { lineup, subs }
}

/**
 * Strength from the players on the pitch in slot order. `undefined` = empty slot
 * (sent off or missing). Normalised by a 4-4-2 baseline so more defenders means
 * more defence, more forwards more attack.
 */
export function teamStrength(players: (Player | undefined)[], formation: FormationId): Strength {
  const roles = slotRoles(formation)
  const sum: Record<Position, number> = { GK: 0, DF: 0, MF: 0, FW: 0 }
  roles.forEach((role, i) => {
    const p = players[i]
    if (p) sum[role] += contribution(p, role)
  })
  return {
    goalkeeping: sum.GK,
    defence: (sum.DF + 0.3 * sum.MF + 0.1 * sum.FW) / 5.4,
    midfield: (sum.MF + 0.25 * sum.FW + 0.15 * sum.DF) / 5.1,
    attack: (sum.FW + 0.4 * sum.MF + 0.1 * sum.DF) / 4.0,
  }
}

/**
 * Swap two players between lineup slots, subs and reserves.
 * Refuses (returns the same object) if an unavailable player would enter the lineup.
 */
export function swapInTactics(t: Tactics, a: string, b: string, players: Record<string, Player>): Tactics {
  if (a === b) return t
  const lineup = [...t.lineup]
  const subs = [...t.subs]
  const where = (id: string): ['lineup' | 'subs' | 'reserve', number] => {
    const li = lineup.indexOf(id)
    if (li >= 0) return ['lineup', li]
    const si = subs.indexOf(id)
    if (si >= 0) return ['subs', si]
    return ['reserve', -1]
  }
  const [wa, ia] = where(a)
  const [wb, ib] = where(b)
  if ((wa === 'lineup' && wb !== 'lineup' && !isAvailable(players[b])) || (wb === 'lineup' && wa !== 'lineup' && !isAvailable(players[a]))) return t
  const put = (w: string, i: number, id: string) => {
    if (w === 'lineup') lineup[i] = id
    else if (w === 'subs') subs[i] = id
  }
  put(wa, ia, b)
  put(wb, ib, a)
  return { ...t, lineup, subs }
}

/** Keep the same players but re-slot them for a new formation. */
export function reslot(t: Tactics, formation: FormationId, players: Record<string, Player>): Tactics {
  const current = t.lineup.map((id) => players[id]).filter(Boolean)
  return { ...t, formation, lineup: pickBestLineup(current, formation).lineup }
}

/** Take a departed player out of the lineup or bench, filling the gap from `squad` without moving anyone else. */
export function dropFromTactics(t: Tactics, playerId: string, squad: Player[]): Tactics {
  if (!t.lineup.includes(playerId) && !t.subs.includes(playerId)) return t
  const slot = t.lineup.indexOf(playerId)
  const role = slot >= 0 ? slotRoles(t.formation)[slot] : undefined
  const lineup = t.lineup.filter((id) => id !== playerId)
  let subs = t.subs.filter((id) => id !== playerId)
  const free = () => squad.filter((p) => p.id !== playerId && isAvailable(p) && !lineup.includes(p.id) && !subs.includes(p.id))
  if (role) {
    const pool = squad.filter((p) => p.id !== playerId && isAvailable(p) && !lineup.includes(p.id))
    if (pool.length) {
      const best = pool.reduce((a, b) => (contribution(b, role) > contribution(a, role) ? b : a))
      lineup.splice(slot, 0, best.id)
      subs = subs.filter((id) => id !== best.id)
    }
  }
  const extra = free().sort((a, b) => contribution(b, b.position) - contribution(a, a.position)).slice(0, Math.max(0, t.subs.length - subs.length))
  return { ...t, lineup, subs: [...subs, ...extra.map((p) => p.id)] }
}
