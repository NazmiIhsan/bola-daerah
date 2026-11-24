import { wageBill } from './finance'
import { overall } from './generate'
import { canLeave, justJoined, squad } from './market'
import type { MatchManager } from './match/types'
import { createRng, type Rng } from './rng'
import { computeTable } from './table'
import { FORMATIONS, pickBestLineup, teamStrength } from './tactics'
import type { FormationId, GameState, Player, Style, Tactics, TrainingFocus } from './types'

export interface Manager extends MatchManager {
  /** favourite formations, best first */
  formations: [FormationId, FormationId]
}

// A function, because this module loads before its imports are ready (they import each other).
const formationIds = () => Object.keys(FORMATIONS) as FormationId[]

/** Every club the user isn't running. A sacked manager's club carries on without them. */
export function isAiRun(state: Pick<GameState, 'userClubId' | 'career'>, clubId: string): boolean {
  return clubId !== state.userClubId || state.career.kind === 'sacked'
}

/** The club's AI manager. Worked out from the save's seed, so it never changes and needs no saving. */
export function managerOf(state: Pick<GameState, 'seed'>, clubId: string): Manager {
  let h = state.seed | 0
  for (const ch of clubId) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761) ^ (h >>> 13)
  const rng = createRng(h >>> 0)
  const first = rng.pick(formationIds())
  return {
    attack: rng.next(),
    bold: rng.next(),
    youth: rng.next(),
    formations: [first, rng.pick(formationIds().filter((f) => f !== first))],
  }
}

const FAVOURITE = [0.12, 0.06]
const KEEP = 0.015

/** How good a team would be in a formation. Managers fear conceding more than they love scoring. */
export function formationScore(players: Player[], formation: FormationId): number {
  const byId = new Map(players.map((p) => [p.id, p]))
  const s = teamStrength(pickBestLineup(players, formation).lineup.map((id) => byId.get(id)), formation)
  return 1.25 * Math.log(Math.max(0.1, s.attack)) + 2 * Math.log(Math.max(0.1, s.defence)) + 0.9 * Math.log(Math.max(0.1, s.midfield))
}

/** The best fit for the players, leaning towards the manager's favourites and what the team already plays. */
function aiFormation(state: GameState, clubId: string): FormationId {
  const players = squad(state, clubId)
  const m = managerOf(state, clubId)
  const score = (f: FormationId) => formationScore(players, f) + (FAVOURITE[m.formations.indexOf(f)] ?? 0) + (state.tactics[clubId]?.formation === f ? KEEP : 0)
  return formationIds().reduce((a, b) => (score(b) > score(a) ? b : a))
}

/** Average quality of a club's best available eleven. */
function power(state: GameState, clubId: string): number {
  const byId = state.players
  const { lineup } = pickBestLineup(squad(state, clubId), state.tactics[clubId]?.formation ?? '4-4-2')
  return lineup.reduce((sum, id) => sum + overall(byId[id]), 0) / 11
}

const RUN_IN = 14

/** Third-from-bottom or worse with the season running out. */
function inTrouble(state: GameState, clubId: string): boolean {
  if (state.matchday < RUN_IN) return false
  const d = state.divisions.find((x) => x.clubIds.includes(clubId))
  if (!d || d.id !== 1) return false
  const table = computeTable(d.clubIds, state.fixtures.filter((f) => f.division === d.id))
  return table.findIndex((r) => r.clubId === clubId) >= table.length - 3
}

/** Attack-minded managers and favourites go for it; outsiders sit deep or hit on the break. */
function aiStyle(state: GameState, clubId: string): Style {
  const f = state.fixtures.find((x) => x.round === state.matchday && (x.homeId === clubId || x.awayId === clubId))
  if (!f) return state.tactics[clubId].style
  const m = managerOf(state, clubId)
  const gap = power(state, clubId) / Math.max(1, power(state, f.homeId === clubId ? f.awayId : f.homeId)) - 1
  const urge = (m.attack - 0.5) * 0.5 + gap * 1.2 + (f.homeId === clubId ? 0.05 : -0.05) + (inTrouble(state, clubId) ? 0.12 : 0)
  if (urge > 0.29) return 'attacking'
  if (urge > -0.04) return 'balanced'
  return m.bold > 0.45 ? 'counter' : 'defensive'
}

/** Everything an AI manager decides before kick-off. */
export function aiTactics(state: GameState, clubId: string): Tactics {
  const formation = aiFormation(state, clubId)
  return { formation, style: aiStyle(state, clubId), ...pickBestLineup(squad(state, clubId), formation) }
}

const TIRED = 50
const YOUNG = 21

/** What an AI club works on this week. */
export function aiFocus(state: GameState, clubId: string): TrainingFocus {
  const m = managerOf(state, clubId)
  const mates = squad(state, clubId)
  const xi = [...mates].sort((a, b) => overall(b) - overall(a)).slice(0, 11)
  if (xi.reduce((sum, p) => sum + p.fitness, 0) / Math.max(1, xi.length) < TIRED) return 'fitness'
  if (m.youth > 0.85 && mates.filter((p) => p.age <= YOUNG).length >= 6) return 'youth'
  if (m.attack > 0.62) return 'attack'
  if (m.attack < 0.38) return 'defence'
  return 'balanced'
}

/** Does an AI club offer this player a new deal (and does he take it)? */
export function aiRenews(state: GameState, p: Player, rng: Rng): boolean {
  // Age decides, not ability: clubs that kept their best and dropped the rest made the whole league better every year.
  let chance = 0.85
  if (p.age <= YOUNG) chance += 0.05 * managerOf(state, p.clubId).youth
  if (p.age >= 33) chance -= squad(state, p.clubId).filter((x) => overall(x) > overall(p)).length < 11 ? 0.1 : 0.5
  return rng.chance(Math.max(0.05, Math.min(0.97, chance)))
}

const LIST_MAX = 3
const COMFORTABLE = 20

/** AI clubs put players they can spare on the transfer list, and take back those they now need. */
export function aiListings(state: GameState): GameState {
  const players = { ...state.players }
  for (const clubId of Object.keys(state.clubs)) {
    if (!isAiRun(state, clubId)) continue
    const m = managerOf(state, clubId)
    const ranked = squad(state, clubId).sort((a, b) => overall(b) - overall(a) || a.id.localeCompare(b.id))
    const n = Math.max(0, Math.min(LIST_MAX, ranked.length - COMFORTABLE))
    const spare = ranked.slice(14).filter((p) => (p.age > YOUNG || (m.youth < 0.25 && p.age > 19)) && canLeave(state, p.id) && !justJoined(state, p.id))
    const listed = new Set(spare.slice(-n || spare.length).map((p) => p.id))
    if (n === 0) listed.clear()
    for (const p of ranked) if (!!p.listed !== listed.has(p.id)) players[p.id] = { ...p, listed: listed.has(p.id) }
  }
  return { ...state, players }
}

/** AI clubs trade constantly, so their budget is a little looser than the user's. */
const AI_WAGE_SLACK = 1.15

/** Can the club pay another wage? */
export function hasWageRoom(state: GameState, clubId: string, wage: number): boolean {
  return wageBill(state, clubId) + wage <= state.transfers.budgets[clubId].wage * AI_WAGE_SLACK
}

export const trainingOf = (state: GameState, clubId: string): TrainingFocus => (isAiRun(state, clubId) ? aiFocus(state, clubId) : state.training)

export const trainingByClub = (state: GameState): Record<string, TrainingFocus> =>
  Object.fromEntries(Object.keys(state.clubs).map((id) => [id, trainingOf(state, id)]))
