export type Position = 'GK' | 'DF' | 'MF' | 'FW'
export type AttrKey =
  | 'finishing' | 'passing' | 'dribbling' | 'tackling' | 'positioning'
  | 'pace' | 'stamina' | 'strength' | 'goalkeeping' | 'composure'
/** Each attribute 1..20 */
export type Attributes = Record<AttrKey, number>

export interface Player {
  id: string
  firstName: string
  lastName: string
  age: number
  position: Position
  attrs: Attributes
  /** 1..20 ability ceiling */
  potential: number
  /** 0..100 */
  fitness: number
  /** 0..100 */
  morale: number
  clubId: string
  injuredWeeks: number
  suspendedMatches: number
  yellowCards: number
}

export interface Club {
  id: string
  name: string
  shortName: string
  district: string
  kind: 'district' | 'mukim'
  colors: [string, string]
  stadium: string
  capacity: number
  /** 1..100 */
  reputation: number
}

export type Style = 'attacking' | 'balanced' | 'defensive' | 'counter'
export type FormationId = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '5-3-2' | '4-5-1'

export interface Tactics {
  formation: FormationId
  style: Style
  /** player ids, GK first */
  lineup: string[]
  subs: string[]
}

export interface Fixture {
  id: string
  division: 1 | 2
  /** 1-based */
  round: number
  homeId: string
  awayId: string
  result?: { home: number; away: number }
}

export interface Division {
  id: 1 | 2
  clubIds: string[]
}

export interface GameState {
  version: 1
  seed: number
  rngState: number
  /** starts 2027 */
  season: number
  /** next round to play, 1-based */
  matchday: number
  userClubId: string
  clubs: Record<string, Club>
  players: Record<string, Player>
  divisions: [Division, Division]
  fixtures: Fixture[]
  /** by clubId */
  tactics: Record<string, Tactics>
}
