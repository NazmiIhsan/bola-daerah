import type { FormationId, Style, Tactics } from '../types'

export type Side = 'home' | 'away'
export type EventType = 'kickoff' | 'chance' | 'goal' | 'save' | 'miss' | 'yellow' | 'red' | 'injury' | 'sub' | 'halftime' | 'fulltime'

export interface MatchEvent {
  minute: number
  side?: Side
  type: EventType
  playerId?: string
  assistId?: string
  subOnId?: string
  highlight: boolean
}

export interface LiveTeam {
  clubId: string
  tactics: Tactics
  /** slot-ordered (slot 0 = GK); '' = empty slot */
  onPitch: string[]
  bench: string[]
  subsUsed: number
  sentOff: string[]
}

export interface MatchState {
  /** 0..90 */
  minute: number
  score: { home: number; away: number }
  events: MatchEvent[]
  home: LiveTeam
  away: LiveTeam
  rngState: number
  finished: boolean
  /** multiplier on home attack (fan atmosphere), default 1 */
  homeBoost: number
}

export type TeamChange =
  | { kind: 'sub'; offId: string; onId: string }
  | { kind: 'tactics'; formation?: FormationId; style?: Style }

export interface MatchOptions {
  homeBoost?: number
}
