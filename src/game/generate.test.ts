import { newGame, overall } from './generate'
import type { GameState, Player } from './types'

const g: GameState = newGame(7, 'kapar')
const squad = (s: GameState, clubId: string): Player[] =>
  Object.values(s.players).filter((p) => p.clubId === clubId)

test('newGame creates 19 clubs, 9 in div 1 and 10 in div 2', () => {
  expect(Object.keys(g.clubs)).toHaveLength(19)
  expect(g.divisions[0].clubIds).toHaveLength(9)
  expect(g.divisions[1].clubIds).toHaveLength(10)
  expect(g.divisions[0].clubIds).toContain('petaling')
  expect(g.divisions[1].clubIds).toContain('kapar')
  expect(g.userClubId).toBe('kapar')
  expect(g.season).toBe(2027)
  expect(g.matchday).toBe(1)
})

test('every club has 22–25 players with at least 2 GK, 6 DF, 6 MF, 3 FW', () => {
  for (const id of Object.keys(g.clubs)) {
    const s = squad(g, id)
    expect(s.length).toBeGreaterThanOrEqual(22)
    expect(s.length).toBeLessThanOrEqual(25)
    const count = (pos: string) => s.filter((p) => p.position === pos).length
    expect(count('GK')).toBeGreaterThanOrEqual(2)
    expect(count('DF')).toBeGreaterThanOrEqual(6)
    expect(count('MF')).toBeGreaterThanOrEqual(6)
    expect(count('FW')).toBeGreaterThanOrEqual(3)
  }
})

test('stronger reputation means stronger squad', () => {
  const top16 = (id: string) => {
    const o = squad(g, id).map(overall).sort((a, b) => b - a).slice(0, 16)
    return o.reduce((a, b) => a + b, 0) / o.length
  }
  expect(top16('petaling')).toBeGreaterThan(top16('jugra'))
})

test('newGame is deterministic', () => {
  expect(newGame(7, 'kapar')).toEqual(newGame(7, 'kapar'))
})

test('attributes are within 1..20 and ages within 16..36', () => {
  for (const p of Object.values(g.players)) {
    for (const v of Object.values(p.attrs)) {
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(20)
    }
    expect(p.age).toBeGreaterThanOrEqual(16)
    expect(p.age).toBeLessThanOrEqual(36)
  }
})

test('every club has valid tactics', () => {
  for (const id of Object.keys(g.clubs)) {
    const t = g.tactics[id]
    expect(new Set(t.lineup).size).toBe(11)
    for (const pid of t.lineup) expect(g.players[pid].clubId).toBe(id)
    expect(g.players[t.lineup[0]].position).toBe('GK')
  }
})

test('newGame builds the season fixtures', () => {
  expect(g.fixtures).toHaveLength(162)
})

test('every player has a wage, bigger clubs pay more', () => {
  const avg = (id: string) => {
    const s = Object.values(g.players).filter((p) => p.clubId === id)
    return s.reduce((a, p) => a + p.wage, 0) / s.length
  }
  expect(Object.values(g.players).every((p) => p.wage > 0)).toBe(true)
  expect(avg('petaling')).toBeGreaterThan(avg('jugra'))
})

test('newGame initialises fans, board, finance, inbox and career', () => {
  expect(g.version).toBe(5)
  expect(g.fans).toEqual({ mood: 60, log: [] })
  expect(g.career).toEqual({ kind: 'employed' })
  expect(g.inbox).toEqual([])
  expect(g.press).toBeNull()
  expect(g.finance).toEqual({ balance: g.clubs.kapar.reputation * 20000, history: [], transferNet: 0 })
  expect(g.board.confidence).toBe(60)
})

describe('contracts, budgets and free agents', async () => {
  const { budgetFor, wageBudgetFor } = await import('./generate')
  const { wageBill } = await import('./finance')
  const { FREE_AGENT } = await import('./types')
  test('version 5 with contracts and 24 free agents', () => {
    const s = newGame(8, 'kapar')
    expect(s.version).toBe(5)
    const all = Object.values(s.players)
    const free = all.filter((p) => p.clubId === FREE_AGENT)
    expect(free).toHaveLength(24)
    for (const p of all) if (p.clubId !== FREE_AGENT) {
      expect(p.contractEnd).toBeGreaterThanOrEqual(2027)
      expect(p.contractEnd).toBeLessThanOrEqual(2030)
    }
    expect(s.finance.transferNet).toBe(0)
    expect(s.transfers.offers).toEqual([])
  })
  test('wage budgets leave some headroom at every club; bigger clubs have more to spend', () => {
    for (const seed of [1, 2, 3]) {
      const s = newGame(seed, 'petaling')
      for (const id of Object.keys(s.clubs)) {
        const r = s.transfers.budgets[id].wage / wageBill(s, id)
        expect({ id, ok: r >= 1.02 && r <= 1.7, r }).toMatchObject({ ok: true })
      }
      expect(s.transfers.budgets.petaling.transfer).toBeGreaterThan(s.transfers.budgets.jugra.transfer)
    }
    expect(budgetFor({ reputation: 50 }, -1000).transfer).toBe(0)
    expect(budgetFor({ reputation: 50 }, 1000).transfer).toBe(400)
    expect(wageBudgetFor({ reputation: 80 })).toBeGreaterThan(wageBudgetFor({ reputation: 30 }))
  })
})
