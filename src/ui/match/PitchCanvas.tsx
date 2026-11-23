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

/** Picks kit colours so the two teams never look the same. */
export function teamColors(home: [string, string], away: [string, string]) {
  return { home, away: similar(home[0], away[0]) ? ([away[1], away[0]] as [string, string]) : away }
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame, home: [string, string], away: [string, string]) {
  const X = (x: number) => (x / 100) * w
  const Y = (y: number) => (y / 100) * h
  ctx.fillStyle = '#2f7d3b'
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
  f.home.forEach((p, i) => dot(p, i === 0 ? home[1] : home[0], i === 0 ? home[0] : home[1]))
  f.away.forEach((p, i) => dot(p, i === 0 ? away[1] : away[0], i === 0 ? away[0] : away[1]))
  ctx.beginPath(); ctx.arc(X(f.ball.x), Y(f.ball.y), r * 0.55, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#111'; ctx.stroke()
}

export function PitchCanvas({ idle, highlight, speed, colors, onDone }: {
  idle: Frame
  highlight: Highlight | null
  speed: number
  colors: { home: [string, string]; away: [string, string] }
  onDone(): void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

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
        draw(ctx, canvas.width, canvas.height, interpolate(highlight.frames, t), colors.home, colors.away)
        if (t > highlight.frames[highlight.frames.length - 1].t + 500) { doneRef.current(); return }
      } else {
        draw(ctx, canvas.width, canvas.height, idle, colors.home, colors.away)
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
