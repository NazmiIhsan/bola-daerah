import { t, commentary, createT } from './index'
import { en } from './en'
import { ms } from './ms'
import { createRng } from '../game/rng'
import type { EventType } from '../game/match/types'

test('interpolates params', () => {
  expect(t('en', 'dashboard.season', { season: 2027 })).toContain('2027')
})

test('missing ms key falls back to en, unknown key returns the key', () => {
  const tt = createT({ en: { 'x.only': 'Only English' }, ms: {} })
  expect(tt('ms', 'x.only')).toBe('Only English')
  expect(tt('ms', 'does.not.exist')).toBe('does.not.exist')
})

test('every en key has an ms translation', () => {
  const missing = Object.keys(en).filter((k) => !(k in ms) || !(ms as Record<string, string>)[k])
  expect(missing).toEqual([])
})

test('commentary returns non-empty text for every EventType in both languages', () => {
  const types: EventType[] = ['kickoff', 'chance', 'goal', 'save', 'miss', 'yellow', 'red', 'injury', 'sub', 'halftime', 'fulltime']
  const rng = createRng(1)
  for (const lang of ['en', 'ms'] as const) {
    for (const type of types) {
      const text = commentary(lang, { minute: 10, type, side: 'home', highlight: false }, { player: 'Ali', assist: 'Ben', club: 'Kapar', subOn: 'Chong' }, rng)
      expect(text.trim().length).toBeGreaterThan(0)
      expect(text).not.toMatch(/\{\w+\}/)
    }
  }
})

test('commentary has at least 3 variants for goals', () => {
  const rng = createRng(2)
  const seen = new Set<string>()
  for (let i = 0; i < 60; i++) seen.add(commentary('ms', { minute: 1, type: 'goal', side: 'home', highlight: true }, { player: 'Ali', club: 'Kapar' }, rng))
  expect(seen.size).toBeGreaterThanOrEqual(3)
})

describe('news templates', async () => {
  const { NEWS } = await import('./news')
  const { newsText } = await import('./index')
  test('every news key has ≥3 variants in en and ms, same key set', () => {
    expect(Object.keys(NEWS.ms).sort()).toEqual(Object.keys(NEWS.en).sort())
    for (const lang of ['en', 'ms'] as const) for (const [k, v] of Object.entries(NEWS[lang])) expect({ k, n: v.length >= 3 }).toEqual({ k, n: true })
  })
  test('newsText resolves club ids, leaves no placeholders, and is stable per variant', () => {
    const params = { clubId: 'kapar', oppId: 'klang', club2Id: 'jugra', score: '3–1', pos: 2, n: 1, expectation: 'x', player: 'Ali Hassan', fee: 'RM 120,000', season: 2029 }
    for (const lang of ['en', 'ms'] as const) for (const key of Object.keys(NEWS.en)) {
      const item = { id: 'a', season: 2027, matchday: 1, kind: 'match' as const, key, params, variant: 7, read: false }
      const a = newsText(lang, item, (id) => id.toUpperCase())
      expect(a.headline).not.toMatch(/\{\w+\}/)
      expect(a.body ?? '').not.toMatch(/\{\w+\}/)
      expect(newsText(lang, item, (id) => id.toUpperCase())).toEqual(a)
    }
  })
})

test('every transfer, youth and underdog news key the game emits has templates', async () => {
  const { NEWS } = await import('./news')
  const keys = ['signed', 'signedFree', 'sold', 'renewed', 'offer', 'deal', 'dealFree', 'rumour', 'windowOpen', 'deadline', 'closed', 'expiring', 'left']
  for (const k of keys) expect(Object.keys(NEWS.en)).toContain(`news.transfer.${k}`)
  for (const k of ['youth.intake', 'youth.wonderkid', 'youth.debut', 'youth.breakthrough', 'season.underdog', 'season.darkHorse']) expect(Object.keys(NEWS.en)).toContain(`news.${k}`)
})

describe('press templates', async () => {
  const { PRESS } = await import('./press')
  const { pressText, t } = await import('./index')
  test('≥3 variants, same keys in both languages, no leftover placeholders', () => {
    expect(Object.keys(PRESS.ms).sort()).toEqual(Object.keys(PRESS.en).sort())
    for (const lang of ['en', 'ms'] as const) for (const key of Object.keys(PRESS.en)) {
      expect(PRESS[lang][key].length).toBeGreaterThanOrEqual(3)
      expect(pressText(lang, { key, params: { oppId: 'klang', v: 4 } }, (id) => id)).not.toMatch(/\{\w+\}/)
    }
  })
  test('answer labels exist in both languages', () => {
    for (const a of ['confident', 'humble', 'combative']) {
      expect(t('ms', `press.a.${a}`)).not.toBe(`press.a.${a}`)
      expect(t('en', `press.a.${a}`)).not.toBe(`press.a.${a}`)
    }
  })
  test('every question has its own answers: no text is ever reused, in either language', async () => {
    const { answerText } = await import('./index')
    for (const lang of ['en', 'ms'] as const) {
      const seen = new Map<string, string>()
      for (const key of Object.keys(PRESS.en)) for (let v = 0; v < PRESS[lang][key].length; v++) for (const a of ['confident', 'humble', 'combative'] as const) {
        const text = answerText(lang, { key, params: { oppId: 'klang', v } }, a, () => 'Klang')
        expect(text.length).toBeGreaterThan(10)
        expect(text).not.toMatch(/[{}]/)
        expect(seen.get(text) ?? 'unique').toBe('unique')
        seen.set(text, `${key}/${v}/${a}`)
      }
      expect(seen.size).toBe(8 * 3 * 3)
    }
  })
  test('answers follow the question text for any stored variant number', async () => {
    const { answerText } = await import('./index')
    const at = (v: number) => answerText('en', { key: 'press.q.pre.generic', params: { oppId: 'klang', v } }, 'humble', () => 'Klang')
    expect(at(997)).toBe(at(997 % 3))
    expect(at(0)).not.toBe(at(1))
  })
})
