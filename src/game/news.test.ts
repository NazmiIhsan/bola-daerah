import { addNews, INBOX_CAP, markAllRead, markRead, matchdayNews, seasonStartNews, unreadCount } from './news'
import { newGame } from './generate'
import { createRng } from './rng'
import type { GameState } from './types'

/** Give the user's round-1 fixture a result (and every other round-1 fixture 0–0). */
function afterRound(s: GameState, mine: number, theirs: number, patch: Partial<GameState> = {}): GameState {
  return {
    ...s,
    ...patch,
    matchday: 2,
    fixtures: s.fixtures.map((f) => {
      if (f.round !== 1) return f
      if (f.homeId === s.userClubId) return { ...f, result: { home: mine, away: theirs } }
      if (f.awayId === s.userClubId) return { ...f, result: { home: theirs, away: mine } }
      return { ...f, result: { home: 0, away: 0 } }
    }),
  }
}

test('a user win produces a match report with club, opponent and score', () => {
  const s = newGame(1, 'sepang')
  const items = matchdayNews(s, afterRound(s, 2, 1))
  const report = items.find((i) => i.kind === 'match')!
  expect(['news.match.win', 'news.match.derbyWin']).toContain(report.key)
  expect(report.params).toMatchObject({ clubId: 'sepang', score: '2–1' })
  expect(report.params.oppId).toBeTruthy()
})

test('big wins and derby losses get their own keys', () => {
  const s = newGame(1, 'sepang')
  expect(matchdayNews(s, afterRound(s, 4, 0)).find((i) => i.kind === 'match')!.key).toMatch(/bigWin|derbyWin/)
  // find a round where klang plays petaling
  const k = newGame(1, 'klang')
  const derby = k.fixtures.find((f) => [f.homeId, f.awayId].sort().join() === 'klang,petaling')!
  const before = { ...k, matchday: derby.round }
  const after = { ...k, matchday: derby.round + 1, fixtures: k.fixtures.map((f) => (f.id === derby.id ? { ...f, result: f.homeId === 'klang' ? { home: 0, away: 2 } : { home: 2, away: 0 } } : f)) }
  expect(matchdayNews(before, after).find((i) => i.kind === 'match')!.key).toBe('news.match.derbyLoss')
})

test('fan and board threshold crossings make news', () => {
  const s = newGame(1, 'kapar')
  const before = { ...s, fans: { ...s.fans, mood: 45 }, board: { ...s.board, confidence: 35 } }
  const after = afterRound(s, 0, 1, { fans: { ...s.fans, mood: 38 }, board: { ...s.board, confidence: 28 } })
  const items = matchdayNews(before, after)
  expect(items.some((i) => i.key === 'news.fans.uneasy')).toBe(true)
  const warn = items.find((i) => i.key === 'news.board.warning')!
  expect(warn.important).toBe(true)
})

test('inbox is capped, keeps unread over read, newest first', () => {
  let s = newGame(1, 'kapar')
  const rng = createRng(1)
  for (let i = 0; i < 400; i++) {
    s = addNews({ ...s, matchday: i }, [{ kind: 'league', key: 'news.league.bigWin', params: { n: i } }], rng)
    if (i < 300 && i % 2 === 0) s = markRead(s, s.inbox[0].id)
  }
  expect(s.inbox).toHaveLength(INBOX_CAP)
  expect(s.inbox[0].params.n).toBe(399)
  for (let i = 1; i < s.inbox.length; i++) expect(s.inbox[i - 1].matchday).toBeGreaterThanOrEqual(s.inbox[i].matchday)
  // unread ones (odd i, and everything ≥300) should dominate: all 100 items from 300..399 are kept
  expect(s.inbox.filter((n) => (n.params.n as number) >= 300)).toHaveLength(100)
  expect(s.inbox.every((n) => !n.read)).toBe(true)
})

test('markRead and unreadCount', () => {
  let s = addNews(newGame(1, 'kapar'), [{ kind: 'fans', key: 'news.fans.uneasy', params: { clubId: 'kapar' } }, { kind: 'fans', key: 'news.fans.angry', params: { clubId: 'kapar' } }], createRng(2))
  expect(unreadCount(s)).toBe(2)
  s = markRead(s, s.inbox[1].id)
  expect(unreadCount(s)).toBe(1)
  expect(new Set(s.inbox.map((n) => n.id)).size).toBe(2)
})

test('seasonStartNews announces the board expectation', () => {
  const s = newGame(1, 'petaling')
  expect(seasonStartNews(s)[0]).toMatchObject({ kind: 'board', key: 'news.board.expectation.title' })
})

test('markAllRead reads everything and leaves a read inbox untouched', () => {
  const s = addNews(newGame(1, 'kapar'), [{ kind: 'fans', key: 'news.fans.uneasy', params: { clubId: 'kapar' } }], createRng(1))
  const read = markAllRead(s)
  expect(unreadCount(read)).toBe(0)
  expect(read.inbox).toHaveLength(s.inbox.length)
  expect(markAllRead(read)).toBe(read)
})
