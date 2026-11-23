import { newGame, overall } from './generate'
import { playerValue, squad } from './market'
import { createRng } from './rng'
import { playMatchday } from './season'
import { makeOffer, respondToOffer, toggleListed } from './transfers'
import { FREE_AGENT, type GameState, type IncomingOffer, type Player } from './types'

const base = newGame(6, 'petaling')
const ranked = (st: GameState, club = 'petaling') => squad(st, club).sort((a, b) => overall(b) - overall(a))
const patch = (st: GameState, id: string, p: Partial<Player>): GameState => ({ ...st, players: { ...st.players, [id]: { ...st.players[id], ...p } } })
const withOffer = (st: GameState, playerId: string, o: Partial<IncomingOffer> = {}): GameState => ({
  ...st,
  transfers: { ...st.transfers, offers: [{ id: 'o1', playerId, clubId: 'sepang', fee: 100_000, expires: 3, ...o }], budgets: { ...st.transfers.budgets, sepang: { transfer: 900_000, wage: 100_000 } } },
})
const rng = (n = 1) => createRng(n)
const fringe = ranked(base)[18]

test('accepting an offer sells the player and banks the fee', () => {
  const st = withOffer(base, fringe.id)
  const r = respondToOffer(st, 'o1', 'accept', rng())
  expect(r.outcome).toEqual({ kind: 'sold' })
  expect(r.state.players[fringe.id].clubId).toBe('sepang')
  expect(r.state.finance.balance).toBe(st.finance.balance + 100_000)
  expect(r.state.finance.transferNet).toBe(100_000)
  expect(r.state.transfers.budgets.petaling.transfer).toBe(st.transfers.budgets.petaling.transfer + 100_000)
  expect(r.state.transfers.budgets.sepang.transfer).toBe(800_000)
  expect(r.state.transfers.offers).toEqual([])
  expect(r.state.fans.mood).toBe(st.fans.mood)
  expect(r.state.inbox[0].key).toBe('news.transfer.sold')
})

test('rejecting removes the offer and keeps the player', () => {
  const r = respondToOffer(withOffer(base, fringe.id), 'o1', 'reject', rng())
  expect(r.outcome).toEqual({ kind: 'declined' })
  expect(r.state.transfers.offers).toEqual([])
  expect(r.state.players[fringe.id].clubId).toBe('petaling')
})

test('selling a starter leaves a full lineup of own players, and the next match plays', () => {
  for (const id of base.tactics.petaling.lineup.slice(1, 4)) {
    const s = respondToOffer(withOffer(base, id), 'o1', 'accept', rng()).state
    const { lineup } = s.tactics.petaling
    expect(new Set(lineup).size).toBe(11)
    for (const x of lineup) expect(s.players[x].clubId).toBe('petaling')
    expect(playMatchday(s).matchday).toBe(2)
  }
})

test('a sale that would leave the squad too small is refused', () => {
  const gks = squad(base, 'petaling').filter((p) => p.position === 'GK')
  const thin = patch(base, gks[2].id, { clubId: FREE_AGENT })
  const st = withOffer(thin, gks[0].id)
  const r = respondToOffer(st, 'o1', 'accept', rng())
  expect(r.outcome).toEqual({ kind: 'refused', reason: 'squadTooSmall' })
  expect(r.state).toBe(st)
})

test('fans react to who is sold and to whom', () => {
  const mood = (id: string, clubId: string) => respondToOffer(withOffer(base, id, { clubId }), 'o1', 'accept', rng()).state.fans.mood - base.fans.mood
  const order = ranked(base)
  const inXI = order[8].id
  expect(mood(order[0].id, 'sepang')).toBe(-6)
  expect(mood(order[0].id, 'damansara')).toBe(-10)
  expect(mood(inXI, 'sepang')).toBe(-3)
  expect(mood(order[18].id, 'sepang')).toBe(0)
})

