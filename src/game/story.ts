import { addNews, type NewNews } from './news'
import { applyReaction } from './reactions'
import { formatRM } from './finance'
import { respondToOffer, movePlayer } from './transfers'
import { takeJob } from './career'
import { isKeyPlayer, squad, SQUAD_MAX } from './market'
import { generatePlayer, overall, wageFor } from './generate'
import { isRivalry } from './rivals'
import { computeTable } from './table'
import { newManager } from './manager'
import type { Rng } from './rng'
import type { EventKind, GameState, Player, StoryEvent, StoryState } from './types'

/** Tuning for how often things happen. */
export const STORY = {
  /** chance of a choice event in a week with none forced */
  choice: 0.45,
  /** weeks before the same kind of event can come back */
  cooldown: 8,
  dengue: 0.03,
  viral: 0.035,
  managerSacked: 0.05,
  ban: 0.04,
  promiseWeeks: 4,
  ultimatumBelow: 35,
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)))
const week = (s: Pick<GameState, 'season' | 'matchday'>) => s.season * 100 + s.matchday
const fullName = (p: Player) => `${p.firstName} ${p.lastName}`

export const emptyStory = (): StoryState => ({ pending: null, last: {}, promises: [] })
const storyOf = (s: GameState): StoryState => s.story ?? emptyStory()

function setStory(s: GameState, patch: Partial<StoryState>): GameState {
  return { ...s, story: { ...storyOf(s), ...patch } }
}

function morale(s: GameState, ids: string[], delta: number): GameState {
  const players = { ...s.players }
  for (const id of ids) if (players[id]) players[id] = { ...players[id], morale: clamp(players[id].morale + delta) }
  return { ...s, players }
}

function patchPlayer(s: GameState, id: string, patch: Partial<Player>): GameState {
  return s.players[id] ? { ...s, players: { ...s.players, [id]: { ...s.players[id], ...patch } } } : s
}

const react = (s: GameState, fanDelta: number, boardDelta: number, key = 'fans.reason.story') =>
  applyReaction(s, { fanDelta, boardDelta, reasons: [{ key }] })

const money = (s: GameState, delta: number): GameState => ({ ...s, finance: { ...s.finance, balance: s.finance.balance + delta } })

/** The user's players who could be in a story: on the books and not already unavailable. */
function mine(s: GameState): Player[] {
  return squad(s, s.userClubId).filter((p) => p.injuredWeeks === 0 && !p.away)
}

/** The user's league position, 1-based. */
function position(s: GameState): { pos: number; size: number } {
  const d = s.divisions.find((x) => x.clubIds.includes(s.userClubId))!
  const table = computeTable(d.clubIds, s.fixtures.filter((f) => f.division === d.id))
  return { pos: table.findIndex((r) => r.clubId === s.userClubId) + 1, size: table.length }
}

const nextFixture = (s: GameState) => s.fixtures.find((f) => f.round === s.matchday && (f.homeId === s.userClubId || f.awayId === s.userClubId))

/** League points the user took in rounds from..until. */
function pointsBetween(s: GameState, from: number, until: number): number {
  let pts = 0
  for (const f of s.fixtures) {
    if (!f.result || f.round < from || f.round > until) continue
    if (f.homeId !== s.userClubId && f.awayId !== s.userClubId) continue
    const [me, them] = f.homeId === s.userClubId ? [f.result.home, f.result.away] : [f.result.away, f.result.home]
    pts += me > them ? 3 : me === them ? 1 : 0
  }
  return pts
}

/** Event details the news needs: no internal ids (news reads every "...Id" as a club). */
const PRIVATE = new Set(['playerId', 'aId', 'bId', 'fixture', 'kid', 'bid'])
const MONEY = new Set(['fee', 'wage', 'fine', 'amount'])
/** An event's details ready for text: no internal ids, money written as RM. */
export const storyParams = (p: StoryEvent['params']): Record<string, string | number> =>
  Object.fromEntries(Object.entries(p).filter(([k]) => !PRIVATE.has(k)).map(([k, v]) => [k, MONEY.has(k) ? formatRM(Number(v)) : v]))
const newsParams = storyParams

