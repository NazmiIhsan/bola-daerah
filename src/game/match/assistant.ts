import { energy } from './minutes'
import { canShout } from './sim'
import type { Player } from '../types'
import type { MatchState, Side, TeamChange } from './types'

/** One choice the assistant offers. `changes` is empty for "leave it". */
export interface PromptOption { key: string; changes: TeamChange[]; params?: Record<string, string> }
/** A moment the assistant speaks up. Params ending in "Id" are player ids. */
export interface Prompt { id: string; key: string; params: Record<string, string | number>; options: PromptOption[] }

/** At most this many prompts in a match, so it never nags. */
export const MAX_PROMPTS = 4
const TIRED = 35
const LAST_MINUTE = 88

const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')

/** The fittest bench player who plays the same position, if any. */
function cover(m: MatchState, side: Side, offId: string, players: Record<string, Player>): string | undefined {
  const team = m[side]
  const pos = players[offId]?.position
  const options = team.bench.filter((id) => players[id] && players[id].position === pos)
  return options.sort((a, b) => energy(team, players[b], m.minute) - energy(team, players[a], m.minute))[0]
}

/**
 * What the assistant would say right now, or null. Each kind of moment comes up at most once
 * (`seen` holds the ids already shown). Uses no luck, so it never changes the match.
 */
export function assistantPrompt(m: MatchState, side: Side, players: Record<string, Player>, seen: string[]): Prompt | null {
  if (m.finished || m.minute >= LAST_MINUTE || seen.length >= MAX_PROMPTS) return null
  const lead = m.score[side] - m.score[other(side)]
  const team = m[side]
  const style = team.tactics.style
  const keep: PromptOption = { key: 'assistant.keep', changes: [] }
  const shout = (s: Parameters<typeof canShout>[2], key: string): PromptOption[] => (canShout(m, side, s) ? [{ key, changes: [{ kind: 'shout', shout: s }] }] : [])
  const styleTo = (s: typeof style, key: string): PromptOption[] => (style !== s ? [{ key, changes: [{ kind: 'tactics', style: s }] }] : [])
  const recent = (type: 'red', who: Side) => m.events.some((e) => e.type === type && e.side === who && e.minute >= m.minute - 1)

  const candidates: Array<() => Prompt | null> = [
    () => recent('red', side) ? { id: 'red-us', key: 'assistant.redUs', params: {}, options: [...styleTo('defensive', 'assistant.dropDeep'), ...shout('encourage', 'assistant.encourage'), keep] } : null,
    () => recent('red', other(side)) ? { id: 'red-them', key: 'assistant.redThem', params: {}, options: [...styleTo('attacking', 'assistant.goForIt'), ...shout('attack', 'assistant.pushForward'), keep] } : null,
    () => m.minute >= 65 && lead < 0 ? { id: 'behind', key: 'assistant.behind', params: { n: -lead }, options: [...shout('attack', 'assistant.pushForward'), ...styleTo('attacking', 'assistant.allOut'), keep] } : null,
    () => m.minute >= 80 && lead === 1 ? { id: 'protect', key: 'assistant.protect', params: {}, options: [...shout('waste', 'assistant.waste'), ...styleTo('defensive', 'assistant.dropDeep'), keep] } : null,
    () => m.minute >= 75 && lead === 0 ? { id: 'level', key: 'assistant.level', params: {}, options: [...shout('attack', 'assistant.goForWin'), ...shout('calm', 'assistant.settle'), keep] } : null,
    () => {
      if (m.minute < 55 || team.subsUsed >= 5) return null
      for (const id of team.onPitch) {
        if (!id || !players[id] || energy(team, players[id], m.minute) >= TIRED) continue
        const on = cover(m, side, id, players)
        if (on) return { id: 'tired', key: 'assistant.tired', params: { playerId: id, pct: Math.round(energy(team, players[id], m.minute)) }, options: [{ key: 'assistant.subFor', params: { playerId: on }, changes: [{ kind: 'sub', offId: id, onId: on }] }, { key: 'assistant.notYet', changes: [] }] }
      }
      return null
    },
    () => {
      if (m.minute < 55 || team.subsUsed >= 5) return null
      const booked = m.events.filter((e) => e.type === 'yellow' && e.side === side).map((e) => e.playerId!)
      const id = booked.find((b) => team.onPitch.includes(b) && players[b] && players[b].position !== 'GK')
      const on = id && cover(m, side, id, players)
      return id && on ? { id: 'booked', key: 'assistant.booked', params: { playerId: id }, options: [{ key: 'assistant.subFor', params: { playerId: on }, changes: [{ kind: 'sub', offId: id, onId: on }] }, { key: 'assistant.leaveIt', changes: [] }] } : null
    },
  ]
  for (const make of candidates) {
    const p = make()
    // Only worth asking when there is a real choice.
    if (p && !seen.includes(p.id) && p.options.length >= 2) return p
  }
  return null
}
