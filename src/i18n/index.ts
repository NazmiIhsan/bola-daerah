import { en } from './en'
import { ms } from './ms'
import { COMMENTARY } from './commentary'
import type { Rng } from '../game/rng'
import type { MatchEvent } from '../game/match/types'

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
