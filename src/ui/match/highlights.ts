import type { Rng } from '../../game/rng'
import type { ChanceKind, MatchEvent } from '../../game/match/types'
import type { FormationId } from '../../game/types'
import { slotPositions } from '../components/formationLayout'

/** Pitch coords 0..100 (x = length, y = width). `z` is the ball's height, 0 (grass) .. 1 (high). */
export interface Pt { x: number; y: number; z?: number }
/** Home attacks +x in the first half. */
export interface Frame { t: number; ball: Pt; home: Pt[]; away: Pt[] }

const clamp = (v: number) => Math.max(0, Math.min(100, v))
const cp = (p: Pt): Pt => ({ x: clamp(p.x), y: clamp(p.y) })

/** Formation laid out for a team attacking +x. */
function attackingShape(f: FormationId): Pt[] {
  return slotPositions(f).map((s) => ({ x: 100 - s.y, y: s.x }))
}
/** Formation laid out for a team attacking −x. */
function defendingShape(f: FormationId): Pt[] {
  return slotPositions(f).map((s) => ({ x: s.y, y: 100 - s.x }))
}

/** Move a team up or down the pitch, the keeper only a little, everyone drawn a bit towards the ball's side. */
function shift(team: Pt[], dx: number, towardY?: number, pull = 0): Pt[] {
  return team.map((p, i) => {
    if (i === 0) return cp({ x: p.x + Math.sign(dx) * Math.min(Math.abs(dx), 6), y: p.y })
    const y = towardY === undefined ? p.y : p.y + (towardY - p.y) * pull
    return cp({ x: p.x + dx, y })
  })
}

/** Squeeze a team into an area (set pieces): keeper stays put. */
function crowd(team: Pt[], box: { x0: number; x1: number; y0: number; y1: number }, rng: Rng, keep: number[] = [0]): Pt[] {
  return team.map((p, i) => (keep.includes(i) ? p : cp({ x: box.x0 + rng.next() * (box.x1 - box.x0), y: box.y0 + rng.next() * (box.y1 - box.y0) })))
}

const put = (team: Pt[], i: number | undefined, p: Pt): Pt[] => (i === undefined || i <= 0 || i >= team.length ? team : team.map((q, j) => (j === i ? cp(p) : q)))

/** The outfield player nearest a point (used when we do not know who it was). */
function nearest(team: Pt[], p: Pt): number {
  let best = 1
  team.forEach((q, i) => { if (i > 0 && Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(team[best].x - p.x, team[best].y - p.y)) best = i })
  return best
}

export interface HighlightOptions {
  /** slot of the shooter in the attacking team */
  shooter?: number
  /** slot of the player who set it up */
  assist?: number
  /** play the finish in slow motion (big moments) */
  slow?: boolean
}

type Key = { t: number; ball: Pt; A: Pt[]; D: Pt[] }

/**
 * Keyframes for one highlight (3–6 s). Built for an attack towards +x and mirrored when the
 * attacking side is going the other way. Each kind of chance has its own build-up.
 */