test('negotiating either raises the fee once or scares the buyer off', () => {
  const kinds = new Set<string>()
  for (let seed = 0; seed < 20; seed++) {
    const r = respondToOffer(withOffer(base, fringe.id), 'o1', 'negotiate', rng(seed))
    kinds.add(r.outcome.kind)
    if (r.outcome.kind === 'raised') {
      expect(r.outcome.fee).toBe(115_000)
      expect(r.state.transfers.offers[0].fee).toBe(115_000)
      const again = respondToOffer(r.state, 'o1', 'negotiate', rng(seed))
      expect(again.outcome).toEqual({ kind: 'withdrawn' })
      expect(again.state.transfers.offers).toEqual([])
    } else expect(r.state.transfers.offers).toEqual([])
  }
  expect([...kinds].sort()).toEqual(['raised', 'withdrawn'])
})

test('a raise never exceeds the buyer’s budget', () => {
  for (let seed = 0; seed < 10; seed++) {
    const st = withOffer(base, fringe.id)
    const tight = { ...st, transfers: { ...st.transfers, budgets: { ...st.transfers.budgets, sepang: { transfer: 105_000, wage: 1 } } } }
    const r = respondToOffer(tight, 'o1', 'negotiate', rng(seed))
    if (r.outcome.kind === 'raised') expect(r.outcome.fee).toBe(105_000)
  }
})

test('stale, expired and sacked responses do nothing', () => {
  const st = withOffer(base, fringe.id)
  const refused = (s: GameState, id: string, reason: string) => {
    const r = respondToOffer(s, id, 'accept', rng())
    expect(r.outcome).toEqual({ kind: 'refused', reason })
    expect(r.state).toBe(s)
  }
  refused(st, 'nope', 'gone')
  refused({ ...st, matchday: 4 }, 'o1', 'gone')
  refused(patch(st, fringe.id, { clubId: 'klang' }), 'o1', 'gone')
  refused({ ...st, career: { kind: 'sacked', offers: [] } }, 'o1', 'sacked')
})

test('toggleListed works only on own players, and not while sacked', () => {
  const on = toggleListed(base, fringe.id)
  expect(on.players[fringe.id].listed).toBe(true)
  expect(toggleListed(on, fringe.id).players[fringe.id].listed).toBe(false)
  expect(toggleListed(base, ranked(base, 'klang')[0].id)).toBe(base)
  const sacked: GameState = { ...base, career: { kind: 'sacked', offers: [] } }
  expect(toggleListed(sacked, fringe.id)).toBe(sacked)
})

test('makeOffer comes from an AI club that can pay, at a sensible fee', () => {
  let made = 0
  for (let seed = 0; seed < 60; seed++) {
    const p = squad(base, 'petaling')[seed % 23]
    const o = makeOffer(base, p.id, rng(seed))
    if (!o) continue
    made++
    expect(o.clubId).not.toBe('petaling')
    expect(o.fee).toBeLessThanOrEqual(base.transfers.budgets[o.clubId].transfer)
    expect(o.fee / playerValue(p, 2027)).toBeLessThanOrEqual(1.21)
    expect(Number.isInteger(o.fee) && o.fee > 0).toBe(true)
    expect(o.expires).toBe(base.matchday + 2)
  }
  expect(made).toBeGreaterThan(5)
})

test('a free agent cannot be signed and flipped for profit in the same season', async () => {
  const { offerTerms } = await import('./transfers')
  const { transferWeek } = await import('./transferWeek')
  const free = Object.values(base.players).find((p) => p.clubId === FREE_AGENT)!
  const rich = { ...base, transfers: { ...base.transfers, budgets: { ...base.transfers.budgets, petaling: { transfer: 0, wage: 1_000_000 } } } }
  const signed = offerTerms(rich, free.id, 50_000, 3, rng())
  expect(signed.outcome.kind).toBe('signed')
  const listed = toggleListed(signed.state, free.id)
  for (let seed = 0; seed < 30; seed++) {
    expect(transferWeek({ ...listed, matchday: 2 }, rng(seed * 7919)).transfers.offers.some((o) => o.playerId === free.id)).toBe(false)
  }
  const r = respondToOffer(withOffer(listed, free.id), 'o1', 'accept', rng())
  expect(r.outcome).toEqual({ kind: 'refused', reason: 'justJoined' })
})