/** Turn an event into the inbox item that records it. */
function eventNews(s: GameState, e: StoryEvent): NewNews {
  return { kind: 'story', key: `news.story.${e.kind}`, params: { ...newsParams(e.params), clubId: s.userClubId }, important: true }
}

// ─── Choice events ─────────────────────────────────────────────────────────────

type Maker = (s: GameState, rng: Rng) => Omit<StoryEvent, 'id' | 'season' | 'matchday' | 'kind'> | null

const MAKERS: Partial<Record<EventKind, { weight: number; make: Maker }>> = {
  payRise: {
    weight: 1.2,
    make: (s, rng) => {
      const promised = new Set(storyOf(s).promises.map((p) => p.playerId))
      const c = mine(s).filter((p) => isKeyPlayer(s, p) && !promised.has(p.id) && p.contractEnd > s.season)
      if (!c.length) return null
      const p = rng.pick(c)
      return { params: { playerId: p.id, player: fullName(p), wage: Math.round((p.wage * 1.25) / 10) * 10 }, options: ['give', 'promise', 'refuse'] }
    },
  },
  benchUnhappy: {
    weight: 1,
    make: (s, rng) => {
      if (s.matchday < 6) return null
      const all = squad(s, s.userClubId)
      const median = all.map(overall).sort((a, b) => a - b)[Math.floor(all.length / 2)] ?? 0
      const c = mine(s).filter((p) => p.age >= 20 && overall(p) >= median && p.apps < (s.matchday - 1) * 0.35 && !p.listed)
      if (!c.length) return null
      const p = rng.pick(c)
      return { params: { playerId: p.id, player: fullName(p) }, options: ['talk', 'list', 'ignore'] }
    },
  },
  derbyTaunt: {
    weight: 3,
    make: (s) => {
      const f = nextFixture(s)
      if (!f) return null
      const oppId = f.homeId === s.userClubId ? f.awayId : f.homeId
      if (!isRivalry(s.clubs[s.userClubId], s.clubs[oppId])) return null
      const m = s.managers?.[oppId]
      return { params: { fixture: f.id, oppId, rival: m?.name ?? '' }, options: ['fire', 'calm', 'quiet'] }
    },
  },
  ultimatum: {
    weight: 2.5,
    make: (s) => (s.board.confidence < STORY.ultimatumBelow && !storyOf(s).ultimatum && s.matchday >= 4 && s.matchday <= 15 ? { params: {}, options: ['promise', 'patience'] } : null),
  },
  scandal: {
    weight: 0.8,
    make: (s, rng) => {
      const c = mine(s).filter((p) => p.age >= 19)
      if (!c.length) return null
      const p = rng.pick(c)
      return { params: { playerId: p.id, player: fullName(p), fine: p.wage * 2 }, options: ['fine', 'drop', 'defend'] }
    },
  },
  sponsor: {
    weight: 0.8,
    make: (s, rng) => {
      const amount = Math.round((s.clubs[s.userClubId].reputation * 1500 * (0.8 + rng.next() * 0.6)) / 1000) * 1000
      return { params: { amount, catch: rng.pick(['betting', 'energy', 'durian']) }, options: ['accept', 'decline'] }
    },
  },
  scoutTip: {
    weight: 0.9,
    make: (s, rng) => {
      if (squad(s, s.userClubId).length >= SQUAD_MAX) return null
      const mukims = Object.values(s.clubs).filter((c) => c.district === s.clubs[s.userClubId].district).map((c) => c.name)
      const avg = squad(s, s.userClubId).reduce((n, p) => n + overall(p), 0) / Math.max(1, squad(s, s.userClubId).length)
      const pos = rng.pick(['DF', 'MF', 'FW'] as const)
      const kid = { ...generatePlayer(rng, 'free', pos, Math.max(6, Math.round(avg) - 2), rng.int(17, 19)), potential: Math.min(20, Math.round(avg) + rng.int(2, 5)) }
      return { params: { player: fullName(kid), pos, place: rng.pick(mukims.length ? mukims : [s.clubs[s.userClubId].name]), kid: JSON.stringify(kid) }, options: ['sign', 'pass'] }
    },
  },
  callUp: {
    weight: 0.7,
    make: (s, rng) => {
      const c = mine(s).filter((p) => overall(p) >= 13.5 && p.age <= 31)
      return c.length ? (() => { const p = rng.pick(c); return { params: { playerId: p.id, player: fullName(p) }, options: ['go', 'keep'] } })() : null
    },
  },
  wedding: {
    weight: 0.6,
    make: (s, rng) => {
      const c = mine(s).filter((p) => p.age >= 23)
      return c.length ? (() => { const p = rng.pick(c); return { params: { playerId: p.id, player: fullName(p), what: rng.pick(['wedding', 'baby']) }, options: ['off', 'stay'] } })() : null
    },
  },
  bustUp: {
    weight: 0.7,
    make: (s, rng) => {
      const c = mine(s)
      if (c.length < 2) return null
      const a = rng.pick(c)
      const b = rng.pick(c.filter((p) => p.id !== a.id))
      return { params: { aId: a.id, a: fullName(a), bId: b.id, b: fullName(b) }, options: ['backA', 'backB', 'fineBoth'] }
    },
  },
  family: {
    weight: 0.6,
    make: (s, rng) => {
      const c = mine(s)
      return c.length ? (() => { const p = rng.pick(c); return { params: { playerId: p.id, player: fullName(p) }, options: ['go', 'stay'] } })() : null
    },
  },
  jobOffer: {
    weight: 0.5,
    make: (s, rng) => {
      if (s.matchday < 8) return null
      const { pos } = position(s)
      if (pos > 3 && s.fans.mood < 75) return null
      const rep = s.clubs[s.userClubId].reputation
      const c = Object.values(s.clubs).filter((c) => c.id !== s.userClubId && c.reputation >= rep + 3)
      if (!c.length) return null
      const club = rng.pick(c)
      return { params: { offerId: club.id }, options: ['take', 'stay'] }
    },
  },
  tvInterview: {
    weight: 0.8,
    make: () => ({ params: {}, options: ['confident', 'humble', 'combative'] }),
  },
}

