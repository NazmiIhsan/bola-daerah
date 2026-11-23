import { wageBill, formatRM } from './finance'
import { overall } from './generate'
import { askingPrice, canLeave, maxYears, squad, SQUAD_MAX, transferWindow, wageDemand, willJoin } from './market'
import { addNews, type NewNews } from './news'
import { applyReaction } from './reactions'
import type { Rng } from './rng'
import { dropFromTactics } from './tactics'
import { FREE_AGENT, type GameState, type Player, type TransferRecord } from './types'

export type Refusal =
  | 'sacked' | 'windowClosed' | 'invalidAmount' | 'notForSale' | 'blocked' | 'squadFull' | 'transferBudget'
  | 'wageBudget' | 'wontJoin' | 'noAgreement' | 'tooManyYears' | 'gone' | 'squadTooSmall'
type Refused = { kind: 'refused'; reason: Refusal }
export type BidOutcome = { kind: 'accepted' } | { kind: 'counter'; fee: number } | { kind: 'rejected' } | Refused
export type TermsOutcome = { kind: 'signed' } | { kind: 'counter'; wage: number } | { kind: 'rejected' } | Refused
export interface Act<O> { state: GameState; outcome: O }

const HISTORY_CAP = 60
const COUNTER_BID = 0.75
const COUNTER_WAGE = 0.85

const isMoney = (n: number) => Number.isSafeInteger(n) && n > 0
const refuse = (state: GameState, reason: Refusal): Act<Refused> => ({ state, outcome: { kind: 'refused', reason } })
export const fullName = (p: Player) => `${p.firstName} ${p.lastName}`

const block = (state: GameState, playerId: string): GameState => ({
  ...state,
  transfers: { ...state.transfers, blocked: [...state.transfers.blocked, playerId] },
})

/** Can the user pay this fee right now? */
export function canAfford(state: GameState, fee: number): boolean {
  return fee <= state.transfers.budgets[state.userClubId].transfer && fee <= state.finance.balance
}

/** Move a player between clubs (or the free-agent pool) and settle money, tactics and records. */
export function movePlayer(state: GameState, playerId: string, toId: string, deal: { fee: number; wage: number; contractEnd: number }): GameState {
  const { listed: _listed, ...p } = state.players[playerId]
  const fromId = p.clubId
  const players = { ...state.players, [playerId]: { ...p, clubId: toId, wage: deal.wage, contractEnd: deal.contractEnd } }
  const tactics = { ...state.tactics }
  if (tactics[fromId]) tactics[fromId] = dropFromTactics(tactics[fromId], playerId, Object.values(players).filter((x) => x.clubId === fromId))

  const budgets = { ...state.transfers.budgets }
  if (budgets[fromId]) budgets[fromId] = { ...budgets[fromId], transfer: budgets[fromId].transfer + deal.fee }
  if (budgets[toId]) budgets[toId] = { ...budgets[toId], transfer: budgets[toId].transfer - deal.fee }
  const net = toId === state.userClubId ? -deal.fee : fromId === state.userClubId ? deal.fee : 0

  const { [playerId]: _done, ...agreed } = state.transfers.agreed
  const record: TransferRecord = { season: state.season, matchday: state.matchday, playerId, name: fullName(p), fromId, toId, fee: deal.fee }
  return {
    ...state,
    players,
    tactics,
    finance: { ...state.finance, balance: state.finance.balance + net, transferNet: state.finance.transferNet + net },
    transfers: {
      ...state.transfers,
      budgets,
      agreed,
      offers: state.transfers.offers.filter((o) => o.playerId !== playerId),
      history: [record, ...state.transfers.history].slice(0, HISTORY_CAP),
    },
  }
}

/** Bid for another club's player. Their club answers at once. */
export function placeBid(state: GameState, playerId: string, fee: number): Act<BidOutcome> {
  const p = state.players[playerId]
  if (state.career.kind === 'sacked') return refuse(state, 'sacked')
  if (!p || p.clubId === FREE_AGENT || p.clubId === state.userClubId) return refuse(state, 'gone')
  if (!isMoney(fee)) return refuse(state, 'invalidAmount')
  if (!transferWindow(state.matchday)) return refuse(state, 'windowClosed')
  if (state.transfers.blocked.includes(playerId)) return refuse(state, 'blocked')
  if (squad(state, state.userClubId).length >= SQUAD_MAX) return refuse(state, 'squadFull')
  if (!canLeave(state, playerId)) return refuse(state, 'notForSale')
  if (!willJoin(state, playerId, state.userClubId)) return refuse(state, 'wontJoin')
  if (!canAfford(state, fee)) return refuse(state, 'transferBudget')
  const ask = askingPrice(state, playerId)
  if (fee >= ask) return { state: { ...state, transfers: { ...state.transfers, agreed: { ...state.transfers.agreed, [playerId]: fee } } }, outcome: { kind: 'accepted' } }
  if (fee >= ask * COUNTER_BID) return { state, outcome: { kind: 'counter', fee: ask } }
  return { state: block(state, playerId), outcome: { kind: 'rejected' } }
}

