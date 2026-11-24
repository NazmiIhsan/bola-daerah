import { useEffect, useRef } from 'react'
import { interpolate, type Frame } from './highlights'

export interface Highlight { frames: Frame[]; key: number }

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function similar(a: string, b: string) {
  const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b)
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) < 120
}

const GRASS = '#2f7d3b'
type Kit = [string, string]

/** Picks kit colours so the two teams never look the same, or vanish into the grass. */
export function teamColors(home: Kit, away: Kit): { home: Kit; away: Kit } {
  const pick = ([main, second]: Kit, avoid: string[]): Kit => {
    const options: Kit[] = [[main, second], [second, main], ['#ffffff', main], ['#111111', main]]
    return options.find(([c]) => !avoid.some((x) => similar(c, x))) ?? [main, second]
  }
  const h = pick(home, [GRASS])
  return { home: h, away: pick(away, [GRASS, h[0]]) }
}

/** Keepers wear the second colour, unless that would hide them. */
export const keeperColor = ([main, second]: Kit) => [second, '#e04fb0', '#ffffff'].find((c) => !similar(c, GRASS) && !similar(c, main)) ?? second

export type Names = { home: string[]; away: string[] }

/** Who to draw: an empty name is an empty slot (sent off, or injured with no subs left). */
export function drawnPlayers(team: Frame['home'], names: string[]) {
  return team.map((p, i) => ({ ...p, name: names[i] ?? '', keeper: i === 0 })).filter((p) => p.name !== '')
}

/** Names need room: below this pitch width (CSS px) they would overlap. */
const NAMES_FROM = 560

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame, home: [string, string], away: [string, string], names: Names) {
  const X = (x: number) => (x / 100) * w
  const Y = (y: number) => (y / 100) * h
  ctx.fillStyle = GRASS
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 10; i += 2) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect((i * w) / 10, 0, w / 10, h) }
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = Math.max(1, w / 400)
  ctx.strokeRect(X(1), Y(1), X(98), Y(98))
  ctx.beginPath(); ctx.moveTo(X(50), Y(1)); ctx.lineTo(X(50), Y(99)); ctx.stroke()
  ctx.beginPath(); ctx.arc(X(50), Y(50), h * 0.14, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeRect(X(1), Y(22), X(15), Y(56)); ctx.strokeRect(X(84), Y(22), X(15), Y(56))
  ctx.strokeRect(X(1), Y(38), X(5), Y(24)); ctx.strokeRect(X(94), Y(38), X(5), Y(24))
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillRect(X(0), Y(44), X(1), Y(12)); ctx.fillRect(X(99), Y(44), X(1), Y(12))
  const r = Math.max(4, w / 75)
  const dot = (p: { x: number; y: number }, fill: string, stroke: string) => {
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), r, 0, Math.PI * 2)
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke()
  }
  const dpr = window.devicePixelRatio || 1
  const team = (pts: Frame['home'], who: string[], kit: Kit) => {
    const [main, second] = kit
    for (const p of drawnPlayers(pts, who)) {
      dot(p, p.keeper ? keeperColor(kit) : main, p.keeper ? main : second)
      if (w / dpr < NAMES_FROM) continue
      ctx.font = `600 ${11 * dpr}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.lineWidth = 3 * dpr
      ctx.strokeStyle = 'rgba(0,0,0,0.65)'
      ctx.strokeText(p.name, X(p.x), Y(p.y) + r + 12 * dpr)
      ctx.fillStyle = '#fff'
      ctx.fillText(p.name, X(p.x), Y(p.y) + r + 12 * dpr)
    }
  }
  team(f.home, names.home, home)
  team(f.away, names.away, away)
  ctx.beginPath(); ctx.arc(X(f.ball.x), Y(f.ball.y), r * 0.55, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#111'; ctx.stroke()
}

export function PitchCanvas({ idle, highlight, speed, colors, names, onDone }: {
  idle: Frame
  highlight: Highlight | null
  speed: number
  colors: { home: [string, string]; away: [string, string] }
  names: Names
  onDone(): void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const namesRef = useRef(names)
  namesRef.current = names

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const size = () => {
      const w = canvas.parentElement?.clientWidth || 640
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = w * 0.62 * dpr
      canvas.style.height = `${w * 0.62}px`
    }
    size()
    window.addEventListener('resize', size)
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      if (!ctx) return
      if (highlight) {
        const t = (now - start) * speed
        draw(ctx, canvas.width, canvas.height, interpolate(highlight.frames, t), colors.home, colors.away, namesRef.current)
        if (t > highlight.frames[highlight.frames.length - 1].t + 500) { doneRef.current(); return }
      } else {
        draw(ctx, canvas.width, canvas.height, idle, colors.home, colors.away, namesRef.current)
      }
      raf = requestAnimationFrame(tick)
    }
    if (ctx) raf = requestAnimationFrame(tick)
    else if (highlight) {
      // no canvas available (tests / very old browsers): finish the highlight after its duration
      const id = setTimeout(() => doneRef.current(), (highlight.frames[highlight.frames.length - 1].t + 500) / speed)
      return () => { clearTimeout(id); window.removeEventListener('resize', size) }
    }
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size) }
  }, [highlight, speed, idle, colors])

  return <canvas ref={ref} className="pitch-canvas" style={{ width: '100%' }} aria-label="2D pitch" role="img" />
}
