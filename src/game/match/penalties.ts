import { createRng } from '../rng'
import type { Player } from '../types'
import type { MatchState, Side } from './types'

const KICKS = 5
const MAX_ROUNDS = 40

/** The shoot-out after a level match. Worked out from the match itself, so the live screen and the season agree. */
export function penalties(m: MatchState, players: Record<string, Player>): Record<Side, number> {
  const rng = createRng((m.rngState ^ 0x5bd1e995) >>> 0)
  const skill = (p: Player) => p.attrs.finishing * 0.7 + p.attrs.composure * 0.3
  const line = (side: Side) => m[side].onPitch.map((id) => players[id]).filter(Boolean).sort((a, b) => skill(b) - skill(a))
  const takers = { home: line('home'), away: line('away') }
  const keeper = (side: Side) => players[m[side].onPitch[0]]?.attrs.goalkeeping ?? 1
  const kick = (side: Side, n: number): number => {
    const list = takers[side]
    if (list.length === 0) return 0
    const p = 0.76 + (skill(list[n % list.length]) - keeper(side === 'home' ? 'away' : 'home')) * 0.012
    return rng.next() < Math.max(0.55, Math.min(0.92, p)) ? 1 : 0
  }
  const score = { home: 0, away: 0 }
  for (let n = 0; n < MAX_ROUNDS; n++) {
    for (const side of ['home', 'away'] as Side[]) {
      score[side] += kick(side, n)
      if (n >= KICKS) continue
      const left = { home: KICKS - n - 1, away: KICKS - n - (side === 'away' ? 1 : 0) }
      if (score.home > score.away + left.away || score.away > score.home + left.home) return score
    }
    if (n >= KICKS - 1 && score.home !== score.away) return score
  }
  score[rng.chance(0.5) ? 'home' : 'away']++
  return score
}
