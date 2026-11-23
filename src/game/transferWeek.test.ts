import { newGame } from './generate'
import { AI_SQUAD_MAX, POSITION_MIN, squad, SQUAD_MIN } from './market'
import { createRng } from './rng'
import { toggleListed } from './transfers'
import { transferWeek } from './transferWeek'
import type { GameState, Position } from './types'

const at = (matchday: number, seed = 6): GameState => ({ ...newGame(seed, 'petaling'), matchday })
const keys = (s: GameState) => s.inbox.map((n) => n.key)

test('AI clubs trade in a window, never touching the user’s squad or breaking limits', () => {
  let deals = 0
  for (let seed = 0; seed < 20; seed++) {
    let s = at(1, seed)
    const mine = squad(s, 'petaling').map((p) => p.id).sort()
    for (const m of [1, 2, 3]) s = transferWeek({ ...s, matchday: m }, createRng(seed * 10 + m))
    deals += s.transfers.history.length
    expect(s.transfers.history.length).toBeLessThanOrEqual(12)
    expect(squad(s, 'petaling').map((p) => p.id).sort()).toEqual(mine)
    for (const id of Object.keys(s.clubs)) {
      const sq = squad(s, id)
      expect(sq.length).toBeGreaterThanOrEqual(SQUAD_MIN)
      expect(sq.length).toBeLessThanOrEqual(AI_SQUAD_MAX)
      for (const pos of Object.keys(POSITION_MIN) as Position[]) expect(sq.filter((p) => p.position === pos).length).toBeGreaterThanOrEqual(POSITION_MIN[pos])
      expect(s.transfers.budgets[id].transfer).toBeGreaterThanOrEqual(0)
    }
  }
  expect(deals).toBeGreaterThan(20)
})

test('no deals or offers outside the windows', () => {
  for (let seed = 0; seed < 10; seed++) {
    const s = transferWeek(at(6), createRng(seed))
    expect(s.transfers.history).toEqual([])
    expect(s.transfers.offers).toEqual([])
  }
})

test('a listed player attracts an offer', () => {
  const st = at(2)
  const p = squad(st, 'petaling').sort((a, b) => b.potential - a.potential)[0]
  const listed = toggleListed(st, p.id)
  let found = false
  for (let seed = 0; seed < 10 && !found; seed++) {
    const s = transferWeek(listed, createRng(seed))
    const o = s.transfers.offers.find((x) => x.playerId === p.id)
    if (o) { found = true; expect(s.inbox.find((n) => n.key === 'news.transfer.offer')).toMatchObject({ important: true, kind: 'transfer' }) }
  }
  expect(found).toBe(true)
})

test('at most four open offers, one per player', () => {
  let st = at(1)
  for (const p of squad(st, 'petaling')) st = toggleListed(st, p.id)
  for (let seed = 0; seed < 10; seed++) {
    let s = st
    for (const m of [1, 2, 3]) s = transferWeek({ ...s, matchday: m }, createRng(seed + m * 100))
    expect(s.transfers.offers.length).toBeLessThanOrEqual(4)
    expect(new Set(s.transfers.offers.map((o) => o.playerId)).size).toBe(s.transfers.offers.length)
  }
})

test('a new week clears agreed fees and blocked players; expired offers go, and all go when the window shuts', () => {
  const st = at(2)
  const [a, b] = squad(st, 'petaling')
  const offer = (id: string, playerId: string, expires: number) => ({ id, playerId, clubId: 'klang', fee: 5000, expires })
  const busy = { ...st, transfers: { ...st.transfers, agreed: { x: 1 }, blocked: ['x'], offers: [offer('old', a.id, 1), offer('live', b.id, 4)] } }
  const s = transferWeek(busy, createRng(1))
  expect(s.transfers.agreed).toEqual({})
  expect(s.transfers.blocked).toEqual([])
  expect(s.transfers.offers.some((o) => o.id === 'old')).toBe(false)
  expect(s.transfers.offers.some((o) => o.id === 'live')).toBe(true)
  expect(transferWeek({ ...busy, matchday: 4 }, createRng(1)).transfers.offers).toEqual([])
})

test('window and contract reminders arrive on the right matchdays', () => {
  const has = (m: number, key: string) => keys(transferWeek(at(m), createRng(1))).includes(key)
  expect(has(9, 'news.transfer.windowOpen')).toBe(true)
  expect(has(3, 'news.transfer.deadline')).toBe(true)
  expect(has(11, 'news.transfer.deadline')).toBe(true)
  expect(has(4, 'news.transfer.closed')).toBe(true)
  expect(has(12, 'news.transfer.closed')).toBe(true)
  expect(has(14, 'news.transfer.expiring')).toBe(true)
  for (const k of ['windowOpen', 'deadline', 'closed', 'expiring']) expect(has(6, `news.transfer.${k}`)).toBe(false)
  const secure = at(14)
  const players = Object.fromEntries(Object.entries(secure.players).map(([id, p]) => [id, { ...p, contractEnd: 2030 }]))
  expect(keys(transferWeek({ ...secure, players }, createRng(1)))).not.toContain('news.transfer.expiring')
})

test('at most two AI deals and one rumour make the news each week', () => {
  let rumours = 0
  for (let seed = 0; seed < 20; seed++) {
    const k = keys(transferWeek(at(1, seed), createRng(seed * 7919)))
    expect(k.filter((x) => x === 'news.transfer.deal').length).toBeLessThanOrEqual(2)
    rumours += k.filter((x) => x === 'news.transfer.rumour').length
  }
  expect(rumours).toBeGreaterThan(2)
  expect(rumours).toBeLessThanOrEqual(20)
})

test('deterministic for the same seed', () => {
  expect(transferWeek(at(1), createRng(5))).toEqual(transferWeek(at(1), createRng(5)))
})

test('the weekly deal limit still holds once the history is full', () => {
  const old = Array.from({ length: 60 }, (_, i) => ({ season: 2026, matchday: 1, playerId: `x${i}`, name: 'Old Deal', fromId: 'klang', toId: 'sepang', fee: 1000 }))
  let most = 0
  for (let seed = 0; seed < 25; seed++) {
    const st = at(1)
    const s = transferWeek({ ...st, transfers: { ...st.transfers, history: old } }, createRng(seed * 7919))
    expect(s.transfers.history).toHaveLength(60)
    most = Math.max(most, s.transfers.history.filter((r) => r.season === 2027).length)
  }
  expect(most).toBeGreaterThan(0)
  expect(most).toBeLessThanOrEqual(4)
})
