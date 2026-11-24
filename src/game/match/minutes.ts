import type { MatchState } from './types'

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