export function buildHighlight(event: MatchEvent, homeFormation: FormationId, awayFormation: FormationId, half: 1 | 2, rng: Rng, opts: HighlightOptions = {}): Frame[] {
  const side = event.side ?? 'home'
  const towardsPlusX = (side === 'home') === (half === 1)
  const attF = side === 'home' ? homeFormation : awayFormation
  const defF = side === 'home' ? awayFormation : homeFormation
  const A0 = attackingShape(attF)
  const D0 = defendingShape(defF)
  const isShot = event.type === 'goal' || event.type === 'save' || event.type === 'miss'
  const kind: ChanceKind | undefined = isShot ? event.kind ?? 'cross' : undefined

  const keys: Key[] = kind ? buildUp(kind, A0, D0, rng, opts) : plainBuildUp(A0, D0, rng)
  const last = keys[keys.length - 1]
  const shotFrom = last.ball
  let A3 = last.A
  let D3 = last.D
  const keeperAt = (p: Pt) => D3.map((q, i) => (i === 0 ? cp(p) : q))
  let end: Pt
  const lofted = kind === 'freekick' || kind === 'long'
  switch (event.type) {
    case 'goal': {
      end = { x: 101, y: kind === 'penalty' ? 46 + rng.int(0, 8) : 45 + rng.int(0, 10), z: lofted ? 0.35 : 0.1 }
      const diveY = end.y < 50 ? end.y + 6 : end.y - 6
      D3 = keeperAt({ x: 96, y: diveY })
      break
    }
    case 'save': {
      const k = { x: 95 + rng.int(0, 2), y: 44 + rng.int(0, 12) }
      D3 = keeperAt(k)
      end = { x: k.x - 1, y: k.y + (rng.chance(0.5) ? 1 : -1) }
      break
    }
    case 'miss':
      end = { x: 101, y: rng.chance(0.5) ? 34 + rng.int(0, 7) : 59 + rng.int(0, 7), z: rng.chance(0.4) ? 0.6 : 0.1 }
      break
    default:
      // foul / card / injury: play stops near the ball
      end = { x: shotFrom.x - 3, y: shotFrom.y }
      A3 = shift(last.A, 0, shotFrom.y, 0.3)
      D3 = shift(last.D, 0, shotFrom.y, 0.3)
  }
  const shotMs = isShot ? Math.max(450, Math.hypot(101 - shotFrom.x, 50 - shotFrom.y) * 32) : 700
  const slow = opts.slow ? 1.7 : 1
  const tShot = last.t + shotMs * slow
  const frames: Key[] = [...keys, { t: tShot, ball: end, A: A3, D: D3 }]
  const A4 = event.type === 'goal' ? A3.map((p, i) => (i === 0 ? p : cp({ x: p.x + (88 - p.x) * 0.4, y: p.y + (shotFrom.y - p.y) * 0.4 }))) : A3
  frames.push({ t: Math.min(6000, Math.max(3000, tShot + 1000)), ball: { x: end.x, y: end.y }, A: A4, D: D3 })

  const mirror = (p: Pt): Pt => ({ ...p, x: 100 - p.x, y: 100 - p.y })
  return frames.map((f) => {
    const m = (p: Pt) => (towardsPlusX ? p : mirror(p))
    const A = f.A.map(m)
    const D = f.D.map(m)
    return { t: f.t, ball: m(f.ball), home: side === 'home' ? A : D, away: side === 'home' ? D : A }
  })
}

/** The old all-purpose move: centre, wing, edge of the box. Used for cards and injuries. */
function plainBuildUp(A0: Pt[], D0: Pt[], rng: Rng): Key[] {
  const wingY = rng.chance(0.5) ? 14 + rng.int(0, 6) : 80 + rng.int(0, 6)
  const shotY = 38 + rng.int(0, 24)
  return [
    { t: 0, ball: { x: 48, y: 30 + rng.int(0, 40) }, A: A0, D: shift(D0, 4) },
    { t: 1000, ball: { x: 66, y: wingY }, A: shift(A0, 8, wingY, 0.15), D: shift(D0, 8, wingY, 0.2) },
    { t: 2000, ball: { x: 83, y: shotY }, A: shift(A0, 14, shotY, 0.25), D: shift(D0, 10, shotY, 0.3) },
  ]
}

