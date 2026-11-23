import { formatRM } from './finance'
import { initialTransfers, overall } from './generate'
import { AI_SQUAD_MAX, askingPrice, canLeave, improvement, justJoined, playerValue, POSITION_MIN, squad, transferWindow, wageDemand, willJoin } from './market'
import { addNews, type NewNews } from './news'
import type { Rng } from './rng'
import { generateYouth } from './youth'
import { fullName, makeOffer, movePlayer } from './transfers'
import { FREE_AGENT, type GameState, type Player, type Position } from './types'

const AI_BUY_CHANCE = 0.25
const MAX_DEALS = 4
const MAX_DEAL_NEWS = 2
const MAX_OFFERS = 4
const MIN_IMPROVEMENT = 0.5
const EXPIRY_REMINDER = 14

function shuffled<T>(items: T[], rng: Rng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** The position where a club's regulars are weakest. */
function weakestPosition(state: GameState, clubId: string): Position {
  const starters: Record<Position, number> = { GK: 1, DF: 4, MF: 4, FW: 2 }
  const avg = (pos: Position) => {
    const best = squad(state, clubId).filter((p) => p.position === pos).map(overall).sort((a, b) => b - a).slice(0, starters[pos])
    return best.reduce((x, y) => x + y, 0) / starters[pos]
  }
  return (Object.keys(starters) as Position[]).reduce((a, b) => (avg(b) < avg(a) ? b : a))
}

/** One AI club tries to strengthen its weakest position. Never buys from the user. */
function aiSigning(state: GameState, clubId: string, rng: Rng): GameState {
  if (squad(state, clubId).length >= AI_SQUAD_MAX) return state
  const position = weakestPosition(state, clubId)
  const budget = state.transfers.budgets[clubId].transfer
  const targets = Object.values(state.players).filter((p) =>
    p.position === position &&
    p.clubId !== clubId &&
    p.clubId !== state.userClubId &&
    !justJoined(state, p.id) &&
    improvement(state, clubId, p) > MIN_IMPROVEMENT &&
    askingPrice(state, p.id, clubId) <= budget &&
    willJoin(state, p.id, clubId) &&
    canLeave(state, p.id))
  if (targets.length === 0) return state
  const p = rng.pick(targets)
  return movePlayer(state, p.id, clubId, { fee: askingPrice(state, p.id, clubId), wage: wageDemand(state, p.id, clubId), contractEnd: state.season + rng.int(1, 3) })
}

function aiDeals(state: GameState, rng: Rng): GameState {
  let s = state
  let deals = 0
  for (const clubId of shuffled(Object.keys(state.clubs), rng)) {
    if (deals >= MAX_DEALS) break
    if (clubId === state.userClubId || !rng.chance(AI_BUY_CHANCE)) continue
    const next = aiSigning(s, clubId, rng)
    if (next !== s) deals++
    s = next
  }
  return s
}

/** AI bids for the user's players: listed ones first, sometimes a surprise. */
function newOffers(state: GameState, rng: Rng): GameState {
  const mine = squad(state, state.userClubId)
  const wanted = mine.filter((p) => p.listed && rng.chance(0.5))
  if (mine.length && rng.chance(0.45)) wanted.push(rng.pick(mine))
  let offers = state.transfers.offers
  for (const p of wanted) {
    if (offers.length >= MAX_OFFERS) break
    if (offers.some((o) => o.playerId === p.id) || justJoined(state, p.id) || !canLeave(state, p.id)) continue
    const offer = makeOffer(state, p.id, rng)
    if (offer) offers = [...offers, offer]
  }
  return { ...state, transfers: { ...state.transfers, offers } }
}

/** A player the user could realistically sign. */
function rumour(state: GameState, rng: Rng): NewNews[] {
  if (!rng.chance(0.4)) return []
  const me = state.userClubId
  const targets = Object.values(state.players).filter((p) =>
    p.clubId !== me && p.clubId !== FREE_AGENT &&
    playerValue(p, state.season) <= state.transfers.budgets[me].transfer &&
    improvement(state, me, p) > 0 && willJoin(state, p.id, me) && !justJoined(state, p.id) && canLeave(state, p.id))
  if (targets.length === 0) return []
  const p = rng.pick(targets)
  return [{ kind: 'transfer', key: 'news.transfer.rumour', params: { clubId: me, oppId: p.clubId, player: fullName(p) } }]
}

function dealNews(before: GameState, after: GameState): NewNews[] {
  const known = new Set(before.transfers.history)
  return after.transfers.history
    .filter((r) => !known.has(r))
    .sort((a, b) => b.fee - a.fee)
    .slice(0, MAX_DEAL_NEWS)
    .map((r): NewNews => r.fromId === FREE_AGENT
      ? { kind: 'transfer', key: 'news.transfer.dealFree', params: { clubId: r.toId, player: r.name } }
      : { kind: 'transfer', key: 'news.transfer.deal', params: { clubId: r.toId, oppId: r.fromId, player: r.name, fee: formatRM(r.fee) } })
}

function offerNews(before: GameState, after: GameState): NewNews[] {
  const known = new Set(before.transfers.offers.map((o) => o.id))
  return after.transfers.offers.filter((o) => !known.has(o.id)).map((o): NewNews => ({
    kind: 'transfer', key: 'news.transfer.offer', important: true,
    params: { clubId: o.clubId, player: fullName(after.players[o.playerId] as Player), fee: formatRM(o.fee) },
  }))
}

function reminders(state: GameState): NewNews[] {
  const now = transferWindow(state.matchday), was = transferWindow(state.matchday - 1), next = transferWindow(state.matchday + 1)
  const clubId = state.userClubId
  const out: NewNews[] = []
  if (now && !was) out.push({ kind: 'transfer', key: 'news.transfer.windowOpen', params: { clubId } })
  if (now && !next) out.push({ kind: 'transfer', key: 'news.transfer.deadline', params: { clubId }, important: true })
  if (!now && was) out.push({ kind: 'transfer', key: 'news.transfer.closed', params: { clubId } })
  if (state.matchday === EXPIRY_REMINDER) {
    const n = squad(state, clubId).filter((p) => p.contractEnd <= state.season).length
    if (n > 0) out.push({ kind: 'transfer', key: 'news.transfer.expiring', params: { clubId, n }, important: true })
  }
  return out
}

/** The market's week. Call with the new matchday already set. */
export function transferWeek(state: GameState, rng: Rng): GameState {
  const open = transferWindow(state.matchday) !== null
  const start: GameState = {
    ...state,
    transfers: { ...state.transfers, agreed: {}, blocked: [], offers: open ? state.transfers.offers.filter((o) => o.expires >= state.matchday) : [] },
  }
  if (!open && state.career.kind === 'sacked') return start
  if (!open) return addNews(start, reminders(start), rng)
  const traded = aiDeals(start, rng)
  if (state.career.kind === 'sacked') return addNews(traded, dealNews(start, traded), rng)
  const s = newOffers(traded, rng)
  return addNews(s, [...offerNews(start, s), ...reminders(s), ...rumour(s, rng), ...dealNews(start, s)], rng)
}

const AI_RENEW_CHANCE = 0.85
const FREE_AGENT_CAP = 40
const REFILL_SIZE = 20
const REFILL_SHAPE: Record<Position, number> = { GK: 2, DF: 7, MF: 7, FW: 4 }

/**
 * Contracts that end with this season. The user's players leave; AI clubs renew most of theirs.
 * A sacked manager's club is run like an AI club. `left` = players the user has lost.
 */
export function expireContracts(state: GameState, rng: Rng): { state: GameState; left: Player[] } {
  const players: Record<string, Player> = {}
  const left: Player[] = []
  for (const p of Object.values(state.players)) {
    if (p.clubId === FREE_AGENT || p.contractEnd > state.season) { players[p.id] = p; continue }
    const isUsers = state.career.kind === 'employed' && p.clubId === state.userClubId
    if (!isUsers && rng.chance(AI_RENEW_CHANCE)) {
      players[p.id] = { ...p, contractEnd: state.season + rng.int(1, 3) }
      continue
    }
    if (isUsers) left.push(p)
    const { listed: _listed, ...rest } = p
    players[p.id] = { ...rest, clubId: FREE_AGENT }
  }
  return { state: { ...state, players }, left }
}

/** Promote local youngsters until every club has a playable squad. */
export function refillSquads(state: GameState, rng: Rng): GameState {
  const players = { ...state.players }
  for (const club of Object.values(state.clubs)) {
    const mates = squad(state, club.id)
    const count: Record<Position, number> = { GK: 0, DF: 0, MF: 0, FW: 0 }
    for (const p of mates) count[p.position]++
    const positions = Object.keys(REFILL_SHAPE) as Position[]
    let size = mates.length
    const add = (pos: Position) => {
      const youth = generateYouth(rng, club, pos, state.season)
      players[youth.id] = youth
      count[pos]++
      size++
    }
    for (const pos of positions) while (count[pos] < POSITION_MIN[pos]) add(pos)
    for (const pos of positions) while (size < REFILL_SIZE && count[pos] < REFILL_SHAPE[pos]) add(pos)
  }
  return { ...state, players }
}

/** Keep only the best free agents so the pool (and save file) stays small. */
export function trimFreeAgents(state: GameState): GameState {
  const pool = squad(state, FREE_AGENT).sort((a, b) => overall(b) - overall(a) || a.id.localeCompare(b.id))
  if (pool.length <= FREE_AGENT_CAP) return state
  const players = { ...state.players }
  for (const p of pool.slice(FREE_AGENT_CAP)) delete players[p.id]
  return { ...state, players }
}

/** New-season budgets for everyone and a clean slate for negotiations. */
export function resetMarket(state: GameState): GameState {
  return { ...state, transfers: { ...initialTransfers(state.clubs, state.userClubId, state.finance.balance), history: state.transfers.history } }
}

/** News for players the user lost on a free. */
export function departureNews(clubId: string, left: Player[]): NewNews[] {
  return [...left]
    .sort((a, b) => overall(b) - overall(a))
    .slice(0, 3)
    .map((p) => ({ kind: 'transfer', key: 'news.transfer.left', params: { clubId, player: fullName(p) }, important: true }))
}
