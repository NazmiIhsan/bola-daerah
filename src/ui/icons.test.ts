/// <reference types="vite/client" />
const sources = import.meta.glob<string>(['../**/*.ts', '../**/*.tsx', '!../**/*.test.*'], { query: '?raw', import: 'default', eager: true })

test('no emoji or symbol glyphs in the app source', () => {
  expect(Object.keys(sources).length).toBeGreaterThan(40)
  const emoji = /[\u{1F000}-\u{1FAFF}☀-➿⬀-⯿■-◿️←↑↓]/u
  const bad = Object.entries(sources).flatMap(([f, text]) => text.split('\n').map((l, i) => (emoji.test(l) ? `${f}:${i + 1}` : '')).filter(Boolean))
  expect(bad).toEqual([])
})
