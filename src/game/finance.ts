import type { Club, Finance, GameState, WeekLedger } from './types'

export const TICKET_PRICE: Record<1 | 2, number> = { 1: 10, 2: 6 }
const HISTORY_CAP = 40

/** Integer crowd between 15% and 100% of capacity. */
export function attendance(club: Club, fanMood: number, leaguePosition: number, divisionSize: number, rivalry: boolean): number {
  const table = divisionSize > 1 ? (divisionSize - leaguePosition) / (divisionSize - 1) : 0.5
  const share = 0.25 + 0.5 * (fanMood / 100) + 0.1 * table + (rivalry ? 0.15 : 0)
  return Math.floor(club.capacity * Math.max(0.15, Math.min(1, share)))
}

export function weeklySponsor(club: Club): number {
  return club.reputation * 200
}

export function prizeMoney(division: 1 | 2, position: number): number {
  const v = division === 1 ? 500_000 - 50_000 * (position - 1) : 200_000 - 15_000 * (position - 1)
  return Math.max(0, v)
}

export function wageBill(state: GameState, clubId: string): number {
  let sum = 0
  for (const p of Object.values(state.players)) if (p.clubId === clubId) sum += p.wage
  return sum
}

export function divisionOf(state: GameState, clubId: string): 1 | 2 {
  return state.divisions[0].clubIds.includes(clubId) ? 1 : 2
}

/** One week of the user club's money: sponsor + tickets (home game) + prize − wages. */
export function applyWeek(state: GameState, opts: { homeAttendance?: number; prize?: number }): Finance {
  const club = state.clubs[state.userClubId]
  const div = divisionOf(state, club.id)
  const entry: WeekLedger = {
    season: state.season,
    matchday: state.matchday,
    tickets: (opts.homeAttendance ?? 0) * TICKET_PRICE[div],
    sponsor: weeklySponsor(club),
    prize: opts.prize ?? 0,
    wages: wageBill(state, club.id),
  }
  if (opts.homeAttendance !== undefined) entry.attendance = opts.homeAttendance
  const net = entry.tickets + entry.sponsor + entry.prize - entry.wages
  return { balance: state.finance.balance + net, history: [entry, ...state.finance.history].slice(0, HISTORY_CAP) }
}

export function formatRM(n: number): string {
  const s = `RM ${Math.abs(Math.round(n)).toLocaleString('en-US')}`
  return n < 0 ? `-${s}` : s
}