function buildUp(kind: ChanceKind, A0: Pt[], D0: Pt[], rng: Rng, o: HighlightOptions): Key[] {
  const left = rng.chance(0.5)
  const wing = left ? 8 + rng.int(0, 6) : 86 + rng.int(0, 6)
  switch (kind) {
    case 'cross': {
      const head = { x: 88 + rng.int(0, 5), y: 40 + rng.int(0, 20) }
      const A1 = shift(A0, 12, wing, 0.1)
      const A2 = shift(A0, 18, head.y, 0.3)
      const assist = o.assist ?? nearest(A1, { x: 70, y: wing })
      return [
        { t: 0, ball: { x: 50, y: 50 }, A: A0, D: shift(D0, 4) },
        { t: 900, ball: { x: 72, y: wing }, A: put(A1, assist, { x: 72, y: wing }), D: shift(D0, 10, wing, 0.15) },
        { t: 1700, ball: { x: 86, y: wing < 50 ? 4 : 96 }, A: put(A1, assist, { x: 86, y: wing < 50 ? 4 : 96 }), D: shift(D0, 14, head.y, 0.3) },
        { t: 2300, ball: { ...midway({ x: 86, y: wing < 50 ? 4 : 96 }, head), z: 1 }, A: put(A2, o.shooter, { x: head.x - 2, y: head.y }), D: shift(D0, 16, head.y, 0.4) },
        { t: 2800, ball: { ...head, z: 0.5 }, A: put(A2, o.shooter, head), D: shift(D0, 16, head.y, 0.45) },
      ]
    }
    case 'through': {
      const run = { x: 84 + rng.int(0, 4), y: 40 + rng.int(0, 20) }
      const passer = { x: 62, y: 45 + rng.int(0, 10) }
      return [
        { t: 0, ball: { x: 45, y: 50 }, A: A0, D: shift(D0, 2) },
        { t: 900, ball: passer, A: put(shift(A0, 10), o.assist, passer), D: shift(D0, 6, passer.y, 0.1) },
        { t: 1700, ball: { x: 78, y: run.y }, A: put(shift(A0, 14), o.shooter, { x: 76, y: run.y }), D: shift(D0, 8, run.y, 0.15) },
        { t: 2500, ball: run, A: put(shift(A0, 16), o.shooter, { x: run.x - 1, y: run.y }), D: shift(D0, 6, run.y, 0.2) },
      ]
    }
    case 'long': {
      const from = { x: 72 + rng.int(0, 4), y: 30 + rng.int(0, 40) }
      return [
        { t: 0, ball: { x: 52, y: 50 }, A: shift(A0, 8), D: shift(D0, 6) },
        { t: 1000, ball: { x: 64, y: from.y + (left ? 10 : -10) }, A: shift(A0, 12, from.y, 0.1), D: shift(D0, 12, from.y, 0.15) },
        { t: 2000, ball: from, A: put(shift(A0, 14, from.y, 0.15), o.shooter, from), D: shift(D0, 14, from.y, 0.2) },
      ]
    }
    case 'counter': {
      // Starts deep in their own half after winning the ball back.
      const shot = { x: 85 + rng.int(0, 4), y: 40 + rng.int(0, 20) }
      const DUp = shift(D0, 28)
      return [
        { t: 0, ball: { x: 26, y: 50 }, A: shift(A0, -14), D: DUp },
        { t: 700, ball: { x: 40, y: wing < 50 ? 25 : 75 }, A: shift(A0, -6), D: shift(D0, 24) },
        { t: 1500, ball: { x: 62, y: wing < 50 ? 30 : 70 }, A: put(shift(A0, 6), o.shooter, { x: 62, y: wing < 50 ? 32 : 68 }), D: shift(D0, 14) },
        { t: 2300, ball: shot, A: put(shift(A0, 14), o.shooter, { x: shot.x - 1, y: shot.y }), D: shift(D0, 6, shot.y, 0.15) },
      ]
    }
    case 'solo': {
      const y0 = 30 + rng.int(0, 40)
      const weave = (x: number, d: number) => ({ x, y: Math.max(20, Math.min(80, y0 + d)) })
      const path = [weave(60, 0), weave(70, 8), weave(78, -6), weave(86, 4)]
      const keys: Key[] = path.map((b, i) => ({
        t: i * 700,
        ball: b,
        A: put(shift(A0, 6 + i * 3, b.y, 0.1), o.shooter, { x: b.x - 1, y: b.y }),
        D: put(shift(D0, 6 + i * 3, b.y, 0.2), nearest(shift(D0, 6 + i * 3), b), { x: b.x + 2, y: b.y + (i % 2 ? 3 : -3) }),
      }))
      return keys
    }
    case 'corner': {
      const flag = { x: 99, y: left ? 1 : 99 }
      const box = { x0: 84, x1: 96, y0: 34, y1: 66 }
      const A1 = put(crowd(shift(A0, 30), box, rng, [0, 1, 2, 3]), o.assist ?? 4, { x: 98, y: left ? 3 : 97 })
      const D1 = crowd(D0, box, rng)
      const head = { x: 90 + rng.int(0, 4), y: 42 + rng.int(0, 16) }
      return [
        { t: 0, ball: flag, A: A1, D: D1 },
        { t: 800, ball: flag, A: A1, D: D1 },
        { t: 1500, ball: { ...midway(flag, head), z: 1 }, A: put(A1, o.shooter, { x: head.x - 2, y: head.y }), D: D1 },
        { t: 2100, ball: { ...head, z: 0.5 }, A: put(A1, o.shooter, head), D: put(D1, nearest(D1, head), { x: head.x + 1.5, y: head.y + 2 }) },
      ]
    }
    case 'freekick': {
      const spot = { x: 72 + rng.int(0, 6), y: 32 + rng.int(0, 36) }
      const toGoal = Math.atan2(50 - spot.y, 100 - spot.x)
      const wallAt = (i: number) => ({ x: spot.x + Math.cos(toGoal) * 9 - Math.sin(toGoal) * (i - 1.5) * 1.6, y: spot.y + Math.sin(toGoal) * 9 + Math.cos(toGoal) * (i - 1.5) * 1.6 })
      const D1 = crowd(D0, { x0: 84, x1: 96, y0: 30, y1: 70 }, rng).map((p, i) => (i >= 1 && i <= 4 ? cp(wallAt(i - 1)) : p))
      const A1 = put(crowd(shift(A0, 26), { x0: 80, x1: 94, y0: 30, y1: 70 }, rng, [0, 1, 2]), o.shooter, { x: spot.x - 2, y: spot.y })
      return [
        { t: 0, ball: spot, A: A1, D: D1 },
        { t: 1100, ball: spot, A: put(A1, o.shooter, { x: spot.x - 0.5, y: spot.y }), D: D1 },
      ]
    }
    case 'penalty': {
      const spot = { x: 89, y: 50 }
      const ring = (team: Pt[]) => team.map((p, i) => (i === 0 ? p : cp({ x: 78 - (i % 3) * 2, y: 25 + ((i * 47) % 50) })))
      const A1 = put(ring(shift(A0, 30)), o.shooter, { x: 85, y: 50 })
      const D1 = ring(D0).map((p, i) => (i === 0 ? { x: 99, y: 50 } : p))
      return [
        { t: 0, ball: spot, A: A1, D: D1 },
        { t: 1200, ball: spot, A: A1, D: D1 },
        { t: 1600, ball: spot, A: put(A1, o.shooter, { x: 88, y: 50 }), D: D1 },
      ]
    }
  }
}

