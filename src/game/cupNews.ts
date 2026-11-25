import { cupTieOf } from './cup'
import type { NewNews } from './news'
import type { CupTie, GameState } from './types'

const FINAL = 4

const scoreLine = (t: CupTie) => `${t.result!.home}–${t.result!.away}${t.pens ? ` (${t.pens.home}–${t.pens.away})` : ''}`

/** Headlines after a cup round. */
export function cupNews(before: GameState, after: GameState, played: CupTie[], round: number): NewNews[] {
  const me = after.userClubId
  const out: NewNews[] = []
  const loser = (t: CupTie) => (t.winnerId === t.homeId ? t.awayId : t.homeId)
  const division = (id: string) => before.divisions.findIndex((d) => d.clubIds.includes(id))
  const mine = played.find((t) => t.homeId === me || t.awayId === me)
  if (round === FINAL) out.push({ kind: 'league', key: 'news.cup.winner', params: { clubId: played[0].winnerId!, oppId: loser(played[0]), score: scoreLine(played[0]) }, important: played[0].winnerId === me })
  else if (mine) {
    const won = mine.winnerId === me
    out.push({ kind: 'match', key: won ? 'news.cup.through' : 'news.cup.out', params: { clubId: me, oppId: mine.homeId === me ? mine.awayId : mine.homeId, score: scoreLine(mine) }, important: true })
  }
  const shock = played.find((t) => t !== mine && division(t.winnerId!) > division(loser(t)))
  if (shock) out.push({ kind: 'league', key: 'news.cup.shock', params: { clubId: shock.winnerId!, oppId: loser(shock), score: scoreLine(shock) } })
  const next = round < FINAL ? cupTieOf(after, me) : undefined
  if (next) out.push({ kind: 'match', key: 'news.cup.draw', params: { clubId: me, oppId: next.homeId === me ? next.awayId : next.homeId } })
  return out
}
