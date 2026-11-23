import { CONTRACT_SEED, initialTransfers, overall, startingBalance, wageFor, withContractsAndFreeAgents } from './generate'
import { expectationFor } from './reactions'
import { createRng } from './rng'
import type { GameState, Player } from './types'
import { SaveError } from '../save/errors'

type Raw = Record<string, unknown>
type Old = Omit<GameState, 'version'> & { version: number }

/** Bring any supported save up to the current GameState version. */
export function migrate(raw: Raw): GameState {
  let s = raw
  if (s.version === 1) s = v1to2(s)
  if (s.version === 2) s = v2to3(s)
  if (s.version === 3) s = v3to4(s)
  if (s.version !== 4) throw new SaveError('unsupported_version')
  return s as unknown as GameState
}

/** Wages, fans, board, finance, inbox, press and career. */
function v1to2(raw: Raw): Raw {
  const s = raw as unknown as Old
  const players: Record<string, Player> = {}
  for (const p of Object.values(s.players)) {
    const club = s.clubs[p.clubId]
    players[p.id] = { ...p, wage: typeof p.wage === 'number' ? p.wage : wageFor(p, club ?? { reputation: 40 }) }
  }
  const migrated = {
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
  return { ...migrated, board: expectationFor(migrated as unknown as GameState) }
}

/** Contracts (nobody expires at the first season end), free agents and the transfer market. */
function v2to3(raw: Raw): Raw {
  const s = raw as unknown as Old
  return {
    ...s,
    version: 3,
    players: withContractsAndFreeAgents(s.players, createRng(s.seed ^ CONTRACT_SEED), s.season, 1, 3),
    finance: { ...s.finance, transferNet: 0 },
    transfers: initialTransfers(s.clubs, s.userClubId, s.finance.balance),
  }
}

/** Appearances, development tracking, training and the academy. */
function v3to4(raw: Raw): Raw {
  const s = raw as unknown as Old
  const players: Record<string, Player> = {}
  for (const p of Object.values(s.players)) players[p.id] = { ...p, apps: 0, ovrStart: overall(p) }
  return { ...s, version: 4, players, training: 'balanced', youth: { intake: [] } }
}
