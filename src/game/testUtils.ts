// Test helpers (not used by production code).
import { newGame } from './generate'

/** A Plan-1 (version 1) save: no wages, fans, board, finance, inbox, press or career. */
export function makeV1(): Record<string, unknown> {
  const s = JSON.parse(JSON.stringify(newGame(5, 'kapar')))
  s.version = 1
  for (const p of Object.values(s.players) as Array<Record<string, unknown>>) delete p.wage
  for (const k of ['fans', 'board', 'finance', 'inbox', 'press', 'career']) delete s[k]
  return s
}
