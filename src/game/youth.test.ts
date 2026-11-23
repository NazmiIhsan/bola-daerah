import { newGame, overall, squadQuality } from './generate'
import { AI_SQUAD_MAX, POSITION_MIN, squad, SQUAD_MAX, SQUAD_MIN } from './market'
import { createRng } from './rng'
import { acceptJob, endSeason, isSeasonOver, playMatchday } from './season'
import { aiIntake, generateYouth, youthIntake } from './youth'
import type { GameState, Position } from './types'

const base = newGame(6, 'kapar')

test('youth players are 16–18, homegrown, signed for two more seasons and have room to grow', () => {
  for (let seed = 0; seed < 50; seed++) {
    const p = generateYouth(createRng(seed * 7919), base.clubs.kapar, 'MF', 2027)
    expect(p.age).toBeGreaterThanOrEqual(16)
    expect(p.age).toBeLessThanOrEqual(18)
    expect(p).toMatchObject({ homeClubId: 'kapar', clubId: 'kapar', contractEnd: 2029, position: 'MF' })
    expect(p.potential).toBeGreaterThan(overall(p))
    expect(p.potential).toBeLessThanOrEqual(20)
  }
})

test('an intake is three or four players and fills the thinnest position first', () => {
  const thin = { ...base, players: Object.fromEntries(Object.entries(base.players).filter(([, p]) => !(p.clubId === 'kapar' && p.position === 'GK'))) }
  for (let seed = 0; seed < 20; seed++) {
    const kids = youthIntake(createRng(seed * 7919), thin, 'kapar')
    expect([3, 4]).toContain(kids.length)
    expect(kids[0].position).toBe('GK')
    expect(new Set(kids.map((k) => k.id)).size).toBe(kids.length)
  }
})

test('AI clubs take their intake straight in and stay within the squad limit; the user’s club is untouched', () => {
  const s = aiIntake(base, createRng(3))
  expect(squad(s, 'kapar')).toEqual(squad(base, 'kapar'))
  for (const id of Object.keys(s.clubs)) {
    if (id === 'kapar') continue
    expect(squad(s, id).length).toBeLessThanOrEqual(AI_SQUAD_MAX)
    expect(squad(s, id).some((p) => p.homeClubId === id)).toBe(true)
    for (const pos of Object.keys(POSITION_MIN) as Position[]) expect(squad(s, id).filter((p) => p.position === pos).length).toBeGreaterThanOrEqual(POSITION_MIN[pos])
  }
})

test('a new game and every new season bring the user an intake', () => {
  expect(base.youth.intake.length).toBeGreaterThanOrEqual(3)
  for (const p of base.youth.intake) expect(base.players[p.id]).toBeUndefined()
  let s = base
  while (!isSeasonOver(s)) s = playMatchday({ ...s, board: { ...s.board, confidence: 80 } })
  const n = endSeason(s)
  expect(n.youth.intake.length).toBeGreaterThanOrEqual(3)
  expect(n.youth.intake.map((p) => p.id)).not.toEqual(base.youth.intake.map((p) => p.id))
  expect(n.youth.intake.every((p) => p.homeClubId === 'kapar' && p.contractEnd === n.season + 2)).toBe(true)
})

test('ten seasons: ability stays stable, squads legal, saves bounded', () => {
  for (const seed of [4, 9]) {
    let s: GameState = newGame(seed, 'kapar')
    const level = (st: GameState, ids: string[]) =>
      ids.reduce((sum, id) => sum + squad(st, id).map(overall).sort((a, b) => b - a).slice(0, 11).reduce((a, b) => a + b, 0) / 11, 0) / ids.length
    const d1 = Object.values(s.clubs).filter((c) => c.kind === 'district').map((c) => c.id)
    const d2 = Object.values(s.clubs).filter((c) => c.kind === 'mukim' && c.id !== 'kapar').map((c) => c.id)
    const start = [level(s, d1), level(s, d2)]
    let guard = 0
    while (s.season < 2037 && guard++ < 600) {
      if (s.career.kind === 'sacked') { s = acceptJob(s, s.career.offers[0]); continue }
      if (!isSeasonOver(s)) { s = playMatchday({ ...s, press: null, board: { ...s.board, confidence: 80 } }); continue }
      s = endSeason({ ...s, board: { ...s.board, confidence: 80 } })
      const now = [level(s, d1), level(s, d2)]
      now.forEach((v, i) => expect({ season: s.season, div: i + 1, drift: Math.round((v - start[i]) * 100) / 100, ok: Math.abs(v - start[i]) <= 1.5 }).toMatchObject({ ok: true }))
      for (const id of Object.keys(s.clubs)) {
        const n = squad(s, id).length
        expect({ id, n, ok: n >= SQUAD_MIN && n <= SQUAD_MAX }).toMatchObject({ ok: true })
      }
      expect(Object.keys(s.players).length).toBeLessThanOrEqual(640)
      for (const p of Object.values(s.players)) for (const v of Object.values(p.attrs)) expect(v >= 1 && v <= 20).toBe(true)
    }
    expect(s.season).toBe(2037)
  }
}, 60000)

test('a club’s academy matches its level', () => {
  const mean = (id: string) => { let t = 0; for (let i = 0; i < 60; i++) t += overall(generateYouth(createRng(i * 7919), base.clubs[id], 'MF', 2027)); return t / 60 }
  expect(mean('petaling')).toBeGreaterThan(mean('jugra'))
  expect(mean('petaling')).toBeLessThan(squadQuality(base.clubs.petaling))
})

test('now and then an academy produces a golden generation', () => {
  const mean = (seed: number) => { const k = youthIntake(createRng(seed * 7919), base, 'jugra'); return k.reduce((a, p) => a + p.potential, 0) / k.length }
  const all = Array.from({ length: 300 }, (_, i) => mean(i)).sort((a, b) => a - b)
  const median = all[150]
  const golden = all.filter((v) => v > median + 2).length
  expect(golden).toBeGreaterThan(6)
  expect(golden).toBeLessThan(60)
})
