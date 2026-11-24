import { aiFocus, aiListings, aiRenews, aiTactics, isAiRun, managerOf } from './manager'
import { newGame, overall } from './generate'
import { squad } from './market'
import { createRng } from './rng'
import { developWeek } from './development'
import { endSeason, isSeasonOver, matchOptions, matchTactics, playMatchday, userFixture } from './season'
import { expireContracts, transferWeek } from './transferWeek'
import { takeJob } from './career'
import { wageBill } from './finance'
import { FORMATIONS, isAvailable } from './tactics'
import { FREE_AGENT, type GameState, type Player } from './types'

const base = newGame(6, 'kapar')
const ais = Object.keys(base.clubs).filter((id) => id !== 'kapar')
const edit = (s: GameState, f: (p: Player) => Partial<Player> | null): GameState => ({ ...s, players: Object.fromEntries(Object.values(s.players).map((p) => [p.id, { ...p, ...(f(p) ?? {}) }])) })

describe('who is in charge', () => {
  test('every club but the user’s is AI-run, and a sacked manager’s club too', () => {
    expect(ais.every((id) => isAiRun(base, id))).toBe(true)
    expect(isAiRun(base, 'kapar')).toBe(false)
    expect(isAiRun({ ...base, career: { kind: 'sacked', offers: [] } }, 'kapar')).toBe(true)
  })

  test('managers are steady for a save, vary between clubs and between saves', () => {
    expect(managerOf(base, 'klang')).toEqual(managerOf(base, 'klang'))
    expect(new Set(ais.map((id) => JSON.stringify(managerOf(base, id)))).size).toBe(ais.length)
    expect(managerOf(base, 'klang')).not.toEqual(managerOf(newGame(7, 'kapar'), 'klang'))
    for (const id of ais) { const m = managerOf(base, id); for (const v of [m.attack, m.bold, m.youth]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) } }
  })
})

describe('tactics', () => {
  test('AI clubs use different formations and styles, always with a legal team', () => {
    const t = matchTactics(base)
    expect(new Set(ais.map((id) => t[id].formation)).size).toBeGreaterThanOrEqual(3)
    expect(new Set(ais.map((id) => t[id].style)).size).toBeGreaterThanOrEqual(3)
    for (const id of ais) {
      expect(t[id].lineup).toHaveLength(11)
      expect(new Set([...t[id].lineup, ...t[id].subs]).size).toBe(t[id].lineup.length + t[id].subs.length)
      expect(FORMATIONS[t[id].formation]).toBeDefined()
      for (const p of t[id].lineup) { expect(base.players[p].clubId).toBe(id); expect(isAvailable(base.players[p])).toBe(true) }
    }
  })

  test('the user’s formation and style are never touched', () => {
    const s: GameState = { ...base, tactics: { ...base.tactics, kapar: { ...base.tactics.kapar, formation: '5-3-2', style: 'counter' } } }
    const n = playMatchday(s)
    expect(n.tactics.kapar).toMatchObject({ formation: '5-3-2', style: 'counter' })
  })

  test('the same week always gives the same plan', () => expect(matchTactics(base)).toEqual(matchTactics(base)))

  test('clubs pick formations that suit their players', () => {
    const strikers = (fw: number, rest: number) => {
      const s = edit(base, (p) => ({ fitness: 100, morale: 70, attrs: Object.fromEntries(Object.keys(p.attrs).map((k) => [k, p.position === 'FW' ? fw : rest])) as Player['attrs'] }))
      return ais.reduce((n, id) => n + FORMATIONS[aiTactics(s, id).formation].FW, 0)
    }
    expect(strikers(18, 12)).toBeGreaterThan(strikers(8, 14) + 3)
  })

  test('big favourites go for it more than big underdogs', () => {
    const boost = (id: string, by: number) => edit(base, (p) => p.clubId === id ? { attrs: Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, Math.max(1, Math.min(20, v + by))])) as Player['attrs'] } : null)
    const f = base.fixtures.find((x) => x.round === 1 && x.homeId !== 'kapar' && x.awayId !== 'kapar')!
    const risk = { defensive: 0, counter: 1, balanced: 2, attacking: 3 }
    const strong = risk[aiTactics(boost(f.homeId, 5), f.homeId).style], weak = risk[aiTactics(boost(f.homeId, -5), f.homeId).style]
    expect(strong).toBeGreaterThan(weak)
  })
})

describe('training', () => {
  test('tired squads work on fitness and others vary by manager', () => {
    expect(aiFocus(edit(base, () => ({ fitness: 40 })), 'klang')).toBe('fitness')
    expect(new Set(ais.map((id) => aiFocus(base, id))).size).toBeGreaterThanOrEqual(3)
  })

  test('AI training counts in matches, recovery and growth', () => {
    const f = userFixture(base)!
    const rival = f.homeId === 'kapar' ? f.awayId : f.homeId
    const side = f.homeId === 'kapar' ? 'away' : 'home'
    const edge = matchOptions(base, f).sharpness![side]!
    const focus = aiFocus(base, rival)
    expect(edge.attack / base.form[rival]).toBeCloseTo(focus === 'attack' ? 1.02 : 1)
    expect(edge.defence / base.form[rival]).toBeCloseTo(focus === 'defence' ? 1.02 : 1)
    const tired = edit(base, () => ({ fitness: 10 }))
    const bench = squad(tired, 'klang').find((p) => !matchTactics(tired).klang.lineup.includes(p.id) && !matchTactics(tired).klang.subs.includes(p.id))!
    expect(playMatchday(tired).players[bench.id].fitness).toBe(35)
    expect(() => developWeek(base, base, createRng(1))).not.toThrow()
  })
})

