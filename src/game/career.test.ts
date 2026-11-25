import { makeOffers, sack, takeJob } from './career'
import { newGame } from './generate'
import { createRng } from './rng'
import { playMatchday, preMatch, userFixture, isSeasonOver, endSeason } from './season'
import type { GameState } from './types'

test('offers are 2–3 smaller clubs, never the old club', () => {
  const s = newGame(1, 'klang')
  for (let seed = 0; seed < 20; seed++) {
    const offers = makeOffers(s, createRng(seed))
    expect(offers.length).toBeGreaterThanOrEqual(2)
    expect(offers.length).toBeLessThanOrEqual(3)
    expect(offers).not.toContain('klang')
    for (const id of offers) expect(s.clubs[id].reputation).toBeLessThanOrEqual(s.clubs.klang.reputation - 5)
  }
  const tiny = makeOffers(newGame(1, 'jugra'), createRng(1))
  expect(tiny.length).toBeGreaterThanOrEqual(2)
  expect(tiny).not.toContain('jugra')
})

test('forced sacking during the season', () => {
  let s = newGame(2, 'kapar')
  for (let i = 0; i < 9; i++) s = playMatchday(s)
  s = { ...s, board: { ...s.board, confidence: 5 } }
  s = playMatchday(s)
  expect(s.career.kind).toBe('sacked')
  if (s.career.kind !== 'sacked') return
  expect(s.career.offers.length).toBeGreaterThanOrEqual(2)
  expect(s.inbox.some((n) => n.key === 'news.career.sacked' && n.important)).toBe(true)
  // sacked: playMatchday and preMatch do nothing
  expect(playMatchday(s)).toBe(s)
  expect(preMatch(s)).toBe(s)
})

test('sacking clears a pending press; taking a job mid-season is playable', () => {
  let s = newGame(2, 'kapar')
  for (let i = 0; i < 9; i++) s = playMatchday(s)
  s = { ...s, press: { kind: 'pre', fixtureId: userFixture(s)!.id, questions: [{ key: 'press.q.pre.generic', params: {} }] } }
  s = sack(s, createRng(3))
  expect(s.press).toBeNull()
  if (s.career.kind !== 'sacked') throw new Error('expected sacked')
  const offer = s.career.offers[0]
  s = takeJob(s, offer)
  expect(s.userClubId).toBe(offer)
  expect(s.career.kind).toBe('employed')
  expect(s.finance.balance).toBe(s.clubs[offer].reputation * 20000)
  expect(s.fans.mood).toBe(60)
  const before = s.matchday
  const f = s.fixtures.find((x) => x.round === before && (x.homeId === offer || x.awayId === offer))
  expect(userFixture(s)).toEqual(f)
  s = playMatchday(s)
  expect(s.matchday).toBe(before + 1)
  expect(s.inbox.some((n) => n.key === 'news.career.newJob')).toBe(true)
})

test('three seasons in deep debt: numbers stay finite and the game keeps going', () => {
  let s: GameState = newGame(4, 'jugra')
  s = { ...s, finance: { ...s.finance, balance: -5_000_000 } }
  let guard = 0
  while (s.season < 2030 && guard++ < 200) {
    if (s.career.kind === 'sacked') { s = takeJob(s, s.career.offers[0]); continue }
    s = isSeasonOver(s) ? endSeason(s) : playMatchday(preMatch(s))
    if (s.press) s = { ...s, press: null }
    for (const v of [s.fans.mood, s.board.confidence, s.finance.balance, ...s.finance.history.flatMap((h) => [h.tickets, h.sponsor, h.prize, h.wages])]) expect(Number.isFinite(v)).toBe(true)
    expect(s.inbox.length).toBeLessThanOrEqual(150)
  }
  expect(s.season).toBe(2030)
})

test('final-round results use the in-season sacking rule (season-end verdict comes later)', () => {
  let s = newGame(2, 'kapar')
  while (s.matchday < 18) s = playMatchday({ ...s, board: { ...s.board, confidence: 80 } })
  s = { ...s, board: { ...s.board, confidence: 24 }, fans: { ...s.fans, mood: 60 }, finance: { ...s.finance, balance: 1_000_000 } }
  s = playMatchday(s)
  expect(s.matchday).toBe(19)
  expect(s.career.kind).toBe('employed')
})

test('a job taken after a season-end sacking does not inherit the old season', async () => {
  const { acceptJob } = await import('./season')
  let s = newGame(2, 'kapar')
  while (s.matchday < 19) s = playMatchday({ ...s, board: { ...s.board, confidence: 80 } })
  s = sack({ ...s, press: null }, createRng(9))
  if (s.career.kind !== 'sacked') throw new Error('expected sacked')
  const offer = s.career.offers[0]
  const after = acceptJob(s, offer)
  expect(after.userClubId).toBe(offer)
  expect(after.season).toBe(2028)
  expect(after.matchday).toBe(1)
  expect(after.board.confidence).toBe(60)
  expect(after.fans.mood).toBe(60)
  expect(after.finance.history).toEqual([])
})
