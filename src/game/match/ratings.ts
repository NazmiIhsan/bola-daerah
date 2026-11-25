import { contribution, slotRoles } from '../tactics'
import type { Player, Position } from '../types'
import { minutesPlayed } from './minutes'
import type { MatchState, Side } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Marks out of ten for everyone who was on the pitch. */
export function matchRatings(m: MatchState, players: Record<string, Player>): Record<string, number> {
  const minutes = minutesPlayed(m)
  const possession = m.possession.home + m.possession.away
  const out: Record<string, number> = {}
  for (const side of ['home', 'away'] as Side[]) {
    const team = m[side], other: Side = side === 'home' ? 'away' : 'home'
    const roles = slotRoles(team.tactics.formation)
    const cameOn = m.events.filter((e) => e.type === 'sub' && e.side === side).map((e) => e.subOnId!)
    const ids = [...team.tactics.lineup, ...cameOn].filter((id) => players[id] && minutes[id] !== undefined)
    const roleOf = (id: string): Position => roles[team.tactics.lineup.indexOf(id)] ?? players[id].position
    const level = ids.reduce((sum, id) => sum + contribution(players[id], roleOf(id)), 0) / Math.max(1, ids.length)
    const margin = m.score[side] - m.score[other]
    const share = possession ? m.possession[side] / possession : 0.5
    const saves = m.events.filter((e) => e.type === 'save' && e.side === other).length
    for (const id of ids) {
      const role = roleOf(id)
      const long = minutes[id] >= 60
      let r = 6.5 + clamp(margin, -2, 2) * 0.2 + (contribution(players[id], role) - level) * 0.08
      for (const e of m.events) {
        if (e.type === 'goal' && e.playerId === id) r += 1
        if (e.type === 'goal' && e.assistId === id) r += 0.6
        if (e.type === 'miss' && e.playerId === id) r -= 0.1
        if (e.type === 'yellow' && e.playerId === id) r -= 0.3
        if (e.type === 'red' && e.playerId === id) r -= 1.2
      }
      if (role === 'GK' || role === 'DF') r += (m.score[other] === 0 && long ? 0.5 : 0) - 0.15 * m.score[other]
      if (role === 'GK') r += 0.15 * saves
      if (role === 'MF') r += (share - 0.5) * 2
      out[id] = Math.round(clamp(r, 3, 10) * 10) / 10
    }
  }
  return out
}

/** The highest mark on the pitch. */
export function bestPlayer(m: MatchState, players: Record<string, Player>): { playerId: string; rating: number } | null {
  const all = Object.entries(matchRatings(m, players))
  if (all.length === 0) return null
  const [playerId, rating] = all.reduce((a, b) => (b[1] > a[1] ? b : a))
  return { playerId, rating }
}
