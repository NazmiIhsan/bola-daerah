import { createRng, type Rng } from './rng'
import { budgetFor, startingBalance } from './generate'
import { expectationFor } from './reactions'
import { addNews } from './news'
import type { GameState } from './types'

export function makeOffers(state: GameState, rng: Rng): string[] {
  const old = state.clubs[state.userClubId]
  let pool = Object.values(state.clubs).filter((c) => c.id !== old.id && c.reputation <= old.reputation - 5).map((c) => c.id)
  if (pool.length < 2) {
    pool = state.divisions[1].clubIds
      .filter((id) => id !== old.id)
      .sort((a, b) => state.clubs[a].reputation - state.clubs[b].reputation)
      .slice(0, 4)
  }
  const n = Math.min(pool.length, rng.int(2, 3))
  const offers: string[] = []
  const left = [...pool]
  while (offers.length < n && left.length) offers.push(left.splice(rng.int(0, left.length - 1), 1)[0])
  return offers
}

/** Forget the user's open negotiations and transfer list. */
function closeBusiness(state: GameState): GameState {
  const players = { ...state.players }
  for (const p of Object.values(players)) if (p.listed) players[p.id] = { ...p, listed: false }
  return { ...state, players, transfers: { ...state.transfers, offers: [], agreed: {}, blocked: [] } }
}

export function sack(state: GameState, rng: Rng): GameState {
  const offers = makeOffers(state, rng)
  const s = addNews(closeBusiness(state), [{ kind: 'career', key: 'news.career.sacked', params: { clubId: state.userClubId }, important: true }], rng)
  return { ...s, press: null, career: { kind: 'sacked', offers }, rngState: rng.state() }
}

export function takeJob(state: GameState, clubId: string): GameState {
  const rng = createRng(state.rngState)
  const closed = closeBusiness(state)
  const balance = startingBalance(state.clubs[clubId])
  const base: GameState = {
    ...closed,
    userClubId: clubId,
    fans: { mood: 60, log: [] },
    finance: { balance, history: [], transferNet: 0 },
    transfers: { ...closed.transfers, budgets: { ...closed.transfers.budgets, [clubId]: budgetFor(state.clubs[clubId], balance) } },
    career: { kind: 'employed' },
    press: null,
  }
  const withBoard = { ...base, board: expectationFor(base) }
  const s = addNews(withBoard, [{ kind: 'career', key: 'news.career.newJob', params: { clubId }, important: true }], rng)
  return { ...s, rngState: rng.state() }
}
