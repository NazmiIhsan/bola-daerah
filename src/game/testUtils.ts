// Test helpers (not used by production code).
import { newGame } from './generate'
import { FREE_AGENT } from './types'

type Raw = Record<string, unknown>

/** A version 4 save: no goals, ratings or history. */
export function makeV4(): Raw {
  const s = JSON.parse(JSON.stringify(newGame(5, 'kapar')))
  s.version = 4
  for (const p of [...Object.values(s.players), ...s.youth.intake] as Raw[]) for (const k of ['goals', 'assists', 'ratingSum', 'rated']) delete p[k]
  delete s.history
  delete s.cup
  return s
}

/** A Plan-3 (version 3) save: no appearances, youth or training. */
export function makeV3(): Raw {
  const s = makeV4() as Raw
  s.version = 3
  for (const p of Object.values(s.players as Raw) as Raw[]) for (const k of ['apps', 'ovrStart', 'homeClubId', 'debuted']) delete p[k]
  delete s.training
  delete s.youth
  return s
}

/** A Plan-2 (version 2) save: no contracts, free agents or transfer state. */
export function makeV2(): Raw {
  const s = makeV3()
  s.version = 2
  const players = s.players as Record<string, Raw>
  for (const [id, p] of Object.entries(players)) {
    if (p.clubId === FREE_AGENT) delete players[id]
    else delete p.contractEnd
  }
  delete s.transfers
  delete (s.finance as Raw).transferNet
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
