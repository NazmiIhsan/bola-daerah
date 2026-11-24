import { drawnPlayers, keeperColor, teamColors } from './PitchCanvas'
import { CLUBS } from '../../game/data/clubs'

const pts = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]

test('sent-off players disappear; names come with the rest', () => {
  expect(drawnPlayers(pts, ['Ali', '', 'Tan'])).toEqual([{ x: 1, y: 1, name: 'Ali', keeper: true }, { x: 3, y: 3, name: 'Tan', keeper: false }])
})

test('every pairing can be told apart, from each other and from the grass', () => {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const gap = (a: string, b: string) => rgb(a).reduce((s, v, i) => s + Math.abs(v - rgb(b)[i]), 0)
  const bad: string[] = []
  for (const h of CLUBS) for (const a of CLUBS) {
    if (h === a) continue
    const c = teamColors(h.colors, a.colors)
    if (gap(c.home[0], c.away[0]) < 120 || gap(c.home[0], '#2f7d3b') < 120 || gap(c.away[0], '#2f7d3b') < 120) bad.push(`${h.id}-${a.id}`)
  }
  expect(bad).toEqual([])
})

test('a side keeps its own colours when nothing clashes', () => {
  expect(teamColors(['#003da5', '#ffffff'], ['#c8102e', '#ffd100'])).toEqual({ home: ['#003da5', '#ffffff'], away: ['#c8102e', '#ffd100'] })
})

test('goalkeepers stand out from the grass and their own team', () => {
  for (const c of CLUBS) {
    const [main, second] = teamColors(c.colors, ['#003da5', '#ffffff']).home
    const gk = keeperColor([main, second])
    for (const other of [main, '#2f7d3b']) {
      const gap = [1, 3, 5].reduce((s, i) => s + Math.abs(parseInt(gk.slice(i, i + 2), 16) - parseInt(other.slice(i, i + 2), 16)), 0)
      expect(gap, c.id).toBeGreaterThanOrEqual(120)
    }
  }
})
