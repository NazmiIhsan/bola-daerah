import { newGame, overall } from './generate'
import { wageBill } from './finance'
import { askingPrice, squad, SQUAD_MAX, wageDemand, willJoin } from './market'
import { createRng } from './rng'
import { offerTerms, placeBid, renewContract } from './transfers'
import { FREE_AGENT, type GameState, type Player } from './types'

const rng = () => createRng(1)
const base = newGame(6, 'petaling')
const ranked = (st: GameState, club: string) => squad(st, club).sort((a, b) => overall(b) - overall(a))
const patch = (st: GameState, id: string, p: Partial<Player>): GameState => ({ ...st, players: { ...st.players, [id]: { ...st.players[id], ...p } } })
/** Plenty of money, so budgets are not what is being tested. */
const rich: GameState = {
  ...base,
  finance: { ...base.finance, balance: 50_000_000 },
  transfers: { ...base.transfers, budgets: { ...base.transfers.budgets, petaling: { transfer: 20_000_000, wage: 1_000_000 } } },
}
const target = ranked(rich, 'sepang')[8]
const ask = askingPrice(rich, target.id)
const free = Object.values(base.players).filter((p) => p.clubId === FREE_AGENT)

describe('bids', () => {
  test('meeting the asking price is accepted and recorded', () => {
    const r = placeBid(rich, target.id, ask)
    expect(r.outcome).toEqual({ kind: 'accepted' })
    expect(r.state.transfers.agreed[target.id]).toBe(ask)
  })
  test('a near bid is countered at the asking price', () => {
    expect(placeBid(rich, target.id, Math.ceil(ask * 0.8)).outcome).toEqual({ kind: 'counter', fee: ask })
  })
  test('a low bid is rejected and talks stop until the next matchday', () => {
    const r = placeBid(rich, target.id, Math.floor(ask * 0.5))
    expect(r.outcome).toEqual({ kind: 'rejected' })
    expect(placeBid(r.state, target.id, ask).outcome).toEqual({ kind: 'refused', reason: 'blocked' })
  })
  test.each([NaN, 0, -5, 1.5, Infinity])('a bid of %s is refused with no change', (fee) => {
    const r = placeBid(rich, target.id, fee)
    expect(r.outcome).toEqual({ kind: 'refused', reason: 'invalidAmount' })
    expect(r.state).toBe(rich)
  })
  test('refusals carry a reason and change nothing', () => {
    const cases: Array<[GameState, string, number, string]> = [
      [rich, target.id, 20_000_001, 'transferBudget'],
      [{ ...rich, finance: { ...rich.finance, balance: 10 } }, target.id, ask, 'transferBudget'],
      [{ ...rich, matchday: 5 }, target.id, ask, 'windowClosed'],
      [{ ...rich, career: { kind: 'sacked', offers: [] } }, target.id, ask, 'sacked'],
      [rich, 'ghost', ask, 'gone'],
      [rich, ranked(rich, 'petaling')[0].id, ask, 'gone'],
      [rich, free[0].id, ask, 'gone'],
    ]
    for (const [st, id, fee, reason] of cases) {
      const r = placeBid(st, id, fee)
      expect(r.outcome).toEqual({ kind: 'refused', reason })
      expect(r.state).toBe(st)
    }
  })
  test('a player who will not join, and a club that cannot spare him', () => {
    const star = ranked(rich, 'petaling')[0]
    const jugra = { ...rich, userClubId: 'jugra', transfers: { ...rich.transfers, budgets: { ...rich.transfers.budgets, jugra: { transfer: 20_000_000, wage: 1_000_000 } } } }
    expect(willJoin(jugra, star.id, 'jugra')).toBe(false)
    expect(placeBid(jugra, star.id, askingPrice(jugra, star.id)).outcome).toEqual({ kind: 'refused', reason: 'wontJoin' })
    const gks = squad(rich, 'sepang').filter((p) => p.position === 'GK')
    const thin = patch(rich, gks[0].id, { clubId: FREE_AGENT })
    expect(placeBid(thin, gks[1].id, 5_000_000).outcome).toEqual({ kind: 'refused', reason: 'notForSale' })
  })
  test('a full squad cannot bid', () => {
    let full = rich
    for (const p of free.slice(0, SQUAD_MAX - squad(rich, 'petaling').length)) full = patch(full, p.id, { clubId: 'petaling' })
    expect(placeBid(full, target.id, ask).outcome).toEqual({ kind: 'refused', reason: 'squadFull' })
  })
})

