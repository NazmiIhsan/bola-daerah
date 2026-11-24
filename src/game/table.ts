import type { Fixture } from './types'

export interface TableRow {
  clubId: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
}

export function computeTable(clubIds: string[], fixtures: Fixture[]): TableRow[] {
  const rows = new Map<string, TableRow>()
  for (const id of clubIds) rows.set(id, { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 })
  const add = (id: string, gf: number, ga: number) => {
    const r = rows.get(id)
    if (!r) return
    r.played++
    r.gf += gf
    r.ga += ga
    r.gd = r.gf - r.ga
    if (gf > ga) { r.won++; r.points += 3 } else if (gf === ga) { r.drawn++; r.points += 1 } else r.lost++
  }
  for (const f of fixtures) {
    if (!f.result) continue
    add(f.homeId, f.result.home, f.result.away)
    add(f.awayId, f.result.away, f.result.home)
  }
  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.clubId.localeCompare(b.clubId),
  )
}

export type Result = 'W' | 'D' | 'L'

/** Latest results, oldest first. */
export function formOf(clubId: string, fixtures: Fixture[], n = 5): Result[] {
  return fixtures
    .filter((f) => f.result && (f.homeId === clubId || f.awayId === clubId))
    .sort((a, b) => a.round - b.round)
    .slice(-n)
    .map((f) => {
      const [mine, theirs] = f.homeId === clubId ? [f.result!.home, f.result!.away] : [f.result!.away, f.result!.home]
      return mine > theirs ? 'W' : mine === theirs ? 'D' : 'L'
    })
}