/** The player's reply to a wage, or undefined if they say yes. */
function wageReply(state: GameState, playerId: string, wage: number): Act<TermsOutcome> | undefined {
  const want = wageDemand(state, playerId, state.userClubId)
  if (wage >= want) return undefined
  if (wage >= want * COUNTER_WAGE) return { state, outcome: { kind: 'counter', wage: want } }
  return { state: block(state, playerId), outcome: { kind: 'rejected' } }
}

/** Shared checks on the numbers in a contract offer. */
function badTerms(p: Player, wage: number, years: number): Refusal | undefined {
  if (!isMoney(wage) || !Number.isSafeInteger(years) || years < 1) return 'invalidAmount'
  if (years > maxYears(p)) return 'tooManyYears'
  return undefined
}

/** How excited fans are by a signing: 3 for a star, 1 for someone who gets into the team, else 0. */
function signingBuzz(state: GameState, p: Player): number {
  const t = state.tactics[state.userClubId]
  const xi = t.lineup.map((id) => state.players[id]).filter(Boolean)
  const average = xi.reduce((sum, x) => sum + overall(x), 0) / Math.max(1, xi.length)
  if (overall(p) > average + 0.5) return 3
  const rivals = xi.filter((x) => x.position === p.position)
  return rivals.some((x) => overall(x) < overall(p)) ? 1 : 0
}

/** Offer a contract to a free agent, or to a player whose club has accepted a bid. */
export function offerTerms(state: GameState, playerId: string, wage: number, years: number, rng: Rng): Act<TermsOutcome> {
  const p = state.players[playerId]
  const me = state.userClubId
  if (state.career.kind === 'sacked') return refuse(state, 'sacked')
  if (!p || p.clubId === me) return refuse(state, 'gone')
  const bad = badTerms(p, wage, years)
  if (bad) return refuse(state, bad)
  const isFree = p.clubId === FREE_AGENT
  const fee = isFree ? 0 : state.transfers.agreed[playerId]
  if (fee === undefined) return refuse(state, 'noAgreement')
  if (!isFree && !transferWindow(state.matchday)) return refuse(state, 'windowClosed')
  if (state.transfers.blocked.includes(playerId)) return refuse(state, 'blocked')
  if (squad(state, me).length >= SQUAD_MAX) return refuse(state, 'squadFull')
  if (!canLeave(state, playerId)) return refuse(state, 'notForSale')
  if (fee > 0 && !canAfford(state, fee)) return refuse(state, 'transferBudget')
  if (wageBill(state, me) + wage > state.transfers.budgets[me].wage) return refuse(state, 'wageBudget')
  const reply = wageReply(state, playerId, wage)
  if (reply) return reply

  const buzz = signingBuzz(state, p)
  let s = movePlayer(state, playerId, me, { fee, wage, contractEnd: state.season + years - 1 })
  if (buzz) s = applyReaction(s, { fanDelta: buzz, boardDelta: 0, reasons: [{ key: 'fans.reason.signing', params: { player: fullName(p) } }] })
  const news: NewNews = isFree
    ? { kind: 'transfer', key: 'news.transfer.signedFree', params: { clubId: me, player: fullName(p) } }
    : { kind: 'transfer', key: 'news.transfer.signed', params: { clubId: me, oppId: p.clubId, player: fullName(p), fee: formatRM(fee) } }
  return { state: addNews(s, [news], rng), outcome: { kind: 'signed' } }
}

/** Extend one of the user's own contracts by `years` seasons beyond this one. */
export function renewContract(state: GameState, playerId: string, wage: number, years: number, rng: Rng): Act<TermsOutcome> {
  const p = state.players[playerId]
  const me = state.userClubId
  if (state.career.kind === 'sacked') return refuse(state, 'sacked')
  if (!p || p.clubId !== me) return refuse(state, 'gone')
  const bad = badTerms(p, wage, years)
  if (bad) return refuse(state, bad)
  const contractEnd = state.season + years
  if (contractEnd <= p.contractEnd) return refuse(state, 'invalidAmount')
  if (state.transfers.blocked.includes(playerId)) return refuse(state, 'blocked')
  const bill = wageBill(state, me)
  if (bill - p.wage + wage > Math.max(bill, state.transfers.budgets[me].wage)) return refuse(state, 'wageBudget')
  const reply = wageReply(state, playerId, wage)
  if (reply) return reply
  const s = { ...state, players: { ...state.players, [playerId]: { ...p, wage, contractEnd } } }
  return { state: addNews(s, [{ kind: 'transfer', key: 'news.transfer.renewed', params: { clubId: me, player: fullName(p), season: contractEnd } }], rng), outcome: { kind: 'signed' } }
}