describe('personal terms', () => {
  const agreed = placeBid(rich, target.id, ask).state
  const want = wageDemand(agreed, target.id, 'petaling')
  test('signing moves the player, the money and the records', () => {
    const r = offerTerms(agreed, target.id, want, 3, rng())
    expect(r.outcome).toEqual({ kind: 'signed' })
    const p = r.state.players[target.id]
    expect(p).toMatchObject({ clubId: 'petaling', wage: want, contractEnd: 2029 })
    expect(r.state.finance.balance).toBe(agreed.finance.balance - ask)
    expect(r.state.finance.transferNet).toBe(-ask)
    expect(r.state.transfers.budgets.petaling.transfer).toBe(agreed.transfers.budgets.petaling.transfer - ask)
    expect(r.state.transfers.budgets.sepang.transfer).toBe(agreed.transfers.budgets.sepang.transfer + ask)
    expect(r.state.transfers.history[0]).toMatchObject({ playerId: target.id, fromId: 'sepang', toId: 'petaling', fee: ask, season: 2027 })
    expect(r.state.transfers.agreed[target.id]).toBeUndefined()
    const t = r.state.tactics.sepang
    expect([...t.lineup, ...t.subs]).not.toContain(target.id)
  })
  test('a near offer is countered, a low one ends talks', () => {
    expect(offerTerms(agreed, target.id, Math.ceil(want * 0.9), 3, rng()).outcome).toEqual({ kind: 'counter', wage: want })
    const low = offerTerms(agreed, target.id, Math.floor(want * 0.5), 3, rng())
    expect(low.outcome).toEqual({ kind: 'rejected' })
    expect(offerTerms(low.state, target.id, want, 3, rng()).outcome).toEqual({ kind: 'refused', reason: 'blocked' })
  })
  test.each([
    [NaN, 3, 'invalidAmount'], [-10, 3, 'invalidAmount'], [0, 3, 'invalidAmount'], [99.5, 3, 'invalidAmount'], [2_000_000, 3, 'wageBudget'],
    [5000, 0, 'invalidAmount'], [5000, 1.5, 'invalidAmount'], [5000, 9, 'tooManyYears'],
  ])('wage %s for %s years is refused: %s', (wage, years, reason) => {
    const r = offerTerms(agreed, target.id, wage, years, rng())
    expect(r.outcome).toEqual({ kind: 'refused', reason })
    expect(r.state).toBe(agreed)
  })
  test('no terms without an agreed fee', () => {
    expect(offerTerms(rich, target.id, want, 3, rng()).outcome).toEqual({ kind: 'refused', reason: 'noAgreement' })
  })
  test('an agreed fee that is no longer affordable is refused', () => {
    const broke = { ...agreed, transfers: { ...agreed.transfers, budgets: { ...agreed.transfers.budgets, petaling: { transfer: 1, wage: 1_000_000 } } } }
    expect(offerTerms(broke, target.id, want, 3, rng()).outcome).toEqual({ kind: 'refused', reason: 'transferBudget' })
  })
  test('free agents sign outside the windows, with no fee', () => {
    const st = { ...rich, matchday: 6 }
    const r = offerTerms(st, free[0].id, wageDemand(st, free[0].id, 'petaling'), 1, rng())
    expect(r.outcome).toEqual({ kind: 'signed' })
    expect(r.state.finance.balance).toBe(st.finance.balance)
    expect(r.state.players[free[0].id]).toMatchObject({ clubId: 'petaling', contractEnd: 2027 })
  })
  test('fans react to a star signing', () => {
    const ace = ranked(rich, 'klang')[0]
    const st = patch(rich, ace.id, { attrs: Object.fromEntries(Object.keys(ace.attrs).map((k) => [k, 19])) as Player['attrs'] })
    const bid = placeBid(st, ace.id, askingPrice(st, ace.id)).state
    const r = offerTerms(bid, ace.id, wageDemand(bid, ace.id, 'petaling'), 2, rng())
    expect(r.state.fans.mood).toBe(st.fans.mood + 3)
    expect(r.state.fans.log[0].reason).toBe('fans.reason.signing')
  })
})

describe('renewals', () => {
  const own = ranked(base, 'petaling')[2]
  const base2 = patch(base, own.id, { age: 25, contractEnd: 2027 })
  test('meeting the demand extends the contract, in or out of a window', () => {
    const st = { ...base2, matchday: 15 }
    const r = renewContract(st, own.id, wageDemand(st, own.id, 'petaling'), 3, rng())
    expect(r.outcome).toEqual({ kind: 'signed' })
    expect(r.state.players[own.id].contractEnd).toBe(2027 + 3)
    expect(r.state.players[own.id].clubId).toBe('petaling')
  })
  test('never shortens a contract', () => {
    const st = patch(base2, own.id, { contractEnd: 2030 })
    const r = renewContract(st, own.id, wageDemand(st, own.id, 'petaling'), 1, rng())
    expect(r.outcome).toEqual({ kind: 'refused', reason: 'invalidAmount' })
    expect(r.state).toBe(st)
  })
  test('an unchanged wage is fine even when the wage budget is spent', () => {
    const st = { ...base2, transfers: { ...base.transfers, budgets: { ...base.transfers.budgets, petaling: { transfer: 0, wage: 1 } } } }
    const same = patch(st, own.id, { wage: wageDemand(st, own.id, 'petaling'), morale: 80 })
    expect(renewContract(same, own.id, same.players[own.id].wage, 4, rng()).outcome).toEqual({ kind: 'signed' })
    expect(renewContract(same, own.id, same.players[own.id].wage + wageBill(same, 'petaling'), 4, rng()).outcome).toEqual({ kind: 'refused', reason: 'wageBudget' })
  })
  test('only the user’s own players', () => {
    expect(renewContract(base, target.id, 5000, 2, rng()).outcome).toEqual({ kind: 'refused', reason: 'gone' })
  })
})

test('no signings once the season is over', () => {
  const st = { ...rich, matchday: 19 }
  const r = offerTerms(st, free[0].id, 50_000, 1, rng())
  expect(r.outcome).toEqual({ kind: 'refused', reason: 'seasonOver' })
  expect(r.state).toBe(st)
})

test('a club will not sell a player it signed this season', () => {
  const st: GameState = { ...rich, transfers: { ...rich.transfers, history: [{ season: 2027, matchday: 1, playerId: target.id, name: 'x', fromId: 'klang', toId: 'sepang', fee: 1 }] } }
  expect(placeBid(st, target.id, ask).outcome).toEqual({ kind: 'refused', reason: 'justJoined' })
  expect(placeBid({ ...st, season: 2028 }, target.id, 19_000_000).outcome).toEqual({ kind: 'accepted' })
})
