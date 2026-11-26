import { ambientFrame, buildHighlight, interpolate, type Frame } from './highlights'
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

describe('each kind of chance', () => {
  const kinds = ['cross', 'through', 'long', 'counter', 'solo', 'corner', 'freekick', 'penalty'] as const
  const shot = (type: 'goal' | 'save' | 'miss', kind: (typeof kinds)[number], side: 'home' | 'away' = 'home'): MatchEvent => ({ minute: 30, side, type, playerId: 'p', highlight: true, kind })

  test('runs 3–6 s in time order, keeps everyone on the pitch and still ends in the right place', () => {
    for (const kind of kinds) for (const type of ['goal', 'save', 'miss'] as const) for (const slow of [false, true]) for (let s = 0; s < 8; s++) {
      const frames = buildHighlight(shot(type, kind), '4-3-3', '4-4-2', 1, createRng(s), { shooter: 9, assist: 5, slow })
      for (let i = 1; i < frames.length; i++) expect(frames[i].t).toBeGreaterThan(frames[i - 1].t)
      expect(frames.at(-1)!.t).toBeGreaterThanOrEqual(3000)
      expect(frames.at(-1)!.t).toBeLessThanOrEqual(6000)
      expect(frames.every(inside)).toBe(true)
      const last = frames.at(-1)!
      if (type === 'goal') expect(last.ball.x).toBeGreaterThanOrEqual(100)
      if (type === 'miss') expect(last.ball.y < 44 || last.ball.y > 56).toBe(true)
    }
  })

  test('set pieces start where they should', () => {
    const start = (kind: (typeof kinds)[number]) => buildHighlight(shot('goal', kind), '4-4-2', '4-4-2', 1, createRng(3))[0].ball
    expect(start('penalty')).toEqual({ x: 89, y: 50 })
    const corner = start('corner')
    expect(corner.x).toBe(99)
    expect([1, 99]).toContain(corner.y)
    expect(start('freekick').x).toBeGreaterThanOrEqual(72)
    expect(start('counter').x).toBeLessThan(40)
  })

  test('crosses and corners go through the air', () => {
    for (const kind of ['cross', 'corner'] as const) {
      const frames = buildHighlight(shot('goal', kind), '4-4-2', '4-4-2', 1, createRng(2))
      expect(Math.max(...frames.map((f) => f.ball.z ?? 0))).toBe(1)
    }
  })

  test('the shooter is the one at the ball when the shot is taken', () => {
    const frames = buildHighlight(shot('goal', 'through'), '4-4-2', '4-4-2', 1, createRng(4), { shooter: 9 })
    const before = frames.at(-3)!
    expect(Math.hypot(before.home[9].x - before.ball.x, before.home[9].y - before.ball.y)).toBeLessThan(3)
  })

  test('slow motion stretches the finish', () => {
    const t = (slow: boolean) => buildHighlight(shot('goal', 'long'), '4-4-2', '4-4-2', 1, createRng(5), { slow }).at(-2)!.t
    expect(t(true)).toBeGreaterThan(t(false))
  })
})

test('ordinary play: the side on the ball is further up the pitch, and more so with momentum', () => {
  const avg = (pts: { x: number }[]) => pts.reduce((s, p) => s + p.x, 0) / pts.length
  let calm = 0, pushing = 0
  for (let s = 0; s < 40; s++) {
    const f = ambientFrame('4-4-2', '4-4-2', 'home', 0, 1, createRng(s))
    expect(inside(f)).toBe(true)
    calm += avg(f.home.slice(1))
    pushing += avg(ambientFrame('4-4-2', '4-4-2', 'home', 1, 1, createRng(s)).home.slice(1))
    const second = ambientFrame('4-4-2', '4-4-2', 'home', 0, 2, createRng(s))
    expect(second.ball.x).toBeLessThanOrEqual(75)
  }
  expect(pushing).toBeGreaterThan(calm)
})
