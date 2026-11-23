import type { Rng } from '../../game/rng'
import type { MatchEvent } from '../../game/match/types'
import type { FormationId } from '../../game/types'
import { slotPositions } from '../components/formationLayout'

export interface Pt { x: number; y: number }
/** Pitch coords 0..100 (x = length, y = width). Home attacks +x in the first half. */
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

function shift(team: Pt[], dx: number, towardY?: number, pull = 0): Pt[] {
  return team.map((p, i) => {
    if (i === 0) return cp({ x: p.x + Math.sign(dx) * Math.min(Math.abs(dx), 6), y: p.y })
    const y = towardY === undefined ? p.y : p.y + (towardY - p.y) * pull
    return cp({ x: p.x + dx, y })
  })
}

/**
 * Keyframes for one highlight (about 3.8 s). Built for an attack towards +x
 * and mirrored when the attacking side is going the other way.
 */
export function buildHighlight(event: MatchEvent, homeFormation: FormationId, awayFormation: FormationId, half: 1 | 2, rng: Rng): Frame[] {
  const side = event.side ?? 'home'
  const towardsPlusX = (side === 'home') === (half === 1)
  const attF = side === 'home' ? homeFormation : awayFormation
  const defF = side === 'home' ? awayFormation : homeFormation

  const A0 = attackingShape(attF)
  const D0 = defendingShape(defF)
  const wingY = rng.chance(0.5) ? 14 + rng.int(0, 6) : 80 + rng.int(0, 6)
  const shotY = 38 + rng.int(0, 24)
  const startY = 30 + rng.int(0, 40)

  const frames: Array<{ t: number; ball: Pt; A: Pt[]; D: Pt[] }> = []
  frames.push({ t: 0, ball: { x: 48, y: startY }, A: A0, D: shift(D0, 4) })
  frames.push({ t: 1000, ball: { x: 66, y: wingY }, A: shift(A0, 8, wingY, 0.15), D: shift(D0, 8, wingY, 0.2) })
  const A2 = shift(A0, 14, shotY, 0.25)
  const D2 = shift(D0, 10, shotY, 0.3)
  frames.push({ t: 2000, ball: { x: 83, y: shotY }, A: A2, D: D2 })

  const keeperAt = (p: Pt) => D2.map((q, i) => (i === 0 ? cp(p) : q))
  let end: Pt
  let D3 = D2
  let A3 = A2
  switch (event.type) {
    case 'goal': {
      end = { x: 101, y: 45 + rng.int(0, 10) }
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
      end = { x: 101, y: rng.chance(0.5) ? 34 + rng.int(0, 7) : 59 + rng.int(0, 7) }
      break
    default:
      // foul / card / injury / chance: play stops near the ball
      end = { x: 80, y: shotY }
      A3 = shift(A2, 0, shotY, 0.3)
      D3 = shift(D2, 0, shotY, 0.3)
  }
  frames.push({ t: 2700, ball: end, A: A3, D: D3 })
  const A4 = event.type === 'goal' ? A3.map((p, i) => (i === 0 ? p : cp({ x: p.x + (88 - p.x) * 0.4, y: p.y + (shotY - p.y) * 0.4 }))) : A3
  frames.push({ t: 3800, ball: end, A: A4, D: D3 })

  const mirror = (p: Pt): Pt => ({ x: 100 - p.x, y: 100 - p.y })
  return frames.map((f) => {
    const m = (p: Pt) => (towardsPlusX ? p : mirror(p))
    const A = f.A.map(m)
    const D = f.D.map(m)
    return { t: f.t, ball: m(f.ball), home: side === 'home' ? A : D, away: side === 'home' ? D : A }
  })
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const lerpPt = (a: Pt, b: Pt, k: number): Pt => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) })

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
