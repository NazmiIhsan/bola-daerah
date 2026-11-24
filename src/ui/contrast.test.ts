/// <reference types="vite/client" />
import css from './theme.css?raw'

type RGB = [number, number, number]
const block = (sel: string) => {
  const i = css.indexOf(sel + ' {')
  return Object.fromEntries([...css.slice(i, css.indexOf('}', i)).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}
const light = block(':root')
const themes = { light, dark: { ...light, ...block(':root[data-theme="dark"]') }, autoDark: { ...light, ...block(':root:not([data-theme="light"])') } }
const hex = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255] }
const tint = (rgba: string, over: RGB): RGB => { const [r, g, b, a] = rgba.match(/[\d.]+/g)!.map(Number); return [r, g, b].map((v, i) => v * a + over[i] * (1 - a)) as RGB }
const lum = (c: RGB) => { const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a: RGB, b: RGB) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const WHITE: RGB = [255, 255, 255]

describe.each(Object.entries(themes))('%s theme', (_, v) => {
  const surface = hex(v['--surface'])
  test.each([
    ['text on cards', hex(v['--text']), surface],
    ['muted text on cards', hex(v['--muted']), surface],
    ['muted text on the page', hex(v['--muted']), hex(v['--bg'])],
    ['gains', hex(v['--good-text']), surface],
    ['losses', hex(v['--bad-text']), surface],
    ['losses on a red label', hex(v['--bad-text']), tint(v['--down'], surface)],
    ['gains on a green label', hex(v['--good-text']), tint(v['--up'], surface)],
    ['primary button', WHITE, hex(v['--accent'])],
    ['win pill', WHITE, hex(v['--good'])],
    ['draw pill', WHITE, hex(v['--draw'])],
    ['loss pill', WHITE, hex(v['--bad'])],
  ] as Array<[string, RGB, RGB]>)('%s is readable', (_n, fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5))
})

test.each(['GK', 'DF', 'MF', 'FW'])('the %s badge is readable', (pos) => {
  const bg = css.match(new RegExp(`\\.pos\\.${pos} \\{ background: (#[0-9a-f]{6})`))![1]
  expect(ratio(WHITE, hex(bg))).toBeGreaterThanOrEqual(4.5)
})

test('no text is smaller than 12px', () => {
  const small = [...css.matchAll(/font-size:\s*([\d.]+)(rem|px)/g)].filter((m) => Number(m[1]) * (m[2] === 'rem' ? 16 : 1) < 12).map((m) => m[0])
  expect(small).toEqual([])
})