/** One event of a given kind for the current week, if it can happen now (tests and tools). */
export function makeEvent(s: GameState, kind: EventKind, rng: Rng): StoryEvent | null {
  const made = MAKERS[kind]?.make(s, rng)
  return made ? { id: `${s.season}-${s.matchday}-${kind}`, kind, season: s.season, matchday: s.matchday, ...made } : null
}

/** Pick this week's choice event, if any. A big bid or a promise coming due always comes first. */
function chooseEvent(before: GameState, s: GameState, rng: Rng): StoryEvent | null {
  const base = { season: s.season, matchday: s.matchday }
  const id = (kind: EventKind) => `${s.season}-${s.matchday}-${kind}`
  // A promise that comes due
  const due = storyOf(s).promises.find((p) => p.due <= s.matchday && s.players[p.playerId]?.clubId === s.userClubId)
  if (due) {
    const p = s.players[due.playerId]
    return { ...base, id: id('promiseDue'), kind: 'promiseDue', params: { playerId: p.id, player: fullName(p), wage: due.wage }, options: ['pay', 'break'] }
  }
  // A big bid for one of the user's best players
  const known = new Set(before.transfers.offers.map((o) => o.id))
  const bid = s.transfers.offers.find((o) => !known.has(o.id) && s.players[o.playerId] && isKeyPlayer(s, s.players[o.playerId]))
  if (bid) {
    const p = s.players[bid.playerId]
    return { ...base, id: id('bigBid'), kind: 'bigBid', params: { bid: bid.id, playerId: p.id, player: fullName(p), buyerId: bid.clubId, fee: bid.fee }, options: ['accept', 'negotiate', 'reject'] }
  }
  if (!rng.chance(STORY.choice)) return null
  const now = week(s)
  const cands: Array<[EventKind, number, NonNullable<ReturnType<Maker>>]> = []
  for (const [kind, m] of Object.entries(MAKERS) as Array<[EventKind, { weight: number; make: Maker }]>) {
    const last = storyOf(s).last[kind]
    if (last !== undefined && now - last < STORY.cooldown && Math.floor(last / 100) === s.season) continue
    const made = m.make(s, rng)
    if (made) cands.push([kind, m.weight, made])
  }
  if (!cands.length) return null
  let x = rng.next() * cands.reduce((n, [, w]) => n + w, 0)
  for (const [kind, w, made] of cands) {
    x -= w
    if (x <= 0) return { ...base, id: id(kind), kind, ...made }
  }
  const [kind, , made] = cands[cands.length - 1]
  return { ...base, id: id(kind), kind, ...made }
}

