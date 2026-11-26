import type { FormationId, Style, Tactics } from '../types'

export type Side = 'home' | 'away'
export type EventType = 'kickoff' | 'chance' | 'goal' | 'save' | 'miss' | 'yellow' | 'red' | 'injury' | 'sub' | 'push' | 'protect' | 'shout' | 'stoppage' | 'halftime' | 'fulltime'

/** How a chance came about. */
export type ChanceKind = 'cross' | 'through' | 'long' | 'counter' | 'solo' | 'corner' | 'freekick' | 'penalty'

/** What the user can shout from the touchline. */
export type Shout = 'attack' | 'calm' | 'waste' | 'encourage'

export interface MatchEvent {
  minute: number
  side?: Side
  type: EventType
  playerId?: string
  assistId?: string
  subOnId?: string
  highlight: boolean
  /** for shots: how the chance came about */
  kind?: ChanceKind
  /** for shots: chance of a goal before the roll, 0..1 */
  xg?: number
  /** for 'shout' events */
  shout?: Shout
  /** for 'stoppage' events: minutes added */
  added?: number
}

/** An AI manager's leanings, each 0..1. */
export interface MatchManager { attack: number; bold: number; youth: number }

export interface LiveTeam {
  /** minute each substitute came on */
  since?: Record<string, number>
  clubId: string
  tactics: Tactics
  /** slot-ordered (slot 0 = GK); '' = empty slot */
  onPitch: string[]
  bench: string[]
  subsUsed: number
  sentOff: string[]
}

export interface MatchState {
  /** 0..90, then stoppage time up to 90 + added */
  minute: number
  score: { home: number; away: number }
  events: MatchEvent[]
  home: LiveTeam
  away: LiveTeam
  rngState: number
  finished: boolean
  /** multiplier on home attack (fan atmosphere), default 1 */
  homeBoost: number
  /** minutes each side has had the ball */
  possession: Record<Side, number>
  sharpness?: Sharpness
  /** sides run by an AI manager */
  managers?: Partial<Record<Side, MatchManager>>
  /** −1..1; positive favours home. Swings with goals and red cards, then fades. */
  momentum?: number
  /** active shout per side and the minute it ends */
  shouts?: Partial<Record<Side, { shout: Shout; until: number }>>
  /** stoppage minutes at the end of the second half, known from minute 90 */
  added?: number
}

export type TeamChange =
  | { kind: 'sub'; offId: string; onId: string }
  | { kind: 'tactics'; formation?: FormationId; style?: Style }
  | { kind: 'shout'; shout: Shout }

/** Multipliers on a side's attack and defence. */
export type Sharpness = Partial<Record<Side, { attack: number; defence: number }>>

export interface MatchOptions {
  homeBoost?: number
  sharpness?: Sharpness
  managers?: Partial<Record<Side, MatchManager>>
}
