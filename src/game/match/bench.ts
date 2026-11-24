import { contribution, slotRoles } from '../tactics'
import type { Player, Style } from '../types'
import type { MatchManager, MatchState, Side } from './types'

const SUB_MINUTES = [60, 70, 78]
const PER_WINDOW = 2
/** The rest are kept back for injuries. */
const PLANNED_SUBS = 3
const SMALL_STEP_DOWN = 0.94
const YOUNG = 21

function wantedStyle(s: MatchState, side: Side, m: MatchManager): Style | null {
  const lead = s.score[side] - s.score[side === 'home' ? 'away' : 'home']
  const now = s[side].tactics.style
  if (lead <= -4) return 'defensive'
  if (lead < 0 && s.minute >= 82 - 16 * m.bold) return 'attacking'
  if (lead === 1 && s.minute >= 75 + 12 * m.bold) return 'defensive'
  if (lead === 0 && s.minute >= 75 && now === 'defensive') return 'balanced'
  return null
}

/** How good a player looks after this many minutes: heavy legs count against him. */
function nowWorth(p: Player, role: Player['position'], minute: number): number {
  const spent = (minute / 90) * (30 - p.attrs.stamina)
  const legs = 1 - 0.004 * Math.max(0, minute - 45) * ((30 - p.attrs.stamina) / 20)
  return contribution({ ...p, fitness: Math.max(0, p.fitness - spent) }, role) * legs
}

function substitutions(s: MatchState, side: Side, m: MatchManager, players: Record<string, Player>) {
  const team = s[side]
  const roles = slotRoles(team.tactics.formation)
  const lead = s.score[side] - s.score[side === 'home' ? 'away' : 'home']
  const safe = lead >= 2 && s.minute >= 70
  const booked = new Set(s.events.filter((e) => e.type === 'yellow').map((e) => e.playerId))
  const cameOn = new Set(s.events.filter((e) => e.type === 'sub').map((e) => e.subOnId))
  for (let i = 0; i < PER_WINDOW && team.subsUsed < PLANNED_SUBS; i++) {
    let best: { slot: number; onId: string; gain: number } | undefined
    team.onPitch.forEach((id, slot) => {
      const off = players[id]
      if (slot === 0 || !off || cameOn.has(id)) return
      const role = roles[slot]
      for (const onId of team.bench) {
        const on = players[onId]
        if (!on || on.position !== role) continue
        const before = nowWorth(off, role, s.minute) * (booked.has(id) ? 0.97 : 1)
        const after = contribution(on, role)
        const blooding = safe && on.age <= YOUNG ? 1 + 0.25 * m.youth : 1
        // The plain comparison stops anyone weakening the team for the sake of a change.
        if (!(safe && blooding > 1) && after < contribution(off, role) * SMALL_STEP_DOWN && off.fitness >= 40) continue
        const gain = after * blooding - before
        if (gain > 0 && (!best || gain > best.gain)) best = { slot, onId, gain }
      }
    })
    if (!best) return
    const offId = team.onPitch[best.slot]
    team.onPitch[best.slot] = best.onId
    team.bench = team.bench.filter((id) => id !== best!.onId)
    team.subsUsed++
    cameOn.add(best.onId)
    s.events.push({ minute: s.minute, side, type: 'sub', playerId: offId, subOnId: best.onId, highlight: false })
  }
}

/** What an AI manager does from the touchline this minute. Changes `s`, which the caller owns; uses no luck. */
export function manage(s: MatchState, side: Side, m: MatchManager, players: Record<string, Player>) {
  if (s.minute >= 50 && s.minute % 5 === 0) {
    const style = wantedStyle(s, side, m)
    if (style && style !== s[side].tactics.style) {
      s[side].tactics.style = style
      const lead = s.score[side] - s.score[side === 'home' ? 'away' : 'home']
      if (style === 'attacking') s.events.push({ minute: s.minute, side, type: 'push', highlight: false })
      if (style === 'defensive' && lead > 0) s.events.push({ minute: s.minute, side, type: 'protect', highlight: false })
    }
  }
  if (SUB_MINUTES.includes(s.minute)) substitutions(s, side, m, players)
}
