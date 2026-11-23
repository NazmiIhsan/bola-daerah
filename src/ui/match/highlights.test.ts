import { buildHighlight, interpolate, type Frame } from './highlights'
import { createRng } from '../../game/rng'
import type { MatchEvent } from '../../game/match/types'

const ev = (type: MatchEvent['type'], side: 'home' | 'away' = 'home'): MatchEvent => ({ minute: 30, side, type, playerId: 'p', highlight: true })
const inside = (f: Frame) => [...f.home, ...f.away].every((p) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100)

test('goal highlight ends with the ball inside the attacked goal', () => {
  for (let s = 0; s < 30; s++) {
    const h1 = buildHighlight(ev('goal'), '4-4-2', '4-3-3', 1, createRng(s)).at(-1)!
    expect(h1.ball.x).toBeGreaterThanOrEqual(100)
    expect(h1.ball.y).toBeGreaterThanOrEqual(44)
    expect(h1.ball.y).toBeLessThanOrEqual(56)
    const h2 = buildHighlight(ev('goal'), '4-4-2', '4-3-3', 2, createRng(s)).at(-1)!
    expect(h2.ball.x).toBeLessThanOrEqual(0)
    const away1 = buildHighlight(ev('goal', 'away'), '4-4-2', '4-3-3', 1, createRng(s)).at(-1)!
    expect(away1.ball.x).toBeLessThanOrEqual(0)
  }
})

test('save highlight ends with the ball near the keeper, not in the goal', () => {
  for (let s = 0; s < 30; s++) {
    const last = buildHighlight(ev('save'), '4-4-2', '4-4-2', 1, createRng(s)).at(-1)!
    expect(last.ball.x).toBeLessThan(100)
    const keeper = last.away[0]
    expect(Math.hypot(last.ball.x - keeper.x, last.ball.y - keeper.y)).toBeLessThan(4)
  }
})

test('miss highlight ends outside the goal mouth', () => {
  for (let s = 0; s < 30; s++) {
    const last = buildHighlight(ev('miss'), '4-4-2', '4-4-2', 1, createRng(s)).at(-1)!
    expect(last.ball.y < 44 || last.ball.y > 56).toBe(true)
  }
})

test('frames are time-ordered, last 3–6 s, and players stay within 0..100', () => {
  for (const type of ['goal', 'save', 'miss', 'red', 'chance'] as const) {
    const frames = buildHighlight(ev(type), '3-5-2', '5-3-2', 1, createRng(7))
    for (let i = 1; i < frames.length; i++) expect(frames[i].t).toBeGreaterThan(frames[i - 1].t)
    expect(frames.at(-1)!.t).toBeGreaterThanOrEqual(3000)
    expect(frames.at(-1)!.t).toBeLessThanOrEqual(6000)
    expect(frames.every(inside)).toBe(true)
    expect(frames[0].home).toHaveLength(11)
    expect(frames[0].away).toHaveLength(11)
  }
})

test('interpolate at midpoint returns positions between keyframes', () => {
  const frames: Frame[] = [
    { t: 0, ball: { x: 0, y: 0 }, home: [{ x: 10, y: 10 }], away: [{ x: 90, y: 90 }] },
    { t: 1000, ball: { x: 100, y: 50 }, home: [{ x: 30, y: 10 }], away: [{ x: 70, y: 50 }] },
  ]
  const mid = interpolate(frames, 500)
  expect(mid.ball).toEqual({ x: 50, y: 25 })
  expect(mid.home[0]).toEqual({ x: 20, y: 10 })
  expect(mid.away[0]).toEqual({ x: 80, y: 70 })
  expect(interpolate(frames, -5).ball).toEqual({ x: 0, y: 0 })
  expect(interpolate(frames, 99999).ball).toEqual({ x: 100, y: 50 })
})