// ─── Things that just happen ──────────────────────────────────────────────────

function randomHappenings(s: GameState, rng: Rng): { state: GameState; news: NewNews[] } {
  const news: NewNews[] = []
  const me = s.userClubId
  // Dengue
  if (rng.chance(STORY.dengue)) {
    const c = mine(s)
    if (c.length) {
      const p = rng.pick(c)
      const weeks = rng.int(2, 3)
      s = patchPlayer(s, p.id, { injuredWeeks: weeks })
      news.push({ kind: 'story', key: 'news.story.dengue', params: { clubId: me, player: fullName(p), n: weeks }, important: true, breaking: isKeyPlayer(s, p) })
    }
  }
  // Viral clip
  if (rng.chance(STORY.viral)) {
    const c = mine(s)
    if (c.length) {
      const p = rng.pick(c)
      s = react(morale(s, [p.id], 10), 2, 0)
      news.push({ kind: 'story', key: 'news.story.viral', params: { clubId: me, player: fullName(p) }, breaking: true })
    }
  }
  // Rival managers under pressure
  if (s.matchday >= 8) {
    for (const d of s.divisions) {
      const table = computeTable(d.clubIds, s.fixtures.filter((f) => f.division === d.id))
      for (const row of table.slice(-2)) {
        const id = row.clubId
        const m = s.managers?.[id]
        if (id === me || !m || m.since === s.season || !rng.chance(STORY.managerSacked)) continue
        const fresh = newManager(rng, s.season)
        s = { ...s, managers: { ...s.managers, [id]: fresh } }
        news.push({ kind: 'league', key: 'news.story.managerSacked', params: { clubId: id, old: m.name, new: fresh.name }, breaking: true })
        break
      }
    }
  }
  // Touchline ban after a defeat
  const last = s.fixtures.find((f) => f.round === s.matchday - 1 && f.result && (f.homeId === me || f.awayId === me))
  if (last?.result) {
    const [a, b] = last.homeId === me ? [last.result.home, last.result.away] : [last.result.away, last.result.home]
    if (a < b && rng.chance(STORY.ban)) {
      s = setStory(s, { ban: s.matchday })
      news.push({ kind: 'story', key: 'news.story.ban', params: { clubId: me }, important: true, breaking: true })
    }
  }
  return { state: s, news }
}

/** Promises, ultimatums, derby talk and Ramadan move on with the calendar. */
function settle(before: GameState, s: GameState, rng: Rng): { state: GameState; news: NewNews[] } {
  const news: NewNews[] = []
  const me = s.userClubId
  let st = storyOf(s)
  // The board's ultimatum is judged once its matches are played
  if (st.ultimatum && s.matchday > st.ultimatum.until) {
    const pts = pointsBetween(s, st.ultimatum.from, st.ultimatum.until)
    const ok = pts >= st.ultimatum.needed
    s = react(s, 0, ok ? 15 : -25)
    news.push({ kind: 'board', key: ok ? 'news.story.ultimatumMet' : 'news.story.ultimatumFailed', params: { clubId: me, n: pts }, important: true, breaking: true })
    st = { ...storyOf(s), ultimatum: undefined }
    s = { ...s, story: st }
  }
  // Fighting talk before the derby, once it has been played
  if (st.derby) {
    const f = s.fixtures.find((x) => x.id === st.derby!.fixtureId)
    if (f?.result) {
      const [a, b] = f.homeId === me ? [f.result.home, f.result.away] : [f.result.away, f.result.home]
      if (st.derby.stance === 'fire') s = react(s, a > b ? 6 : a < b ? -8 : 0, 0, a > b ? 'fans.reason.derbyTalkWon' : 'fans.reason.derbyTalkLost')
      s = setStory(s, { derby: undefined })
    } else if (!f || f.round < s.matchday - 1) s = setStory(s, { derby: undefined })
    st = storyOf(s)
  }
  if (st.ban !== undefined && st.ban < before.matchday) s = setStory(s, { ban: undefined })
  // Ramadan: a few weeks each season with heavier legs
  if (!st.ramadan || st.ramadan.season !== s.season) {
    const from = rng.int(6, 12)
    s = setStory(s, { ramadan: { season: s.season, from, to: from + 2 } })
  }
  const r = storyOf(s).ramadan!
  if (s.matchday === r.from) news.push({ kind: 'story', key: 'news.story.ramadanStart', params: { clubId: me }, breaking: true })
  if (s.matchday === r.to + 1) news.push({ kind: 'story', key: 'news.story.ramadanEnd', params: { clubId: me } })
  return { state: s, news }
}

