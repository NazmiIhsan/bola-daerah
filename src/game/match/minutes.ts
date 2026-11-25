import type { Player } from '../types'
import type { LiveTeam, MatchState } from './types'

/** How many minutes each player has been on the pitch. */
export function minutesPlayed(m: MatchState): Record<string, number> {
  const from: Record<string, number> = {}
  const out: Record<string, number> = {}
  for (const id of [...m.home.tactics.lineup, ...m.away.tactics.lineup]) if (id) from[id] = 0
  const leave = (id: string | undefined, minute: number) => {
    if (id === undefined || from[id] === undefined) return
    out[id] = minute - from[id]
    delete from[id]
  }
  for (const e of m.events) {
    if (e.type === 'red' || e.type === 'injury' || e.type === 'sub') leave(e.playerId, e.minute)
    if (e.type === 'sub' && e.subOnId) from[e.subOnId] = e.minute
  }
  for (const id of Object.keys(from)) leave(id, m.minute)
  return out
}

/** What a player has left in the tank during a match, 0..100. */
export function energy(team: LiveTeam, p: Player, minute: number): number {
  const on = team.onPitch.includes(p.id) || team.since?.[p.id] !== undefined
  const minutes = on ? Math.max(0, minute - (team.since?.[p.id] ?? 0)) : 0
  return Math.max(0, p.fitness - ((30 - p.attrs.stamina) * minutes) / 90)
}