describe('contracts and transfers', () => {
  test('key players are kept far more often than fading reserves', () => {
    const ranked = squad(base, 'klang').sort((a, b) => overall(b) - overall(a))
    const star = { ...ranked[0], age: 25 }, old = { ...ranked[ranked.length - 1], age: 34 }
    const s = { ...base, players: { ...base.players, [star.id]: star, [old.id]: old } }
    const rate = (p: Player) => { let n = 0; for (let i = 0; i < 400; i++) if (aiRenews(s, p, createRng(i * 7919))) n++; return n / 400 }
    expect(rate(star)).toBeGreaterThan(0.82)
    expect(rate(old)).toBeLessThan(0.4)
  })

  test('renewed players are paid what they are worth and nobody signs for the past', () => {
    const s = edit(base, (p) => (p.clubId === FREE_AGENT ? null : { contractEnd: base.season }))
    const { state } = expireContracts(s, createRng(3))
    const kept = Object.values(state.players).filter((p) => p.clubId !== FREE_AGENT && base.players[p.id].clubId === p.clubId)
    expect(kept.length).toBeGreaterThan(200)
    for (const p of kept) { expect(p.contractEnd).toBeGreaterThan(base.season); expect(Number.isInteger(p.wage)).toBe(true) }
  })

  test('clubs list a few players they can spare, never their best, and never the user’s', () => {
    const s = aiListings(base)
    const listed = Object.values(s.players).filter((p) => p.listed)
    expect(listed.length).toBeGreaterThan(0)
    expect(listed.some((p) => p.clubId === 'kapar' || p.clubId === FREE_AGENT)).toBe(false)
    for (const id of ais) {
      const mine = listed.filter((p) => p.clubId === id)
      expect(mine.length).toBeLessThanOrEqual(3)
      const top = squad(s, id).sort((a, b) => overall(b) - overall(a)).slice(0, 11).map((p) => p.id)
      expect(mine.some((p) => top.includes(p.id))).toBe(false)
    }
  })

  test('the user’s own transfer list is left alone', () => {
    const mine = squad(base, 'kapar')[0]
    const s = { ...base, players: { ...base.players, [mine.id]: { ...mine, listed: true } } }
    expect(aiListings(s).players[mine.id].listed).toBe(true)
    expect(aiListings(base).players[mine.id].listed).toBeFalsy()
  })

  test('youth-minded managers sign younger players than the others', () => {
    const ages: Record<'young' | 'old', number[]> = { young: [], old: [] }
    for (let seed = 1; seed <= 6; seed++) {
      const g = newGame(seed, 'kapar')
      for (let i = 0; i < 8; i++) {
        const n = transferWeek({ ...g, matchday: 2 }, createRng(i * 7919 + seed))
        for (const r of n.transfers.history) {
          if (r.toId === 'kapar') continue
          const taste = managerOf(g, r.toId).youth
          if (taste > 0.6) ages.young.push(n.players[r.playerId].age)
          if (taste < 0.4) ages.old.push(n.players[r.playerId].age)
        }
      }
    }
    const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length
    expect(Math.min(ages.young.length, ages.old.length)).toBeGreaterThan(20)
    expect(mean(ages.old) - mean(ages.young)).toBeGreaterThan(3)
  })

  test('AI signings respect the wage budget', () => {
    const s: GameState = { ...base, transfers: { ...base.transfers, budgets: Object.fromEntries(Object.entries(base.transfers.budgets).map(([id, b]) => [id, { ...b, wage: 0 }])) } }
    let n = s
    for (let i = 0; i < 6; i++) n = transferWeek({ ...n, matchday: 2 }, createRng(i))
    expect(n.transfers.history.filter((r) => r.toId !== 'kapar')).toHaveLength(0)
    expect(wageBill(s, 'klang')).toBeGreaterThan(0)
  })

  test('taking over a club ends its AI transfer list', () => {
    expect(squad(takeJob({ ...aiListings(base), career: { kind: 'sacked', offers: ['klang'] } }, 'klang'), 'klang').some((p) => p.listed)).toBe(false)
  })
})

test('three AI-run seasons stay healthy', () => {
  let s = newGame(12, 'jugra')
  for (let y = 0; y < 3; y++) {
    while (!isSeasonOver(s)) s = playMatchday({ ...s, press: null, career: { kind: 'employed' }, board: { ...s.board, confidence: 80 } })
    s = { ...endSeason(s), career: { kind: 'employed' } }
    for (const id of Object.keys(s.clubs)) if (id !== 'jugra') {
      const n = squad(s, id).length
      expect(n).toBeGreaterThanOrEqual(17)
      expect(n).toBeLessThanOrEqual(28)
      expect(s.tactics[id].lineup).toHaveLength(11)
    }
  }
}, 60000)
