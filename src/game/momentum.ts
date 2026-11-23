import { CLUBS } from './data/clubs'
import type { NewNews } from './news'
import type { Rng } from './rng'
import { computeTable } from './table'
import type { Club, Division, GameState } from './types'

const FORM_MIN = 0.84
const FORM_MAX = 1.2
const FORM_SPREAD = 0.055
const DARK_HORSE = 1.12
const TOP = 3
const COMPLACENCY = 0.06
const STUMBLE_MIN = 0.05
const STUMBLE_MAX = 0.14

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Clubs of a division, biggest reputation first. */
function byReputation(state: Pick<GameState, 'clubs'>, d: Division): string[] {
  return [...d.clubIds].sort((a, b) => state.clubs[b].reputation - state.clubs[a].reputation || a.localeCompare(b))
}

/** Roughly normal, mean 0, standard deviation 1. */
const bell = (rng: Rng) => (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.73

/**
 * Hidden form for a season: team spirit, a clever coach, a bad dressing room. Each division gets
 * a dark horse from its lower half, a challenger from the middle and two favourites who stumble.
 * Reigning champions get a little complacent. The user's club stays at 1.
 */
export function rollForm(state: Pick<GameState, 'clubs' | 'divisions' | 'userClubId'>, rng: Rng, champions: string[] = []): Record<string, number> {
  const form: Record<string, number> = {}
  for (const id of Object.keys(state.clubs)) form[id] = 1 + bell(rng) * FORM_SPREAD
  for (const d of state.divisions) {
    const others = byReputation(state, d).filter((id) => id !== state.userClubId)
    const half = Math.floor(others.length / 2)
    const lift = () => DARK_HORSE + rng.next() * (FORM_MAX - DARK_HORSE)
    form[rng.pick(others.slice(half))] = lift()
    const middle = others.slice(TOP, half + 1)
    if (middle.length) form[rng.pick(middle)] = lift()
    const spared = rng.pick(others.slice(0, TOP))
    for (const id of others.slice(0, TOP)) if (id !== spared) form[id] -= STUMBLE_MIN + (STUMBLE_MAX - STUMBLE_MIN) * rng.next()
  }
  for (const id of champions) form[id] -= COMPLACENCY
  for (const id of Object.keys(form)) form[id] = id === state.userClubId ? 1 : Math.round(clamp(form[id], FORM_MIN, FORM_MAX) * 1000) / 1000
  return form
}

const standings = (state: GameState, d: Division) => computeTable(d.clubIds, state.fixtures.filter((f) => f.division === d.id)).map((r) => r.clubId)

const ORIGINAL: Record<string, number> = Object.fromEntries(CLUBS.map((c) => [c.id, c.reputation]))
const HOMING = 0.08

/** Clubs after a season: standing rises and falls with results, with a gentle pull towards where they started. */
export function moveReputations(ended: GameState): Record<string, Club> {
  const clubs = { ...ended.clubs }
  for (const d of ended.divisions) {
    const expected = byReputation(ended, d)
    const table = standings(ended, d)
    table.forEach((id, i) => {
      let change = clamp(expected.indexOf(id) - i, -4, 4)
      if (i === 0) change += 2
      if (d.id === 2 && i < 2) change += 3
      if (d.id === 1 && i >= table.length - 2) change -= 3
      const rep = ended.clubs[id].reputation
      const pull = ((ORIGINAL[id] ?? rep) - rep) * HOMING
      clubs[id] = { ...clubs[id], reputation: clamp(Math.round(rep + change + pull), 20, 90) }
    })
  }
  return clubs
}

/** Headlines for champions and promoted clubs few people saw coming. */
export function underdogNews(ended: GameState): NewNews[] {
  const out: NewNews[] = []
  for (const d of ended.divisions) {
    const expected = byReputation(ended, d)
    const winners = standings(ended, d).slice(0, d.id === 1 ? 1 : 2)
    for (const id of winners) {
      if (expected.indexOf(id) >= (d.id === 1 ? 3 : 4)) out.push({ kind: 'league', key: 'news.season.underdog', params: { clubId: id, n: d.id }, important: true })
    }
  }
  return out
}

/** The pundits' pick: usually the dark horse of the user's division, sometimes wide of the mark. */
export function darkHorseNews(state: GameState, rng: Rng): NewNews[] {
  const d = state.divisions.find((x) => x.clubIds.includes(state.userClubId))!
  const others = byReputation(state, d).filter((id) => id !== state.userClubId)
  const low = others.slice(Math.floor(others.length / 2))
  const best = low.reduce((a, b) => (state.form[b] > state.form[a] ? b : a))
  return [{ kind: 'league', key: 'news.season.darkHorse', params: { clubId: rng.chance(0.7) ? best : rng.pick(low), n: d.id } }]
}
