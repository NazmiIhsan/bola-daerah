import { newGame } from './generate'
import { migrate } from './migrate'
import { managerOf } from './manager'
import { playMatchday } from './season'
import { makeEvent, resolveStory, storyWeek, isRamadan, touchlineBan, derbyEdge, STORY } from './story'
import { makeV5 } from './testUtils'
import { createRng } from './rng'
import { isAvailable } from './tactics'
import { squad } from './market'
import type { EventKind, GameState } from './types'

const base = newGame(11, 'klang')
/** Play n league matchdays (cup weeks in between do not count). */
const play = (s: GameState, n: number) => {
  const target = Math.min(19, s.matchday + n)
  for (let guard = 0; s.matchday < target && guard < 40; guard++) s = playMatchday({ ...s, story: { ...s.story, pending: null }, press: null })
  return s
}
const mid = play(base, 5)
const withEvent = (s: GameState, kind: EventKind, seed = 1) => {
  for (let k = 0; k < 200; k++) {
    const e = makeEvent(s, kind, createRng(seed + k))
    if (e) return { ...s, story: { ...s.story, pending: e } }
  }
  throw new Error(`no ${kind} event possible`)
}
const rng = () => createRng(7)

describe('upgrading a save from before stories', () => {
  const old = makeV5(mid)
  const up = migrate(old)

  test('a mid-season version 5 save becomes version 6 with every result kept', () => {
    expect(up.version).toBe(6)
    expect(up.matchday).toBe(mid.matchday)
    expect(up.fixtures).toEqual(mid.fixtures)
    expect(up.players[Object.keys(mid.players)[0]]).toEqual(mid.players[Object.keys(mid.players)[0]])
    expect(up.managerName).toBe('')
    expect(up.story).toEqual({ pending: null, last: {}, promises: [] })
  })

  test('every club gets a named manager with the personality it had before', () => {
    for (const id of Object.keys(up.clubs)) {
      expect(up.managers[id].name).toMatch(/\S+ \S+/)
      const before = managerOf({ seed: up.seed }, id)
      expect(up.managers[id]).toMatchObject({ attack: before.attack, bold: before.bold, youth: before.youth, formations: before.formations })
    }
  })

  test('the upgraded save plays on to the end of the season', () => {
    const s = play(up, 18 - up.matchday + 1)
    expect(s.matchday).toBeGreaterThan(18)
  })
})

describe('the week\'s stories', () => {
  test('over a few seasons of weeks there are breaking stories, at most one waiting at a time', () => {
    const kinds = new Set<string>()
    let headlines = 0
    for (let seed = 1; seed <= 6; seed++) {
      let s = newGame(seed, seed % 2 ? 'klang' : 'kapar')
      for (let i = 0; i < 17; i++) {
        s = playMatchday({ ...s, press: null })
        if (s.story.pending) {
          kinds.add(s.story.pending.kind)
          s = resolveStory(s, s.story.pending.options[0], createRng(i))
          expect(s.story.pending).toBeNull()
        }
      }
      headlines += s.inbox.filter((n) => n.breaking).length
    }
    expect(kinds.size).toBeGreaterThanOrEqual(6)
    expect(headlines).toBeGreaterThan(3)
  })

  test('a waiting story blocks a second one', () => {
    const s = withEvent(mid, 'tvInterview')
    const next = storyWeek(s, { ...s, matchday: s.matchday + 1 }, createRng(3))
    expect(next.story.pending!.id).toBe(s.story.pending!.id)
  })

  test('the same kind cannot come back within the cooldown', () => {
    let s: GameState = { ...mid, story: { ...mid.story, last: { tvInterview: mid.season * 100 + mid.matchday - 1 } } }
    for (let k = 0; k < 40; k++) {
      s = storyWeek(mid, { ...s, story: { ...s.story, pending: null } }, createRng(k))
      expect(s.story.pending?.kind).not.toBe('tvInterview')
    }
  })

  test('nothing happens to a sacked manager', () => {
    const sacked: GameState = { ...mid, career: { kind: 'sacked', offers: [] } }
    expect(storyWeek(mid, sacked, createRng(1))).toBe(sacked)
  })

  test('Ramadan lasts three matchdays each season and is announced', () => {
    const s = play(base, 18)
    const r = s.story.ramadan!
    expect(r.to - r.from).toBe(2)
    expect(isRamadan({ ...s, matchday: r.from })).toBe(true)
    expect(isRamadan({ ...s, matchday: r.to + 1 })).toBe(false)
  })
})

