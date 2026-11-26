/** `clubId` of players without a club. */
export const FREE_AGENT = 'free'

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
  /** club id, or FREE_AGENT */
  clubId: string
  injuredWeeks: number
  suspendedMatches: number
  yellowCards: number
  /** RM per week */
  wage: number
  /** last season of the deal */
  contractEnd: number
  /** on the transfer list */
  listed?: boolean
  /** matches missed for personal reasons (call-up, wedding, family, dropped) */
  away?: number
  /** matches played this season */
  apps: number
  /** this season */
  goals: number
  assists: number
  /** sum of match ratings, for the average */
  ratingSum: number
  /** how many matches that sum covers */
  rated: number
  /** overall when the season began */
  ovrStart: number
  /** the club whose academy produced the player */
  homeClubId?: string
  /** homegrown player who has already had a first-team debut */
  debuted?: boolean
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

export const TRAINING_FOCUSES = ['balanced', 'attack', 'defence', 'fitness', 'youth'] as const
export type TrainingFocus = (typeof TRAINING_FOCUSES)[number]

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
  /** a cup tie shown as a fixture; `division` means nothing then */
  cup?: boolean
}

export interface CupTie { id: string; homeId: string; awayId: string; result?: { home: number; away: number }; pens?: { home: number; away: number }; winnerId?: string }
/** The last round is the one being played. `waiting` = clubs that enter in the next round. */
export interface Cup { waiting: string[]; rounds: CupTie[][] }

export interface Division {
  id: 1 | 2
  clubIds: string[]
}

/** A club's manager: touchline leanings, favourite shapes and a name. */
export interface ManagerProfile {
  name: string
  /** each 0..1 */
  attack: number
  bold: number
  youth: number
  formations: [FormationId, FormationId]
  /** season they took over */
  since: number
}

export type EventKind =
  | 'bigBid' | 'payRise' | 'promiseDue' | 'benchUnhappy' | 'derbyTaunt' | 'ultimatum' | 'scandal' | 'sponsor'
  | 'scoutTip' | 'callUp' | 'wedding' | 'bustUp' | 'family' | 'jobOffer' | 'tvInterview'

/** A breaking story waiting for the user's decision. Params ending in "Id" are ids. */
export interface StoryEvent { id: string; kind: EventKind; season: number; matchday: number; params: Record<string, string | number>; options: string[] }

export interface StoryState {
  pending: StoryEvent | null
  /** week index (season * 100 + matchday) each kind last happened */
  last: Partial<Record<EventKind, number>>
  /** pay rises promised for later */
  promises: Array<{ playerId: string; due: number; wage: number }>
  /** the board's demand: `needed` league points from the matches in `from..until` */
  ultimatum?: { from: number; until: number; needed: number }
  /** how the user answered the rival manager before a derby */
  derby?: { fixtureId: string; stance: 'fire' | 'calm' | 'quiet' }
  /** matchday of the user's touchline ban */
  ban?: number
  /** this season's Ramadan weeks */
  ramadan?: { season: number; from: number; to: number }
}

export interface GameState {
  version: 6
  /** the user's name as a manager; '' until asked */
  managerName: string
  /** every club's manager, by clubId */
  managers: Record<string, ManagerProfile>
  story: StoryState
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
  fans: FanState
  board: BoardState
  finance: Finance
  inbox: NewsItem[]
  press: PressConference | null
  career: CareerStatus
  transfers: TransferState
  /** hidden season form by clubId, around 1 */
  form: Record<string, number>
  training: TrainingFocus
  /** this season's academy candidates, waiting for the user's decision */
  youth: { intake: Player[] }
  /** finished seasons, newest first */
  history: SeasonRecord[]
  /** null until the first full season after an older save was updated */
  cup: Cup | null
}

export interface Award { name: string; clubId: string; value: number }
export interface SeasonRecord {
  season: number
  /** division 1, division 2 */
  champions: [string, string]
  me: { clubId: string; division: 1 | 2; position: number; points: number }
  goldenBoot: [Award | null, Award | null]
  bestPlayer: [Award | null, Award | null]
  cup: { winnerId: string; runnerUpId: string } | null
}

export type Expectation = 'title' | 'promotion' | 'topHalf' | 'midTable' | 'avoidRelegation'
export interface FanLogEntry { season: number; matchday: number; delta: number; reason: string; params?: Record<string, string | number> }
/** mood 0..100; log newest first, max 12 */
export interface FanState { mood: number; log: FanLogEntry[] }
export interface BoardState { expectation: Expectation; targetPosition: number; confidence: number }
export interface WeekLedger { season: number; matchday: number; tickets: number; sponsor: number; prize: number; wages: number; attendance?: number; /** net transfer fees */ transfers?: number }
/** history newest first, max 40; transferNet = net fees since the last ledger entry */
export interface Finance { balance: number; history: WeekLedger[]; transferNet: number }
export type NewsKind = 'match' | 'league' | 'fans' | 'board' | 'press' | 'finance' | 'career' | 'transfer' | 'youth' | 'story'
export interface NewsItem { id: string; season: number; matchday: number; kind: NewsKind; key: string; params: Record<string, string | number>; variant: number; read: boolean; important?: boolean; breaking?: boolean }
export type Answer = 'confident' | 'humble' | 'combative'
export interface PressQuestion { key: string; params: Record<string, string | number> }
export interface PressConference { kind: 'pre' | 'post'; fixtureId: string; questions: PressQuestion[] }
export type CareerStatus = { kind: 'employed' } | { kind: 'sacked'; offers: string[] }

export interface Budget { transfer: number; wage: number }
/** `expires` = last matchday it can be accepted */
export interface IncomingOffer { id: string; playerId: string; clubId: string; fee: number; expires: number; negotiated?: boolean }
export interface TransferRecord { season: number; matchday: number; playerId: string; name: string; fromId: string; toId: string; fee: number }
export interface TransferState {
  /** by clubId */
  budgets: Record<string, Budget>
  /** AI bids for the user's players */
  offers: IncomingOffer[]
  /** playerId → fee the selling club has accepted from the user */
  agreed: Record<string, number>
  /** players the user can't negotiate for until the next matchday */
  blocked: string[]
  /** newest first, max 60 */
  history: TransferRecord[]
}
