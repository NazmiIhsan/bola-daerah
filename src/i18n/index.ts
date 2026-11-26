import { en } from './en'
import { ms } from './ms'
import { COMMENTARY, KIND_COMMENTARY, SHOUT_COMMENTARY } from './commentary'
import { NEWS } from './news'
import { PRESS } from './press'
import { PRESS_ANSWERS } from './pressAnswers'
import type { Rng } from '../game/rng'
import type { MatchEvent } from '../game/match/types'
import type { Answer, NewsItem, PressQuestion } from '../game/types'

export type Lang = 'en' | 'ms'
type Params = Record<string, string | number>
type Dicts = { en: Record<string, string>; ms: Record<string, string | undefined> }

function interpolate(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m))
}

/** ms missing → en → key */
export function createT(dicts: Dicts) {
  return (lang: Lang, key: string, params?: Params): string => {
    const text = (lang === 'ms' ? dicts.ms[key] : undefined) ?? dicts.en[key] ?? key
    return interpolate(text, params)
  }
}

export const t = createT({ en, ms })

/** 1st, 2nd, 11th… in English; ke-1, ke-2… in Malay. */
export function ordinal(lang: Lang, n: number): string {
  if (lang === 'ms') return `ke-${n}`
  const teen = n % 100 >= 11 && n % 100 <= 13
  return `${n}${teen ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

export function commentary(
  lang: Lang,
  event: MatchEvent,
  names: { player?: string; assist?: string; club?: string; subOn?: string },
  rng: Rng,
): string {
  const byKind = event.kind && (event.type === 'goal' || event.type === 'save' || event.type === 'miss') ? KIND_COMMENTARY[lang][`${event.type}.${event.kind}`] : undefined
  // A line that names the assist only works when there is one.
  const fitting = byKind?.filter((v) => names.assist || !v.includes('{assist}'))
  const variants = (event.type === 'shout' && event.shout ? SHOUT_COMMENTARY[lang][event.shout] : undefined) ?? (fitting?.length ? fitting : undefined) ?? COMMENTARY[lang][event.type]
  const p: Params = { minute: event.minute, ...(event.added ? { added: event.added } : {}) }
  for (const [k, v] of Object.entries(names)) if (v) p[k] = v
  const text = interpolate(rng.pick(variants), p)
  // Any placeholder we could not fill is replaced with a neutral word so no braces leak.
  return text.replace(/\{\w+\}/g, lang === 'ms' ? 'pemain' : 'the player')
}

/** Render a stored news item in the given language. Params ending in "Id" become club names. */
export function newsText(lang: Lang, item: NewsItem, clubName: (id: string) => string): { headline: string; body?: string } {
  const variants = NEWS[lang][item.key] ?? NEWS.en[item.key]
  if (!variants) return { headline: item.key }
  const p: Params = {}
  for (const [k, v] of Object.entries(item.params)) {
    if (k.endsWith('Id') && typeof v === 'string') p[k.slice(0, -2)] = clubName(v)
    else p[k] = v
  }
  const [headline, body] = variants[item.variant % variants.length].split('|')
  const fill = (x: string) => interpolate(x, p).replace(/\{\w+\}/g, '')
  return body ? { headline: fill(headline), body: fill(body) } : { headline: fill(headline) }
}

function pressVariant<T>(variants: T[], q: PressQuestion): T {
  return variants[(typeof q.params.v === 'number' ? q.params.v : 0) % variants.length]
}

const pressFill = (text: string, q: PressQuestion, clubName: (id: string) => string) =>
  interpolate(text, { opp: typeof q.params.oppId === 'string' ? clubName(q.params.oppId) : '' }).replace(/\{\w+\}/g, '')

export function pressText(lang: Lang, q: PressQuestion, clubName: (id: string) => string): string {
  const variants = PRESS[lang][q.key] ?? PRESS.en[q.key]
  return variants ? pressFill(pressVariant(variants, q), q, clubName) : q.key
}

/** What the manager would say to this exact question in the given tone. */
export function answerText(lang: Lang, q: PressQuestion, answer: Answer, clubName: (id: string) => string): string {
  const variants = PRESS_ANSWERS[lang][q.key] ?? PRESS_ANSWERS.en[q.key]
  return variants ? pressFill(pressVariant(variants, q)[answer], q, clubName) : ''
}
