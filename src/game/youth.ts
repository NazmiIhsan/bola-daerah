import { generatePlayer, overall, squadQuality } from './generate'
import { wageBill } from './finance'
import { AI_SQUAD_MAX, POSITION_MIN, squad, SQUAD_MAX } from './market'
import { addNews, type NewNews } from './news'
import { applyReaction } from './reactions'
import { createRng, type Rng } from './rng'
import { fullName, type Act, type Refusal } from './transfers'
import { FREE_AGENT, type Club, type GameState, type Player, type Position, type TrainingFocus } from './types'

const POSITIONS: Position[] = ['GK', 'DF', 'MF', 'FW']
/** A comfortable number per position; the intake favours whatever is furthest below it. */
const IDEAL: Record<Position, number> = { GK: 3, DF: 8, MF: 8, FW: 4 }
const CONTRACT_YEARS = 2
export const YOUTH_TUNING = { below: 3.6, minGrowth: 1, maxGrowth: 5.1, goldenChance: 0.08, goldenBonus: 3 }

export function generateYouth(rng: Rng, club: Club, position: Position, season: number, bonus = 0): Player {
  const p = generatePlayer(rng, club.id, position, squadQuality(club) - YOUTH_TUNING.below + bonus, rng.int(16, 18))
  const ability = overall(p)
  const growth = YOUTH_TUNING.minGrowth + rng.next() * (YOUTH_TUNING.maxGrowth - YOUTH_TUNING.minGrowth)
  return { ...p, homeClubId: club.id, contractEnd: season + CONTRACT_YEARS, potential: Math.min(20, Math.max(Math.ceil(ability + 0.5), Math.round(ability + growth))) }
}

/** Three or four academy graduates, thin positions first. Now and then they are a golden generation. */
export function youthIntake(rng: Rng, state: GameState, clubId: string): Player[] {
  const count = Object.fromEntries(POSITIONS.map((pos) => [pos, 0])) as Record<Position, number>
  for (const p of squad(state, clubId)) count[p.position]++
  const bonus = rng.chance(YOUTH_TUNING.goldenChance) ? YOUTH_TUNING.goldenBonus : 0
  return Array.from({ length: rng.int(3, 4) }, () => {
    const need = (pos: Position) => count[pos] / IDEAL[pos]
    const low = Math.min(...POSITIONS.map(need))
    const position = low < 0.75 ? POSITIONS.find((pos) => need(pos) === low)! : rng.pick(['DF', 'DF', 'MF', 'MF', 'FW', 'GK'] as Position[])
    count[position]++
    return generateYouth(rng, state.clubs[clubId], position, state.season, bonus)
  })
}

/** What a player is worth keeping for: ability now, plus some credit for the future. */
const keepValue = (p: Player) => overall(p) + (p.age <= 22 ? 0.6 * Math.max(0, p.potential - overall(p)) : 0) - (p.age >= 33 ? 1 : 0)

/** Every AI club adds its intake and lets its least useful players go. */
export function aiIntake(state: GameState, rng: Rng): GameState {
  const players = { ...state.players }
  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId && state.career.kind === 'employed') continue
    let mates = [...squad(state, club.id), ...youthIntake(rng, state, club.id)]
    for (const p of mates) players[p.id] = p
    while (mates.length > AI_SQUAD_MAX) {
      const spare = mates.filter((p) => mates.filter((x) => x.position === p.position).length > POSITION_MIN[p.position])
      const worst = spare.reduce((a, b) => (keepValue(b) < keepValue(a) ? b : a))
      players[worst.id] = { ...worst, clubId: FREE_AGENT }
      mates = mates.filter((p) => p.id !== worst.id)
    }
  }
  return { ...state, players }
}

/** Half-star rating, 0.5..5, for an ability or potential of 1..20. */
export function stars(v: number): number {
  return Math.max(0.5, Math.min(5, Math.round(v / 2) / 2))
}

export const playerStars = (p: Player) => stars(overall(p))

