import { newGame, startingBalance } from './generate'
import { POSITION_MIN, squad, SQUAD_MAX, SQUAD_MIN, transferWindow, wageDemand } from './market'
import { migrate } from './migrate'
import { createRng } from './rng'
import { sack, takeJob } from './career'
import { acceptJob, endSeason, isSeasonOver, matchTactics, playMatchday } from './season'
import { makeV2 } from './testUtils'
import { renewContract } from './transfers'
import { expireContracts, refillSquads } from './transferWeek'
import { FREE_AGENT, type GameState, type Player, type Position } from './types'

const patch = (st: GameState, id: string, p: Partial<Player>): GameState => ({ ...st, players: { ...st.players, [id]: { ...st.players[id], ...p } } })
const all = (s: GameState, p: Partial<Player>): GameState => ({ ...s, players: Object.fromEntries(Object.entries(s.players).map(([id, x]) => [id, x.clubId === FREE_AGENT ? x : { ...x, ...p }])) })
const toEnd = (s: GameState) => { while (!isSeasonOver(s)) s = playMatchday({ ...s, board: { ...s.board, confidence: 80 } }); return s }

test('an expired player leaves for free; a renewed one stays', () => {
  let s = all(newGame(11, 'kapar'), { contractEnd: 2030, age: 25 })
  const [a, b] = squad(s, 'kapar').filter((p) => p.position === 'MF')
  s = patch(patch(s, a.id, { contractEnd: 2027 }), b.id, { contractEnd: 2027 })
  s = toEnd(s)
  const r = renewContract(s, b.id, wageDemand(s, b.id, 'kapar'), 2, createRng(1))
  expect(r.outcome.kind).toBe('signed')
  const n = endSeason(r.state)
  expect(n.players[a.id]?.clubId).not.toBe('kapar')
  expect(n.players[b.id].clubId).toBe('kapar')
  expect(n.inbox.some((x) => x.key === 'news.transfer.left' && x.params.player === `${a.firstName} ${a.lastName}`)).toBe(true)
  expect([...n.tactics.kapar.lineup, ...n.tactics.kapar.subs]).not.toContain(a.id)
})

test('AI clubs renew most of their players', () => {
  const s = all(newGame(11, 'kapar'), { contractEnd: 2027, age: 25 })
  const { state: n, left } = expireContracts(s, createRng(4))
  expect(left).toHaveLength(23)
  const ai = Object.values(s.players).filter((p) => p.clubId !== 'kapar' && p.clubId !== FREE_AGENT)
  const kept = ai.filter((p) => n.players[p.id].clubId === p.clubId)
  expect(kept.length / ai.length).toBeGreaterThan(0.75)
  expect(kept.length / ai.length).toBeLessThan(0.95)
  for (const p of kept) expect(n.players[p.id].contractEnd).toBeGreaterThan(2027)
})

test('a sacked manager’s club renews like any other club', () => {
  const s = all(newGame(11, 'kapar'), { contractEnd: 2027 })
  const { state: n, left } = expireContracts({ ...s, career: { kind: 'sacked', offers: ['jugra'] } }, createRng(4))
  expect(left).toEqual([])
  expect(squad(n, 'kapar').length).toBeGreaterThan(10)
})

test('refillSquads gives an empty club a playable squad with contracts', () => {
  const s = newGame(11, 'kapar')
  const empty = { ...s, players: Object.fromEntries(Object.entries(s.players).filter(([, p]) => p.clubId !== 'kapar')) }
  const n = refillSquads(empty, createRng(1))
  expect(squad(n, 'kapar')).toHaveLength(20)
  for (const pos of Object.keys(POSITION_MIN) as Position[]) expect(squad(n, 'kapar').filter((p) => p.position === pos).length).toBeGreaterThanOrEqual(POSITION_MIN[pos])
  for (const p of squad(n, 'kapar')) expect(p.contractEnd).toBeGreaterThan(2027)
})

test('a migrated v2 save loses nobody to contracts at its first season end', () => {
  const s = toEnd(migrate(makeV2()))
  const before = squad(s, 'kapar').filter((p) => p.age < 35).map((p) => p.id)
  const n = endSeason(s)
  for (const id of before) expect(n.players[id].clubId).toBe('kapar')
})

test('budgets are set afresh and the market is cleared for the new season', () => {
  const s = toEnd(newGame(11, 'kapar'))
  const n = endSeason({ ...s, finance: { ...s.finance, balance: 1_000_000 }, transfers: { ...s.transfers, agreed: { x: 5 } } })
  expect(n.transfers.budgets.kapar.transfer).toBe(Math.round(n.finance.balance * 0.4))
  expect(n.transfers.agreed).toEqual({})
  for (const id of Object.keys(n.clubs)) expect(n.transfers.budgets[id].transfer).toBeGreaterThanOrEqual(0)
  const p = squad(s, 'kapar')[0]
  const stale = { ...s, transfers: { ...s.transfers, offers: [{ id: 'stale', playerId: p.id, clubId: 'klang', fee: 5000, expires: 99 }] } }
  expect(endSeason(stale).transfers.offers.some((o) => o.id === 'stale')).toBe(false)
})

test('sacking clears pending business and a new job starts with its own budget', () => {
  const s = newGame(2, 'klang')
  const p = squad(s, 'klang')[0]
  const busy: GameState = { ...s, transfers: { ...s.transfers, offers: [{ id: 'o', playerId: p.id, clubId: 'sepang', fee: 5000, expires: 3 }], agreed: { x: 1 }, blocked: ['y'] } }
  const out = sack(busy, createRng(1))
  expect(out.transfers).toMatchObject({ offers: [], agreed: {}, blocked: [] })
  const job = takeJob(out, 'jugra')
  expect(job.transfers).toMatchObject({ offers: [], agreed: {}, blocked: [] })
  expect(job.transfers.budgets.jugra.transfer).toBe(Math.round(startingBalance(job.clubs.jugra) * 0.4))
  expect(squad(job, 'jugra').some((x) => x.listed)).toBe(false)
})

test('five seasons of trading: squads, lineups and player counts stay healthy', () => {
  let s: GameState = newGame(4, 'kapar')
  let deals = 0
  let guard = 0
  while (s.season < 2032 && guard++ < 400) {
    if (s.career.kind === 'sacked') { s = acceptJob(s, s.career.offers[0]); continue }
    s = isSeasonOver(s) ? endSeason(s) : playMatchday({ ...s, press: null })
    if (transferWindow(s.matchday)) deals = Math.max(deals, s.transfers.history.length)
    const tactics = matchTactics(s)
    for (const id of Object.keys(s.clubs)) {
      const sq = squad(s, id)
      expect({ id, n: sq.length >= SQUAD_MIN && sq.length <= SQUAD_MAX }).toEqual({ id, n: true })
      for (const pos of Object.keys(POSITION_MIN) as Position[]) {
        expect({ id, pos, ok: sq.filter((p) => p.position === pos).length >= POSITION_MIN[pos] }).toEqual({ id, pos, ok: true })
      }
      expect(new Set(tactics[id].lineup).size).toBe(11)
      for (const x of tactics[id].lineup) expect(s.players[x].clubId).toBe(id)
    }
    expect(Object.keys(s.players).length).toBeLessThanOrEqual(620)
    expect(Object.values(s.players).filter((p) => p.clubId === FREE_AGENT).length).toBeLessThanOrEqual(60)
    for (const b of Object.values(s.transfers.budgets)) expect(Number.isFinite(b.transfer)).toBe(true)
  }
  expect(s.season).toBe(2032)
  expect(deals).toBeGreaterThan(20)
}, 30000)
