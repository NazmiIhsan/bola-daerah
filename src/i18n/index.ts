import { en } from './en'
import { ms } from './ms'
import { COMMENTARY } from './commentary'
import { NEWS } from './news'
import type { Rng } from '../game/rng'
import type { MatchEvent } from '../game/match/types'
import type { NewsItem } from '../game/types'

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

export function commentary(
  lang: Lang,
  event: MatchEvent,
  names: { player?: string; assist?: string; club?: string; subOn?: string },
  rng: Rng,
): string {
  const variants = COMMENTARY[lang][event.type]
  const p: Params = { minute: event.minute }
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
