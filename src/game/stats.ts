import { cupResult } from './cup'
import { computeTable } from './table'
import type { NewNews } from './news'
import type { Award, GameState, Player, SeasonRecord } from './types'

const MIN_APPS = 10

/** Average match rating this season, or null before the first appearance. */
export function averageRating(p: Player): number | null {
  return p.rated > 0 ? p.ratingSum / p.rated : null
}

const inDivision = (state: GameState, division: 1 | 2): Player[] => {
  const ids = new Set(state.divisions[division - 1].clubIds)
  return Object.values(state.players).filter((p) => ids.has(p.clubId))
}

export function topScorers(state: GameState, division: 1 | 2, n: number): Player[] {
  return inDivision(state, division)
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.apps - b.apps || a.id.localeCompare(b.id))
    .slice(0, n)
}

const award = (p: Player | undefined, value: number): Award | null => (p ? { name: `${p.firstName} ${p.lastName}`, clubId: p.clubId, value } : null)

export interface SeasonAwards { goldenBoot: [Award | null, Award | null]; bestPlayer: [Award | null, Award | null] }

export function seasonAwards(state: GameState): SeasonAwards {
  const boot = (d: 1 | 2) => { const p = topScorers(state, d, 1)[0]; return award(p, p?.goals ?? 0) }
  const best = (d: 1 | 2) => {
    const p = inDivision(state, d).filter((x) => x.rated >= MIN_APPS).sort((a, b) => averageRating(b)! - averageRating(a)! || a.id.localeCompare(b.id))[0]
    return award(p, p ? Math.round(averageRating(p)! * 100) / 100 : 0)
  }
  return { goldenBoot: [boot(1), boot(2)], bestPlayer: [best(1), best(2)] }
}

/** What a finished season is remembered for. */
export function seasonRecord(ended: GameState): SeasonRecord {
  const tables = ended.divisions.map((d) => computeTable(d.clubIds, ended.fixtures.filter((f) => f.division === d.id)))
  const me = ended.userClubId
  const mine = tables.findIndex((t) => t.some((r) => r.clubId === me))
  const position = tables[mine].findIndex((r) => r.clubId === me)
  return {
    season: ended.season,
    champions: [tables[0][0].clubId, tables[1][0].clubId],
    me: { clubId: me, division: (mine + 1) as 1 | 2, position: position + 1, points: tables[mine][position].points },
    ...seasonAwards(ended),
    cup: cupResult(ended.cup),
  }
}

export function honours(state: Pick<GameState, 'history'>, clubId: string): { division1: number; division2: number; cup: number } {
  return {
    division1: state.history.filter((r) => r.champions[0] === clubId).length,
    division2: state.history.filter((r) => r.champions[1] === clubId).length,
    cup: state.history.filter((r) => r.cup?.winnerId === clubId).length,
  }
}

export function awardNews(record: SeasonRecord): NewNews[] {
  const item = (key: string, a: Award | null, n: 1 | 2): NewNews[] => (a ? [{ kind: 'league', key, params: { clubId: a.clubId, player: a.name, value: a.value, n }, important: a.clubId === record.me.clubId }] : [])
  return ([1, 2] as const).flatMap((n) => [...item('news.season.goldenBoot', record.goldenBoot[n - 1], n), ...item('news.season.bestPlayer', record.bestPlayer[n - 1], n)])
}