/** True while Ramadan weeks are on (matches tire players more). */
export function isRamadan(s: Pick<GameState, 'season' | 'matchday' | 'story'>): boolean {
  const r = s.story?.ramadan
  return !!r && r.season === s.season && s.matchday >= r.from && s.matchday <= r.to
}

/** The user cannot shout from the touchline in this matchday's match. */
export const touchlineBan = (s: Pick<GameState, 'matchday' | 'story'>) => s.story?.ban === s.matchday

/** A small edge (or none) for the user in the derby they talked up. */
export function derbyEdge(s: Pick<GameState, 'story'>, fixtureId: string): number {
  return s.story?.derby?.fixtureId === fixtureId && s.story.derby.stance === 'fire' ? 1.04 : 1
}

/**
 * The week's stories, after a league matchday: things that just happen, the calendar moving on
 * and maybe one breaking story for the user to decide. Only the user's club is touched.
 */
export function storyWeek(before: GameState, after: GameState, rng: Rng): GameState {
  if (after.career.kind === 'sacked') return after
  let s: GameState = after.story ? after : { ...after, story: emptyStory() }
  const settled = settle(before, s, rng)
  s = settled.state
  const happened = randomHappenings(s, rng)
  s = happened.state
  const news = [...settled.news, ...happened.news]
  if (!storyOf(s).pending) {
    const e = chooseEvent(before, s, rng)
    if (e) {
      s = setStory(s, { pending: e, last: { ...storyOf(s).last, [e.kind]: week(s) } })
      news.push(eventNews(s, e))
    }
  }
  return addNews(s, news, rng)
}

// ─── The user's decision ──────────────────────────────────────────────────────