const midway = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/**
 * Where everyone is during ordinary play in a minute without a highlight: the side with the
 * ball pushes up, more so with momentum, and both teams lean towards the ball.
 */
export function ambientFrame(homeFormation: FormationId, awayFormation: FormationId, attacking: 'home' | 'away', momentum: number, half: 1 | 2, rng: Rng): Frame {
  const towardsPlusX = (attacking === 'home') === (half === 1)
  const A0 = attackingShape(attacking === 'home' ? homeFormation : awayFormation)
  const D0 = defendingShape(attacking === 'home' ? awayFormation : homeFormation)
  const lean = attacking === 'home' ? momentum : -momentum
  const ballX = Math.max(25, Math.min(80, 40 + rng.next() * 30 + lean * 12))
  const ballY = 12 + rng.next() * 76
  const dx = (ballX - 50) * 0.6
  const A = shift(A0, dx, ballY, 0.18)
  const D = shift(D0, dx + 2, ballY, 0.22)
  const jitter = (p: Pt, i: number) => (i === 0 ? p : cp({ x: p.x + (rng.next() - 0.5) * 3, y: p.y + (rng.next() - 0.5) * 3 }))
  const m = (p: Pt): Pt => (towardsPlusX ? p : { x: 100 - p.x, y: 100 - p.y })
  const Am = A.map(jitter).map(m)
  const Dm = D.map(jitter).map(m)
  return { t: 0, ball: m({ x: ballX, y: ballY }), home: attacking === 'home' ? Am : Dm, away: attacking === 'home' ? Dm : Am }
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const lerpPt = (a: Pt, b: Pt, k: number): Pt => {
  const p: Pt = { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) }
  if (a.z !== undefined || b.z !== undefined) p.z = lerp(a.z ?? 0, b.z ?? 0, k)
  return p
}

export function interpolate(frames: Frame[], t: number): Frame {
  if (t <= frames[0].t) return frames[0]
  const last = frames[frames.length - 1]
  if (t >= last.t) return last
  let i = 1
  while (frames[i].t < t) i++
  const a = frames[i - 1], b = frames[i]
  const k = (t - a.t) / (b.t - a.t)
  return {
    t,
    ball: lerpPt(a.ball, b.ball, k),
    home: a.home.map((p, j) => lerpPt(p, b.home[j] ?? p, k)),
    away: a.away.map((p, j) => lerpPt(p, b.away[j] ?? p, k)),
  }
}

/** Blend two frames (smooth movement between minutes of ordinary play). */
export const blend = (a: Frame, b: Frame, k: number): Frame => interpolate([{ ...a, t: 0 }, { ...b, t: 1 }], Math.max(0, Math.min(1, k)))
