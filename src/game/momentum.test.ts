import { newGame, overall } from './generate'
import { CLUBS } from './data/clubs'
import { squad } from './market'
import { simulateFull } from './match/sim'
import { migrate } from './migrate'
import { moveReputations, rollForm, underdogNews } from './momentum'
import { createRng } from './rng'
import { acceptJob, endSeason, isSeasonOver, matchOptions, playMatchday, seasonSummary, userFixture } from './season'
import { makeV3 } from './testUtils'
import type { GameState } from './types'

const base = newGame(6, 'kapar')
/** Finish the season with clubs scoring according to their place in `order` (first = best). */
function finish(s: GameState, order: string[]): GameState {
  const g = (id: string) => (order.includes(id) ? 20 - order.indexOf(id) : 1)
  return { ...s, matchday: 19, fixtures: s.fixtures.map((f) => ({ ...f, result: { home: g(f.homeId), away: g(f.awayId) } })) }
}

test('form: everyone but the user varies within limits, with a dark horse from each lower half', () => {
  for (let seed = 0; seed < 30; seed++) {
    const form = rollForm(base, createRng(seed * 7919))
    expect(form.kapar).toBe(1)
    for (const v of Object.values(form)) { expect(v).toBeGreaterThanOrEqual(0.84); expect(v).toBeLessThanOrEqual(1.2) }
    for (const d of base.divisions) {
      const ranked = [...d.clubIds].sort((a, b) => base.clubs[b].reputation - base.clubs[a].reputation)
      const low = ranked.slice(Math.floor(ranked.length / 2)).filter((id) => id !== 'kapar')
      expect(Math.max(...low.map((id) => form[id]))).toBeGreaterThanOrEqual(1.12)
    }
  }
})

test('new games, migrated saves and new seasons have form; it changes each season', () => {
  expect(Object.keys(base.form)).toHaveLength(CLUBS.length)
  expect(Object.keys(migrate(makeV3()).form)).toHaveLength(CLUBS.length)
  const n = endSeason(finish(base, ['petaling']))
  expect(n.form).not.toEqual(base.form)
})

test('better form wins more matches', () => {
  const opts = (f: number) => ({ sharpness: { home: { attack: f, defence: f } } })
  const wins = (f: number) => {
    let w = 0
    for (let i = 0; i < 400; i++) { const m = simulateFull('sepang', 'gombak', base.tactics, base.players, i * 7919, opts(f)); if (m.score.home > m.score.away) w++ }
    return w
  }
  expect(wins(1.12)).toBeGreaterThan(wins(0.88) + 30)
})

test('match options carry the opponent’s form and leave the user’s club at 1', () => {
  const f = userFixture(base)!
  const home = f.homeId === 'kapar'
  const o = matchOptions(base, f)
  expect(o.sharpness![home ? 'home' : 'away']).toEqual({ attack: 1, defence: 1 })
  const rival = base.form[home ? f.awayId : f.homeId]
  expect(o.sharpness![home ? 'away' : 'home']).toEqual({ attack: rival, defence: rival })
})

test('reputations rise for overachievers, fall for flops, and stay in range', () => {
  const ended = finish(base, ['sabak-bernam', 'jugra', 'ijok'])
  const clubs = moveReputations(ended)
  expect(clubs['sabak-bernam'].reputation).toBeGreaterThan(base.clubs['sabak-bernam'].reputation + 3)
  expect(clubs.jugra.reputation).toBeGreaterThan(base.clubs.jugra.reputation + 3)
  const bottom = seasonSummary(ended).relegated
  for (const id of bottom) expect(clubs[id].reputation).toBeLessThan(base.clubs[id].reputation + 1)
  let s = ended
  for (let i = 0; i < 60; i++) s = { ...s, clubs: moveReputations(s) }
  for (const c of Object.values(s.clubs)) { expect(c.reputation).toBeGreaterThanOrEqual(20); expect(c.reputation).toBeLessThanOrEqual(90); expect(Number.isInteger(c.reputation)).toBe(true) }
})

test('a champion nobody expected makes the news; a favourite does not', () => {
  expect(underdogNews(finish(base, ['sabak-bernam'])).map((n) => n.params.clubId)).toContain('sabak-bernam')
  expect(underdogNews(finish(base, ['petaling', 'damansara', 'kajang'])).map((n) => n.params.clubId)).not.toContain('petaling')
})

test('titles and promotions are shared around, but big clubs still win most', () => {
  const champs: Record<string, number> = {}
  const promoted = new Set<string>()
  let seasons = 0
  for (const seed of [1, 2, 3, 4]) {
    let s: GameState = newGame(seed, 'jugra')
    while (s.season < 2037) {
      if (s.career.kind === 'sacked') { s = acceptJob(s, s.career.offers[0]); continue }
      const happy = { ...s, press: null, board: { ...s.board, confidence: 80 } }
      if (!isSeasonOver(s)) { s = playMatchday(happy); continue }
      const q = seasonSummary(s)
      seasons++
      champs[q.champions[0]] = (champs[q.champions[0]] ?? 0) + 1
      q.promoted.forEach((id) => promoted.add(id))
      s = endSeason(happy)
    }
  }
  expect(seasons).toBe(40)
  expect(Object.keys(champs).length).toBeGreaterThanOrEqual(5)
  expect(Math.max(...Object.values(champs))).toBeLessThanOrEqual(20)
  expect(promoted.size).toBeGreaterThanOrEqual(9)
  const big = ['petaling', 'klang', 'hulu-langat'].reduce((n, id) => n + (champs[id] ?? 0), 0)
  expect(big).toBeGreaterThanOrEqual(14)
}, 60000)

test('squads follow reputation only gently: nobody collapses in one season', () => {
  const avg = (s: GameState, id: string) => squad(s, id).map(overall).sort((a, b) => b - a).slice(0, 11).reduce((a, b) => a + b, 0) / 11
  const n = endSeason(finish(base, ['sabak-bernam']))
  expect(Math.abs(avg(n, 'petaling') - avg(base, 'petaling'))).toBeLessThan(2.5)
})
