import { startingBalance, wageFor } from './generate'
import { expectationFor } from './reactions'
import type { GameState, Player } from './types'
import { SaveError } from '../save/errors'

/** Bring any supported save up to the current GameState version. */
export function migrate(raw: Record<string, unknown>): GameState {
  if (raw.version === 2) return raw as unknown as GameState
  if (raw.version !== 1) throw new SaveError('unsupported_version')
  const s = raw as unknown as Omit<GameState, 'version'> & { version: number }
  const players: Record<string, Player> = {}
  for (const p of Object.values(s.players)) {
    const club = s.clubs[p.clubId]
    players[p.id] = { ...p, wage: typeof p.wage === 'number' ? p.wage : wageFor(p, club ?? { reputation: 40 }) }
  }
  const migrated: GameState = {
    ...s,
    version: 2,
    players,
    fans: { mood: 60, log: [] },
    board: { expectation: 'midTable', targetPosition: 5, confidence: 60 },
    finance: { balance: startingBalance(s.clubs[s.userClubId] ?? { reputation: 40 }), history: [] },
    inbox: [],
    press: null,
    career: { kind: 'employed' },
  }
  return { ...migrated, board: expectationFor(migrated) }
}
