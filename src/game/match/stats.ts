import type { MatchEvent, Side } from './types'

export interface SideStats { shots: number; onTarget: number; yellow: number; red: number }

export function matchStats(events: MatchEvent[]): Record<Side, SideStats> {
  const count = (side: Side): SideStats => {
    const n = (...types: MatchEvent['type'][]) => events.filter((e) => e.side === side && types.includes(e.type)).length
    return { shots: n('goal', 'save', 'miss'), onTarget: n('goal', 'save'), yellow: n('yellow'), red: n('red') }
  }
  return { home: count('home'), away: count('away') }
}

export function scorers(events: MatchEvent[], side: Side): Array<{ playerId: string; minutes: number[] }> {
  const by = new Map<string, number[]>()
  for (const e of events) if (e.type === 'goal' && e.side === side && e.playerId) by.set(e.playerId, [...(by.get(e.playerId) ?? []), e.minute])
  return [...by].map(([playerId, minutes]) => ({ playerId, minutes }))
}
