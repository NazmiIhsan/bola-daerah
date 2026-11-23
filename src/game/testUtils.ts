// Test helpers (not used by production code).
import { newGame } from './generate'
import { FREE_AGENT } from './types'

type Raw = Record<string, unknown>

/** A Plan-2 (version 2) save: no contracts, free agents or transfer state. */
export function makeV2(): Raw {
  const s = JSON.parse(JSON.stringify(newGame(5, 'kapar')))
  s.version = 2
  for (const [id, p] of Object.entries(s.players) as Array<[string, Raw]>) {
    if (p.clubId === FREE_AGENT) delete s.players[id]
    else delete p.contractEnd
  }
  delete s.transfers
  delete s.finance.transferNet
  return s
}

/** A Plan-1 (version 1) save: no wages, fans, board, finance, inbox, press or career either. */
export function makeV1(): Raw {
  const s = makeV2()
  s.version = 1
  for (const p of Object.values(s.players as Raw) as Raw[]) delete p.wage
  for (const k of ['fans', 'board', 'finance', 'inbox', 'press', 'career']) delete s[k]
  return s
}