describe('your decisions', () => {
  const me = (s: GameState, id: string) => s.players[id]

  test('a pay rise raises the wage and morale; refusing hurts', () => {
    const s = withEvent(mid, 'payRise')
    const id = String(s.story.pending!.params.playerId)
    const given = resolveStory(s, 'give', rng())
    expect(me(given, id).wage).toBe(Number(s.story.pending!.params.wage))
    expect(me(given, id).morale).toBeGreaterThan(me(s, id).morale)
    expect(me(resolveStory(s, 'refuse', rng()), id).morale).toBeLessThan(me(s, id).morale)
  })

  test('a promise comes back when due, and breaking it costs morale', () => {
    let s = resolveStory(withEvent(mid, 'payRise'), 'promise', rng())
    const promise = s.story.promises[0]
    expect(promise.due).toBe(mid.matchday + STORY.promiseWeeks)
    s = storyWeek(s, { ...s, matchday: promise.due }, createRng(2))
    expect(s.story.pending?.kind).toBe('promiseDue')
    const broken = resolveStory(s, 'break', rng())
    expect(me(broken, promise.playerId).morale).toBeLessThan(me(s, promise.playerId).morale)
    expect(broken.story.promises).toHaveLength(0)
  })

  test('dropping a player after a scandal keeps him out of the next match', () => {
    const s = withEvent(mid, 'scandal')
    const id = String(s.story.pending!.params.playerId)
    const after = resolveStory(s, 'drop', rng())
    expect(isAvailable(me(after, id))).toBe(false)
    // Out for the user's next league match, then back.
    const played = play(after, 2)
    expect(isAvailable(me(played, id))).toBe(true)
  })

  test('a fine puts money in the bank', () => {
    const s = withEvent(mid, 'scandal')
    expect(resolveStory(s, 'fine', rng()).finance.balance).toBe(s.finance.balance + Number(s.story.pending!.params.fine))
  })

  test('signing the scout\'s tip adds the player to your squad', () => {
    const s = withEvent(mid, 'scoutTip')
    const after = resolveStory(s, 'sign', rng())
    expect(squad(after, after.userClubId).length).toBe(squad(s, s.userClubId).length + 1)
  })

  test('the board\'s ultimatum is judged after three matches', () => {
    const low = { ...mid, board: { ...mid.board, confidence: 30 } }
    let s = resolveStory(withEvent(low, 'ultimatum'), 'promise', rng())
    expect(s.story.ultimatum).toMatchObject({ from: mid.matchday, until: mid.matchday + 2, needed: 4 })
    s = play(s, 3)
    expect(s.story.ultimatum).toBeUndefined()
    expect(s.inbox.some((n) => n.key === 'news.story.ultimatumMet' || n.key === 'news.story.ultimatumFailed')).toBe(true)
  })

  test('fighting talk before a derby gives a small edge in that match only', () => {
    let s = mid
    for (let i = 0; i < 18 && !makeEvent(s, 'derbyTaunt', rng()); i++) s = play(s, 1)
    const e = makeEvent(s, 'derbyTaunt', rng())!
    const after = resolveStory({ ...s, story: { ...s.story, pending: e } }, 'fire', rng())
    expect(derbyEdge(after, String(e.params.fixture))).toBeGreaterThan(1)
    expect(derbyEdge(after, 'another')).toBe(1)
  })

  test('taking the job offer moves you to the new club', () => {
    let s: GameState = { ...mid, matchday: 10, fans: { ...mid.fans, mood: 90 } }
    s = withEvent(s, 'jobOffer')
    const club = String(s.story.pending!.params.offerId)
    expect(resolveStory(s, 'take', rng()).userClubId).toBe(club)
    expect(resolveStory(s, 'stay', rng()).board.confidence).toBeGreaterThan(s.board.confidence)
  })

  test('every kind of event resolves with every option, and writes the outcome to the inbox', () => {
    const kinds: EventKind[] = ['payRise', 'benchUnhappy', 'scandal', 'sponsor', 'scoutTip', 'callUp', 'wedding', 'bustUp', 'family', 'tvInterview']
    const later = play(base, 8)
    // Someone good who has hardly played, so a benchwarmer story can happen.
    const sub = squad(later, later.userClubId).sort((a, b) => a.apps - b.apps).find((p) => p.age >= 20)!
    const ready = { ...later, players: { ...later.players, [sub.id]: { ...sub, apps: 0, attrs: { ...sub.attrs, passing: 20, finishing: 20, tackling: 20, positioning: 20 } } } }
    for (const kind of kinds) {
      const s = withEvent(ready, kind)
      for (const o of s.story.pending!.options) {
        const r = resolveStory(s, o, rng())
        expect(r.story.pending).toBeNull()
        expect(r.inbox[0].key).toMatch(new RegExp(`^news\\.story\\.${kind}\\.`))
      }
    }
  })

  test('an option that was not offered changes nothing', () => {
    const s = withEvent(mid, 'tvInterview')
    expect(resolveStory(s, 'nonsense', rng())).toBe(s)
  })
})

test('a touchline ban covers exactly one matchday', () => {
  const s = { ...mid, story: { ...mid.story, ban: mid.matchday } }
  expect(touchlineBan(s)).toBe(true)
  expect(touchlineBan({ ...s, matchday: s.matchday + 1 })).toBe(false)
})