/** The scout's guess at potential, in stars. Wider for younger players; the truth is always inside. */
export function scoutRange(p: Player): { lo: number; hi: number } {
  const width = p.age <= 18 ? 5 : p.age <= 21 ? 3.5 : p.age <= 24 ? 2 : 0.5
  let h = 17
  for (const ch of p.id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0
  const below = createRng(h).next()
  const floor = Math.min(p.potential, overall(p))
  return { lo: stars(Math.max(floor, p.potential - width * below)), hi: stars(Math.min(20, p.potential + width * (1 - below))) }
}

/** Promote an academy candidate to the first-team squad. */
export function signYouth(state: GameState, playerId: string, rng: Rng): Act<{ kind: 'signed' } | { kind: 'refused'; reason: Refusal }> {
  const refuse = (reason: Refusal) => ({ state, outcome: { kind: 'refused' as const, reason } })
  const me = state.userClubId
  if (state.career.kind === 'sacked') return refuse('sacked')
  const p = state.youth.intake.find((x) => x.id === playerId)
  if (!p) return refuse('gone')
  if (squad(state, me).length >= SQUAD_MAX) return refuse('squadFull')
  if (wageBill(state, me) + p.wage > state.transfers.budgets[me].wage) return refuse('wageBudget')
  const s: GameState = { ...state, players: { ...state.players, [p.id]: p }, youth: { intake: state.youth.intake.filter((x) => x.id !== p.id) } }
  return { state: addNews(s, [{ kind: 'youth', key: 'news.youth.signed', params: { clubId: me, player: fullName(p) } }], rng), outcome: { kind: 'signed' } }
}

export function releaseYouth(state: GameState, playerId: string): GameState {
  if (state.career.kind === 'sacked' || !state.youth.intake.some((p) => p.id === playerId)) return state
  return { ...state, youth: { intake: state.youth.intake.filter((p) => p.id !== playerId) } }
}

export function setTraining(state: GameState, focus: TrainingFocus): GameState {
  return state.career.kind === 'sacked' || state.training === focus ? state : { ...state, training: focus }
}

const WONDERKID = 3

export function wonderkidNews(state: GameState, kids: Player[]): NewNews[] {
  return kids
    .filter((p) => p.homeClubId && p.potential >= squadQuality(state.clubs[p.homeClubId]) + WONDERKID)
    .map((p) => ({ kind: 'youth', key: 'news.youth.wonderkid', params: { clubId: p.homeClubId!, player: fullName(p) }, important: p.homeClubId === state.userClubId }))
}

/** Season-start news about the user's new academy candidates. */
export function intakeNews(state: GameState): NewNews[] {
  const kids = state.youth.intake
  if (kids.length === 0) return []
  return [{ kind: 'youth', key: 'news.youth.intake', params: { clubId: state.userClubId, n: kids.length }, important: true }, ...wonderkidNews(state, kids).slice(0, 1)]
}

export const INTAKE_DEADLINE = 6
const LOCAL_AGE = 21
const BREAKTHROUGH_APPS = 8

/** Debuts and breakthroughs of homegrown youngsters, and the deadline for deciding on the intake. */
export function youthWeek(before: GameState, after: GameState, rng: Rng): GameState {
  let s = after
  for (const p of squad(after, after.userClubId)) {
    if (p.homeClubId !== after.userClubId || p.age > LOCAL_AGE) continue
    const apps = before.players[p.id]?.apps ?? 0
    if (p.apps <= apps) continue
    const params = { clubId: after.userClubId, player: fullName(p), n: p.age }
    if (!p.debuted) {
      s = applyReaction({ ...s, players: { ...s.players, [p.id]: { ...p, debuted: true } } }, { fanDelta: 2, boardDelta: 0, reasons: [{ key: 'fans.reason.debut', params: { player: fullName(p) } }] })
      s = addNews(s, [{ kind: 'youth', key: 'news.youth.debut', params }], rng)
    } else if (p.apps === BREAKTHROUGH_APPS) {
      s = applyReaction(s, { fanDelta: 1, boardDelta: 0, reasons: [{ key: 'fans.reason.breakthrough', params: { player: fullName(p) } }] })
      s = addNews(s, [{ kind: 'youth', key: 'news.youth.breakthrough', params }], rng)
    }
  }
  return s.matchday > INTAKE_DEADLINE && s.youth.intake.length ? { ...s, youth: { intake: [] } } : s
}
