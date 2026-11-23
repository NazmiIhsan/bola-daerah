import { createRng } from './rng'

test('same seed gives same sequence', () => {
  const a = createRng(42), b = createRng(42)
  for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
})

test('int is inclusive and in range', () => {
  const r = createRng(1)
  const seen = new Set<number>()
  for (let i = 0; i < 10000; i++) {
    const v = r.int(1, 6)
    expect(v).toBeGreaterThanOrEqual(1)
    expect(v).toBeLessThanOrEqual(6)
    seen.add(v)
  }
  expect(seen.has(1) && seen.has(6)).toBe(true)
})

test('restores from state', () => {
  const r = createRng(99)
  r.next(); r.next()
  const copy = createRng(r.state())
  for (let i = 0; i < 20; i++) expect(copy.next()).toBe(r.next())
})
