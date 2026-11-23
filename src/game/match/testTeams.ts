// Test helper: uniform-quality teams for match tests.
import { generatePlayer } from '../generate'
import { createRng } from '../rng'
import { pickBestLineup } from '../tactics'
import type { Player, Position, Style, Tactics } from '../types'

export function makeTeam(clubId: string, quality: number, seed: number, style: Style = 'balanced', available = 23) {
  const rng = createRng(seed)
  const template: Position[] = ['GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'FW', 'DF', 'MF', 'FW']
  const players: Player[] = template.map((pos, i) => ({ ...generatePlayer(rng, clubId, pos, quality, 25), id: `${clubId}-${i}`, injuredWeeks: i < available ? 0 : 2 }))
  const tactics: Tactics = { formation: '4-4-2', style, ...pickBestLineup(players, '4-4-2') }
  return { players, tactics }
}

export function fixtureOf(home: ReturnType<typeof makeTeam>, away: ReturnType<typeof makeTeam>) {
  const players = Object.fromEntries([...home.players, ...away.players].map((p) => [p.id, p]))
  const tactics = { [home.players[0].clubId]: home.tactics, [away.players[0].clubId]: away.tactics }
  return { players, tactics }
}
