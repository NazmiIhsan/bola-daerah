import type { Rng } from './rng'
import { computeTable } from './table'
import { isRivalry } from './rivals'
import type { GameState, NewsItem } from './types'

export const INBOX_CAP = 150
export type NewNews = Omit<NewsItem, 'id' | 'season' | 'matchday' | 'read' | 'variant'>

/** Prepend items (newest first), assign ids/variants, and enforce the cap (drop oldest read first). */
export function addNews(state: GameState, items: NewNews[], rng: Rng): GameState {
  if (items.length === 0) return state
  const fresh: NewsItem[] = items.map((it) => ({
    ...it,
    id: `${state.season}-${state.matchday}-${Math.floor(rng.next() * 2 ** 32).toString(36)}`,
    season: state.season,
    matchday: state.matchday,
    variant: rng.int(0, 999),
    read: false,
  }))
  let inbox = [...fresh, ...state.inbox]
  if (inbox.length > INBOX_CAP) {
    let excess = inbox.length - INBOX_CAP
    const drop = new Set<string>()
    for (let i = inbox.length - 1; i >= 0 && excess > 0; i--) if (inbox[i].read) { drop.add(inbox[i].id); excess-- }
    inbox = inbox.filter((n) => !drop.has(n.id))
    if (inbox.length > INBOX_CAP) inbox = inbox.slice(0, INBOX_CAP)
  }
  return { ...state, inbox }
}

export function markRead(state: GameState, id: string): GameState {
  return { ...state, inbox: state.inbox.map((n) => (n.id === id ? { ...n, read: true } : n)) }
}

export function markAllRead(state: GameState): GameState {
  if (unreadCount(state) === 0) return state
  return { ...state, inbox: state.inbox.map((n) => (n.read ? n : { ...n, read: true })) }
}

export function unreadCount(state: GameState): number {
  return state.inbox.filter((n) => !n.read).length
}

function leader(state: GameState, div: 1 | 2): string | undefined {
  const ids = state.divisions[div - 1].clubIds
  const fx = state.fixtures.filter((f) => f.division === div)
  if (!fx.some((f) => f.result)) return undefined
  return computeTable(ids, fx)[0].clubId
}

/** News for one played round: `before` is the state before playMatchday, `after` after it. */
export function matchdayNews(before: GameState, after: GameState): NewNews[] {
  const out: NewNews[] = []
  const me = after.userClubId
  const round = before.matchday
  const played = after.fixtures.filter((f) => f.round === round && f.result)

  const mine = played.find((f) => f.homeId === me || f.awayId === me)
  if (mine) {
    const home = mine.homeId === me
    const oppId = home ? mine.awayId : mine.homeId
    const g = home ? mine.result!.home : mine.result!.away
    const c = home ? mine.result!.away : mine.result!.home
    const derby = isRivalry(after.clubs[me], after.clubs[oppId])
    const outcome = g === c ? 'draw' : g > c ? (derby ? 'derbyWin' : g - c >= 3 ? 'bigWin' : 'win') : derby ? 'derbyLoss' : c - g >= 3 ? 'heavyLoss' : 'loss'
    out.push({ kind: 'match', key: `news.match.${outcome}`, params: { clubId: me, oppId, score: `${g}–${c}` } })
  }

  const others = played.filter((f) => f !== mine).map((f) => ({ f, m: Math.abs(f.result!.home - f.result!.away) }))
  const big = others.sort((a, b) => b.m - a.m)[0]
  if (big && big.m >= 3) {
    const homeWon = big.f.result!.home > big.f.result!.away
    out.push({ kind: 'league', key: 'news.league.bigWin', params: {
      clubId: homeWon ? big.f.homeId : big.f.awayId, oppId: homeWon ? big.f.awayId : big.f.homeId,
      score: homeWon ? `${big.f.result!.home}–${big.f.result!.away}` : `${big.f.result!.away}–${big.f.result!.home}`,
    } })
  }

  const div = (after.divisions[0].clubIds.includes(me) ? 1 : 2) as 1 | 2
  const was = leader(before, div), now = leader(after, div)
  if (now && now !== was && round > 1) out.push({ kind: 'league', key: 'news.league.newLeader', params: { clubId: now, n: div } })

  const fb = before.fans.mood, fa = after.fans.mood
  if (fb >= 25 && fa < 25) out.push({ kind: 'fans', key: 'news.fans.angry', params: { clubId: me }, important: true })
  else if (fb >= 40 && fa < 40) out.push({ kind: 'fans', key: 'news.fans.uneasy', params: { clubId: me } })
  if (fb < 75 && fa >= 75) out.push({ kind: 'fans', key: 'news.fans.delighted', params: { clubId: me } })

  const bb = before.board.confidence, ba = after.board.confidence
  if (bb >= 30 && ba < 30) out.push({ kind: 'board', key: 'news.board.warning', params: { clubId: me }, important: true })
  if (bb < 80 && ba >= 80) out.push({ kind: 'board', key: 'news.board.backing', params: { clubId: me } })

  if (before.finance.balance >= 0 && after.finance.balance < 0) out.push({ kind: 'finance', key: 'news.finance.debt', params: { clubId: me }, important: true })
  return out
}

export function seasonStartNews(state: GameState): NewNews[] {
  return [{ kind: 'board', key: `news.board.expectation.${state.board.expectation}`, params: { clubId: state.userClubId, pos: state.board.targetPosition } }]
}

/** `ended` is the final state of the finished season (before endSeason). */
export function seasonEndNews(ended: GameState): NewNews[] {
  const t1 = computeTable(ended.divisions[0].clubIds, ended.fixtures.filter((f) => f.division === 1))
  const t2 = computeTable(ended.divisions[1].clubIds, ended.fixtures.filter((f) => f.division === 2))
  return [
    { kind: 'league', key: 'news.season.champions', params: { clubId: t1[0].clubId, n: 1 }, important: t1[0].clubId === ended.userClubId },
    { kind: 'league', key: 'news.season.champions', params: { clubId: t2[0].clubId, n: 2 }, important: t2[0].clubId === ended.userClubId },
    { kind: 'league', key: 'news.season.promoted', params: { clubId: t2[0].clubId, club2Id: t2[1].clubId } },
    { kind: 'league', key: 'news.season.relegated', params: { clubId: t1[t1.length - 1].clubId, club2Id: t1[t1.length - 2].clubId } },
  ]
}
