import { newGame, overall } from './generate'
import { askingPrice, canLeave, isKeyPlayer, maxYears, playerValue, squad, transferWindow, wageDemand, willJoin } from './market'
import { FREE_AGENT, type GameState, type Player } from './types'

const s = newGame(6, 'petaling')
const best = (st: GameState, club: string) => squad(st, club).sort((a, b) => overall(b) - overall(a))
const patch = (st: GameState, id: string, p: Partial<Player>): GameState => ({ ...st, players: { ...st.players, [id]: { ...st.players[id], ...p } } })
const freeAgent = Object.values(s.players).find((p) => p.clubId === FREE_AGENT)!

test('windows are open on exactly matchdays 1–3 and 9–11', () => {
  const open = Array.from({ length: 19 }, (_, i) => i + 1).filter((m) => transferWindow(m))
  expect(open).toEqual([1, 2, 3, 9, 10, 11])
  expect(transferWindow(2)).toBe('pre')
  expect(transferWindow(10)).toBe('mid')
})

describe('playerValue', () => {
  const p: Player = { ...best(s, 'klang')[0], age: 25, contractEnd: 2029, potential: 14 }
  const v = (o: Partial<Player>) => playerValue({ ...p, ...o }, 2027)
  test('rises with potential and ability', () => {
    expect(v({ potential: 18 })).toBeGreaterThan(v({}))
    const lower = Object.fromEntries(Object.entries(p.attrs).map(([k, n]) => [k, n - 3])) as Player['attrs']
    expect(v({ attrs: lower })).toBeLessThan(v({}))
  })
  test('falls with age and an expiring contract', () => {
    expect(v({ age: 20 })).toBeGreaterThan(v({ age: 25 }))
    expect(v({ age: 33 })).toBeLessThan(v({ age: 25 }))
    expect(v({ contractEnd: 2028 })).toBeLessThan(v({}))
    expect(v({ contractEnd: 2027 })).toBeLessThan(v({ contractEnd: 2028 }))
  })
  test('is a whole number of thousands, at least RM 1,000', () => {
    for (const q of Object.values(s.players)) {
      const value = playerValue(q, 2027)
      expect(value % 1000).toBe(0)
      expect(value).toBeGreaterThanOrEqual(1000)
    }
  })
})

test('key players are the best five at their club', () => {
  const ranked = best(s, 'klang')
  expect(isKeyPlayer(s, ranked[0])).toBe(true)
  expect(isKeyPlayer(s, ranked[10])).toBe(false)
  expect(isKeyPlayer(s, freeAgent)).toBe(false)
})

test('asking price: key players cost more, listed less, rivals pay more', () => {
  const star = best(s, 'sepang')[0], fringe = best(s, 'sepang')[15]
  const ratio = (st: GameState, id: string) => askingPrice(st, id) / playerValue(st.players[id], st.season)
  expect(ratio(s, star.id)).toBeGreaterThan(1.3)
  expect(ratio(s, fringe.id)).toBeLessThan(1.3)
  expect(askingPrice(patch(s, fringe.id, { listed: true }), fringe.id)).toBeLessThan(askingPrice(s, fringe.id))
  const k = best(s, 'klang')[0] // Petaling–Klang is a derby
  expect(askingPrice(s, k.id)).toBeGreaterThan(askingPrice({ ...s, userClubId: 'gombak' }, k.id))
  expect(askingPrice(s, star.id)).toBe(askingPrice(s, star.id))
})

test('canLeave protects goalkeepers and squad size', () => {
  const gks = squad(s, 'klang').filter((p) => p.position === 'GK')
  expect(canLeave(s, gks[0].id)).toBe(true)
  const twoGks = patch(s, gks[2].id, { clubId: FREE_AGENT })
  expect(canLeave(twoGks, gks[0].id)).toBe(false)
  let small = s
  for (const p of squad(s, 'klang').filter((x) => x.position === 'MF').slice(0, 3)) small = patch(small, p.id, { clubId: FREE_AGENT })
  expect(canLeave(small, squad(small, 'klang').find((x) => x.position === 'MF')!.id)).toBe(false)
  expect(canLeave(s, freeAgent.id)).toBe(true)
})

test('players refuse much smaller clubs', () => {
  expect(willJoin(s, best(s, 'petaling')[0].id, 'jugra')).toBe(false)
  expect(willJoin(s, best(s, 'jugra')[0].id, 'petaling')).toBe(true)
  expect(willJoin(s, freeAgent.id, 'jugra')).toBe(true)
})

test('wage demands', () => {
  const p = best(s, 'klang')[0]
  expect(wageDemand(s, p.id, 'petaling')).toBeGreaterThanOrEqual(p.wage * 1.05)
  expect(wageDemand(s, p.id, 'hulu-selangor') / p.wage).toBeGreaterThan(1.2) // an 18-point drop
  const own = best(s, 'petaling')[0]
  const happy = wageDemand(patch(s, own.id, { morale: 80 }), own.id, 'petaling')
  const unhappy = wageDemand(patch(s, own.id, { morale: 10 }), own.id, 'petaling')
  expect(happy).toBeGreaterThanOrEqual(own.wage)
  expect(unhappy).toBeGreaterThan(happy)
  expect(wageDemand(s, freeAgent.id, 'jugra') % 10).toBe(0)
})

test('older players sign shorter deals', () => {
  expect(maxYears({ ...freeAgent, age: 25 })).toBe(4)
  expect(maxYears({ ...freeAgent, age: 33 })).toBe(2)
})
