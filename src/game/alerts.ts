import type { GameState } from './types'

export interface HomeAlert {
  key: 'short' | 'out' | 'tired' | 'offers' | 'youth' | 'contracts' | 'board'
  n: number
  tab: 'tactics' | 'transfers' | 'youth' | 'squad' | 'club'
}

const TIRED = 60
const BOARD_WARNING = 30

/** Things that need the manager, most urgent first. */
export function homeAlerts(s: GameState): HomeAlert[] {
  const me = s.userClubId
  const lineup = s.tactics[me].lineup
  const starters = lineup.map((id) => s.players[id]).filter(Boolean)
  const out = starters.filter((p) => p.injuredWeeks > 0 || p.suspendedMatches > 0)
  const all: HomeAlert[] = [
    { key: 'short', n: lineup.length < 11 ? lineup.length : 0, tab: 'tactics' },
    { key: 'out', n: out.length, tab: 'tactics' },
    { key: 'tired', n: starters.filter((p) => !out.includes(p) && p.fitness < TIRED).length, tab: 'tactics' },
    { key: 'offers', n: s.transfers.offers.length, tab: 'transfers' },
    { key: 'youth', n: s.youth.intake.length, tab: 'youth' },
    { key: 'contracts', n: Object.values(s.players).filter((p) => p.clubId === me && p.contractEnd <= s.season).length, tab: 'squad' },
    { key: 'board', n: s.board.confidence < BOARD_WARNING ? 1 : 0, tab: 'club' },
  ]
  return all.filter((a) => a.n > 0)
}
