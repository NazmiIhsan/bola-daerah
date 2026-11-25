import type { Rng } from './rng'
import type { Cup, CupTie, Fixture, GameState } from './types'

/** Each cup round is played just before this league matchday. */
export const CUP_WEEKS = [3, 6, 9, 13, 17]
const ROUND_NAMES = ['prelim', 'r16', 'qf', 'sf', 'final'] as const
const PRELIM_CLUBS = 6
const PRIZES = [20_000, 30_000, 50_000, 80_000, 200_000]

export const cupRoundName = (round: number) => ROUND_NAMES[round]
/** What winning a tie in this round pays. */
export const cupPrize = (round: number) => PRIZES[round] ?? 0

const divisionIndex = (state: Pick<GameState, 'divisions'>, id: string) => state.divisions.findIndex((d) => d.clubIds.includes(id))

/** Pair clubs at random. Against a higher division the smaller club is at home. */
function drawTies(state: Pick<GameState, 'divisions' | 'season'>, clubIds: string[], round: number, rng: Rng): CupTie[] {
  const left = [...clubIds]
  const take = () => left.splice(rng.int(0, left.length - 1), 1)[0]
  const ties: CupTie[] = []
  while (left.length >= 2) {
    let homeId = take(), awayId = take()
    if (divisionIndex(state, homeId) < divisionIndex(state, awayId)) [homeId, awayId] = [awayId, homeId]
    ties.push({ id: `cup-${state.season}-${round}-${homeId}-${awayId}`, homeId, awayId })
  }
  return ties
}

const bySize = (state: Pick<GameState, 'clubs'>) => Object.values(state.clubs).sort((a, b) => a.reputation - b.reputation || a.id.localeCompare(b.id)).map((c) => c.id)

export function newCup(state: Pick<GameState, 'clubs' | 'divisions' | 'season'>, rng: Rng): Cup {
  const ids = bySize(state)
  return { waiting: ids.slice(PRELIM_CLUBS), rounds: [drawTies(state, ids.slice(0, PRELIM_CLUBS), 0, rng)] }
}

/** The round to be played now, if it is time for one. */
export function cupDue(state: Pick<GameState, 'cup' | 'matchday'>): boolean {
  if (!state.cup) return false
  const round = state.cup.rounds.length - 1
  return state.cup.rounds[round].some((t) => !t.winnerId) && state.matchday >= CUP_WEEKS[round] && state.matchday <= 18
}

export function cupTieOf(state: Pick<GameState, 'cup'>, clubId: string): CupTie | undefined {
  return state.cup?.rounds[state.cup.rounds.length - 1].find((t) => !t.winnerId && (t.homeId === clubId || t.awayId === clubId))
}

/** A club's cup tie as a fixture, when its round is due. */
export function cupFixture(state: Pick<GameState, 'cup' | 'matchday'>, clubId: string): Fixture | undefined {
  const t = cupDue(state) ? cupTieOf(state, clubId) : undefined
  return t && { id: t.id, division: 1, round: state.matchday, homeId: t.homeId, awayId: t.awayId, cup: true }
}

/** Store a finished round and draw the next one. */
export function advanceCup(state: GameState, played: CupTie[], rng: Rng): Cup {
  const cup = state.cup!
  const round = cup.rounds.length - 1
  const rounds = [...cup.rounds.slice(0, round), played]
  const through = [...played.map((t) => t.winnerId!), ...cup.waiting]
  return { waiting: [], rounds: through.length >= 2 ? [...rounds, drawTies(state, through, round + 1, rng)] : rounds }
}

export function cupResult(cup: Cup | null): { winnerId: string; runnerUpId: string } | null {
  const final = cup && cup.rounds.length === CUP_WEEKS.length ? cup.rounds[cup.rounds.length - 1][0] : undefined
  if (!final?.winnerId) return null
  return { winnerId: final.winnerId, runnerUpId: final.winnerId === final.homeId ? final.awayId : final.homeId }
}