/** Apply the user's choice for the pending story. Choices the story no longer allows just close it. */
export function resolveStory(state: GameState, option: string, rng: Rng): GameState {
  const e = storyOf(state).pending
  if (!e || !e.options.includes(option)) return state
  let s = setStory(state, { pending: null })
  const p = e.params
  const id = String(p.playerId ?? '')
  const stillMine = (pid: string) => s.players[pid]?.clubId === s.userClubId
  let outcome = option
  switch (e.kind) {
    case 'bigBid': {
      const answer = option as 'accept' | 'negotiate' | 'reject'
      const r = respondToOffer(s, String(p.bid), answer, rng)
      s = r.state
      outcome = r.outcome.kind === 'refused' ? 'gone' : r.outcome.kind
      if (answer === 'reject' && stillMine(id)) s = morale(s, [id], -8)
      break
    }
    case 'payRise':
      if (!stillMine(id)) { outcome = 'gone'; break }
      if (option === 'give') s = morale(patchPlayer(s, id, { wage: Number(p.wage) }), [id], 15)
      if (option === 'promise') s = morale(setStory(s, { promises: [...storyOf(s).promises, { playerId: id, due: s.matchday + STORY.promiseWeeks, wage: Number(p.wage) }] }), [id], 5)
      if (option === 'refuse') s = morale(s, [id], -20)
      break
    case 'promiseDue':
      s = setStory(s, { promises: storyOf(s).promises.filter((x) => x.playerId !== id) })
      if (!stillMine(id)) { outcome = 'gone'; break }
      if (option === 'pay') s = morale(patchPlayer(s, id, { wage: Math.max(s.players[id].wage, Number(p.wage)) }), [id], 12)
      else s = react(morale(s, [id], -30), -3, 0)
      break
    case 'benchUnhappy':
      if (!stillMine(id)) { outcome = 'gone'; break }
      if (option === 'talk') { const ok = rng.chance(0.6); s = morale(s, [id], ok ? 10 : -10); outcome = ok ? 'talkOk' : 'talkBad' }
      if (option === 'list') s = morale(patchPlayer(s, id, { listed: true }), [id], 5)
      if (option === 'ignore') s = morale(s, [id], -15)
      break
    case 'derbyTaunt':
      s = setStory(s, { derby: { fixtureId: String(p.fixture), stance: option as 'fire' | 'calm' | 'quiet' } })
      if (option === 'fire') s = react(s, 3, 0)
      if (option === 'calm') s = react(s, 0, 3)
      break
    case 'ultimatum':
      if (option === 'promise') s = react(setStory(s, { ultimatum: { from: s.matchday, until: s.matchday + 2, needed: 4 } }), 0, 10)
      else s = react(s, 0, -5)
      break
    case 'scandal':
      if (!stillMine(id)) { outcome = 'gone'; break }
      if (option === 'fine') s = morale(money(s, Number(p.fine)), [id], -15)
      if (option === 'drop') s = react(morale(patchPlayer(s, id, { away: (s.players[id].away ?? 0) + 1 }), [id], -5), 3, 0)
      if (option === 'defend') s = react(morale(s, [id], 10), -4, -4)
      break
    case 'sponsor':
      if (option === 'accept') {
        s = money(s, Number(p.amount))
        if (p.catch === 'betting') s = react(s, -8, -3)
        if (p.catch === 'durian') s = react(s, 2, 0)
      }
      break
    case 'scoutTip':
      if (option === 'sign' && squad(s, s.userClubId).length < SQUAD_MAX) {
        const kid = JSON.parse(String(p.kid)) as Player
        s = { ...s, players: { ...s.players, [kid.id]: { ...kid, clubId: 'free' } } }
        s = movePlayer(s, kid.id, s.userClubId, { fee: 0, wage: wageFor(kid, s.clubs[s.userClubId]), contractEnd: s.season + 3 })
      } else if (option === 'sign') outcome = 'full'
      break
    case 'callUp':
      if (!stillMine(id)) { outcome = 'gone'; break }
      s = option === 'go' ? morale(patchPlayer(s, id, { away: (s.players[id].away ?? 0) + 1 }), [id], 10) : morale(s, [id], -15)
      if (option === 'go') s = react(s, 2, 0)
      break
    case 'wedding':
    case 'family':
      if (!stillMine(id)) { outcome = 'gone'; break }
      if (option === 'off' || option === 'go') s = morale(patchPlayer(s, id, { away: (s.players[id].away ?? 0) + 1 }), [id], e.kind === 'wedding' ? 15 : 8)
      else s = morale(s, [id], e.kind === 'wedding' ? -5 : -12)
      break
    case 'bustUp': {
      const a = String(p.aId), b = String(p.bId)
      if (option === 'backA') s = morale(morale(s, [a], 10), [b], -15)
      if (option === 'backB') s = morale(morale(s, [b], 10), [a], -15)
      if (option === 'fineBoth') s = morale(money(s, Math.round(((s.players[a]?.wage ?? 0) + (s.players[b]?.wage ?? 0)) / 2)), [a, b], -5)
      break
    }
    case 'jobOffer':
      if (option === 'take') s = takeJob(s, String(p.offerId))
      else s = react(s, 8, 10, 'fans.reason.loyal')
      break
    case 'tvInterview':
      if (option === 'confident') s = react(s, 4, 0)
      if (option === 'humble') s = react(s, 0, 3)
      if (option === 'combative') s = react(s, 6, -3)
      break
  }
  const inbox = s.inbox.map((n) => (n.key === `news.story.${e.kind}` && n.season === e.season && n.matchday === e.matchday ? { ...n, read: true } : n))
  return addNews({ ...s, inbox }, [{ kind: 'story', key: `news.story.${e.kind}.${outcome}`, params: { ...newsParams(p), clubId: state.userClubId } }], rng)
}
