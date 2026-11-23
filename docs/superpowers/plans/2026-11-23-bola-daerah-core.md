# Bola Daerah — Plan 1: Core Playable Season

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser game where you pick a Selangor club, set tactics, watch your matches as 2D highlights, play full seasons with promotion/relegation, in English or Bahasa Melayu, with saves.

**Architecture:** A pure TypeScript game-logic module (`src/game/`, no React or browser APIs) holds all rules and simulation, driven by a seeded RNG so everything is reproducible. A React UI (`src/ui/`) renders screens and a canvas pitch, calling into the game module. Text goes through `src/i18n/`, and persistence through `src/save/`.

**Tech Stack:** TypeScript 5.6, React 18.3.1, Vite 5.4, Vitest 2.1, @testing-library/react 16, idb-keyval 6.2.1, fake-indexeddb 6.0 (tests).

**Spec:** `docs/superpowers/specs/2026-11-23-bola-daerah-design.md`

**Later plans (not in this one):** Plan 2 Transfers & finances · Plan 3 Media, press conferences, fans & board · Plan 4 Youth intake, development & training.

## Global Constraints

- Original identity: no Football Manager name, branding or screen copies. Working title "Bola Daerah".
- Division 1 = 9 districts: Petaling, Klang, Gombak, Hulu Langat, Sepang, Kuala Selangor, Kuala Langat, Hulu Selangor, Sabak Bernam.
- Division 2 = Kapar, Damansara, Bukit Raja, Semenyih, Kajang, Rawang, Dengkil, Ijok, Serendah, Jugra.
- Double round-robin. Odd team counts get a bye. Bottom 2 of Div 1 go down and top 2 of Div 2 go up.
- `src/game/**` must not import React, DOM or browser storage.
- All randomness goes through `Rng` from `src/game/rng.ts`. Never `Math.random` in `src/game/`.
- All user-visible strings go through `t()` in English and Malay. No hard-coded UI text.
- Max 5 substitutions per match.
- Laptop-first layout that stays usable at 375px width (no horizontal page scroll).
- Club data lives in data files, not logic.

## Review Focus

1. **User's club changes division** (promoted or relegated): `userClubId` stays valid, the new season's fixtures include the user, and the UI shows the right division. Test in Task 7.
2. **Fewer than 11 fit players** (injuries/red cards/suspensions): auto-pick fills from the available squad, and a match still runs with <11 if necessary instead of crashing. Test in Tasks 5 and 6.
3. **Bad or old save file on import**: a clear error message is shown, the current game is untouched, and there's no crash. Test in Task 9.
4. **Browser storage unavailable** (private window): the game stays playable and a warning says saves won't persist. Test in Task 9.
5. **Missing Malay translation key**: falls back to English, never shows blank. Test in Task 8.

---

### Task 1: Project scaffold + seeded RNG

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `.gitignore`
- Create: `src/game/rng.ts`
- Test: `src/game/rng.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Rng { next(): number /* [0,1) */; int(min: number, max: number): number /* inclusive */; pick<T>(arr: readonly T[]): T; chance(p: number): boolean; state(): number }
  export function createRng(seed: number): Rng   // mulberry32
  ```

- [ ] **Step 1:** `git init`. Create the Vite React-TS project files by hand (pinned versions above). Add the scripts `dev`, `build`, `test` (`vitest run`). Use vitest with the `jsdom` environment for `src/ui/**`.
- [ ] **Step 2: Write failing tests** in `rng.test.ts`:
  - `same seed gives same sequence`: two `createRng(42)` produce identical 100 `next()` values.
  - `int is inclusive and in range`: 10,000 `int(1,6)` calls are all within 1..6 and hit both 1 and 6.
  - `restores from state`: `createRng(r.state())` continues the same sequence.
- [ ] **Step 3:** Run `npm test`. Expected: FAIL (module not found).
- [ ] **Step 4:** Implement `createRng` (mulberry32) in `src/game/rng.ts`.
- [ ] **Step 5:** Run `npm test`. Expected: PASS. Run `npm run build`. Expected: success.
- [ ] **Step 6:** Commit `chore: scaffold project and seeded rng`.

### Task 2: Core types, club data, player generation, new game

**Files:**
- Create: `src/game/types.ts`, `src/game/data/clubs.ts`, `src/game/data/names.ts`, `src/game/generate.ts`
- Test: `src/game/generate.test.ts`

**Interfaces:**
- Consumes: `createRng`, `Rng` (Task 1)
- Produces (`types.ts`):
  ```ts
  export type Position = 'GK' | 'DF' | 'MF' | 'FW'
  export type AttrKey = 'finishing'|'passing'|'dribbling'|'tackling'|'positioning'|'pace'|'stamina'|'strength'|'goalkeeping'|'composure'
  export type Attributes = Record<AttrKey, number>          // 1..20
  export interface Player { id: string; firstName: string; lastName: string; age: number; position: Position; attrs: Attributes; potential: number /*1..20*/; fitness: number /*0..100*/; morale: number /*0..100*/; clubId: string; injuredWeeks: number; suspendedMatches: number; yellowCards: number }
  export interface Club { id: string; name: string; shortName: string; district: string; kind: 'district' | 'mukim'; colors: [string, string]; stadium: string; capacity: number; reputation: number /*1..100*/ }
  export type Style = 'attacking' | 'balanced' | 'defensive' | 'counter'
  export type FormationId = '4-4-2'|'4-3-3'|'4-2-3-1'|'3-5-2'|'5-3-2'|'4-5-1'
  export interface Tactics { formation: FormationId; style: Style; lineup: string[] /*player ids, GK first*/; subs: string[] }
  export interface Fixture { id: string; division: 1 | 2; round: number /*1-based*/; homeId: string; awayId: string; result?: { home: number; away: number } }
  export interface Division { id: 1 | 2; clubIds: string[] }
  export interface GameState { version: 1; seed: number; rngState: number; season: number /*starts 2027*/; matchday: number /*next round to play, 1-based*/; userClubId: string; clubs: Record<string, Club>; players: Record<string, Player>; divisions: [Division, Division]; fixtures: Fixture[]; tactics: Record<string, Tactics> /*by clubId*/ }
  ```
- Produces (`generate.ts`):
  ```ts
  export function overall(p: Player): number                 // position-weighted average of attrs, 1..20
  export function generatePlayer(rng: Rng, clubId: string, position: Position, quality: number /*1..20 target overall*/, age?: number): Player
  export function newGame(seed: number, userClubId: string): GameState
  ```
- `clubs.ts` exports `CLUBS: Club[]` (19 clubs) and `DIVISION_1_IDS`, `DIVISION_2_IDS`. Ids are lowercase slugs (`'petaling'`, `'kapar'`, `'bukit-raja'`). District clubs have reputation 55–80 (Petaling, Klang highest; Sabak Bernam lowest) and mukim clubs 30–55. The builder picks names, colours and stadiums.
- `names.ts`: Malay, Chinese, Indian, and a few foreign name lists. Generated mix is roughly 60/20/15/5.

- [ ] **Step 1: Write failing tests:**
  - `newGame creates 19 clubs, 9 in div 1 and 10 in div 2`.
  - `every club has 22–25 players with at least 2 GK, 6 DF, 6 MF, 3 FW`.
  - `stronger reputation means stronger squad`: average top-16 `overall` for `petaling` > for `jugra`.
  - `newGame is deterministic`: `newGame(7,'kapar')` deep-equals another `newGame(7,'kapar')`.
  - `attributes are within 1..20` and `ages within 16..36` for every player.
  - `every club has valid tactics`: 11 unique lineup ids from its own squad, `lineup[0]` is a GK.
- [ ] **Step 2:** Run `npm test -- generate`. Expected: FAIL.
- [ ] **Step 3:** Implement. Squad quality is derived from reputation (rep 80 → ~13 overall, rep 30 → ~7). `newGame` uses `pickBestLineup` once Task 5 exists. Until then, a temporary simple pick (first GK + next 10 outfielders) is fine as long as Task 5 replaces it.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(game): types, clubs, player generation, new game`.

> Note: `newGame` also builds fixtures via Task 3. Order Tasks 2→3, and call `buildFixtures` in `newGame` once Task 3 lands (add the assertion `fixtures.length === 162` to the generate tests then).

### Task 3: Fixture schedule

**Files:**
- Create: `src/game/schedule.ts`
- Test: `src/game/schedule.test.ts`

**Interfaces:**
- Consumes: `Fixture`, `Division`
- Produces:
  ```ts
  export function roundRobin(clubIds: string[], division: 1 | 2): Fixture[]   // double, circle method, bye if odd
  export function buildFixtures(divisions: [Division, Division]): Fixture[]
  ```

- [ ] **Step 1: Write failing tests:**
  - `9 clubs → 18 rounds, 4 matches per round, each club plays 16 (8 home, 8 away), one bye per round`.
  - `10 clubs → 18 rounds, 5 matches per round, each club plays 18 (9 home, 9 away)`.
  - `every pair meets exactly twice, once at each home`.
  - `no club plays twice in a round`.
  - `second half mirrors first half with home/away swapped`.
  - `buildFixtures` total = 72 + 90 = 162.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Fixture ids are `` `${division}-${round}-${homeId}-${awayId}` `` (unique within a season; fixtures are rebuilt each season).
- [ ] **Step 4:** Run. Expected: PASS. Wire into `newGame` and add the 162 assertion.
- [ ] **Step 5:** Commit `feat(game): double round-robin schedule with byes`.

### Task 4: League table

**Files:**
- Create: `src/game/table.ts`
- Test: `src/game/table.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TableRow { clubId: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number }
  export function computeTable(clubIds: string[], fixtures: Fixture[]): TableRow[]
  ```
  Sort order: points, then gd, then gf, then club id alphabetical. Win 3, draw 1. Fixtures without `result` are ignored.

- [ ] **Step 1: Write failing tests:** a 3-club hand-built example with exact expected rows. `tie on points broken by gd, then gf, then id`. `clubs with no games appear with zeros`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(game): league table`.

### Task 5: Formations, auto-pick, team strength

**Files:**
- Create: `src/game/tactics.ts`
- Test: `src/game/tactics.test.ts`

**Interfaces:**
- Consumes: `Player`, `Tactics`, `FormationId`, `Style`, `overall`
- Produces:
  ```ts
  export const FORMATIONS: Record<FormationId, { DF: number; MF: number; FW: number }>
  export interface Strength { attack: number; midfield: number; defence: number; goalkeeping: number }   // ~1..20 scale
  export function isAvailable(p: Player): boolean          // injuredWeeks===0 && suspendedMatches===0
  export function pickBestLineup(squad: Player[], formation: FormationId): { lineup: string[]; subs: string[] }   // subs up to 7
  export function teamStrength(players: Player[] /*on pitch, lineup order*/, formation: FormationId): Strength
  ```
  `teamStrength` maps lineup slots to roles via the formation (slot 0 GK, then DF, MF, FW counts). A player outside his natural position contributes at 70%. Fitness below 70 scales his contribution down linearly to 80% at fitness 0.

- [ ] **Step 1: Write failing tests:**
  - `FORMATIONS each sum to 10 outfielders`.
  - `pickBestLineup picks a GK first and fills formation counts with the best available`.
  - `pickBestLineup skips injured and suspended players`.
  - **Review Focus 2:** `pickBestLineup with only 9 available players returns 9 ids (no crash, no unavailable players)`. `with no GK available, puts the best outfielder in slot 0`.
  - `out-of-position player lowers strength`: the same 11 with a FW in a DF slot gives lower `defence`.
  - `more players means more strength`: a 10-man lineup has lower strength than the same 11.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Replace the temporary pick in `newGame` with `pickBestLineup`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(game): formations, auto-pick, team strength`.

### Task 6: Match simulation (resumable, minute by minute)

**Files:**
- Create: `src/game/match/sim.ts`, `src/game/match/types.ts`
- Test: `src/game/match/sim.test.ts`, `src/game/match/balance.test.ts`

**Interfaces:**
- Consumes: `Rng`, `Player`, `Tactics`, `teamStrength`, `isAvailable`
- Produces (`match/types.ts`):
  ```ts
  export type Side = 'home' | 'away'
  export type EventType = 'kickoff'|'chance'|'goal'|'save'|'miss'|'yellow'|'red'|'injury'|'sub'|'halftime'|'fulltime'
  export interface MatchEvent { minute: number; side?: Side; type: EventType; playerId?: string; assistId?: string; subOnId?: string; highlight: boolean }
  export interface LiveTeam { clubId: string; tactics: Tactics; onPitch: string[]; bench: string[]; subsUsed: number; sentOff: string[] }
  export interface MatchState { minute: number /*0..90*/; score: { home: number; away: number }; events: MatchEvent[]; home: LiveTeam; away: LiveTeam; rngState: number; finished: boolean }
  export type TeamChange = { kind: 'sub'; offId: string; onId: string } | { kind: 'tactics'; formation?: FormationId; style?: Style }
  ```
- Produces (`sim.ts`):
  ```ts
  export function createMatch(homeId: string, awayId: string, tactics: Record<string, Tactics>, seed: number): MatchState
  export function stepMinute(state: MatchState, players: Record<string, Player>): MatchState       // pure: returns new state
  export function applyChange(state: MatchState, side: Side, change: TeamChange): MatchState      // throws on 6th sub or invalid ids
  export function simulateFull(homeId: string, awayId: string, tactics: Record<string, Tactics>, players: Record<string, Player>, seed: number): MatchState
  ```
  Each minute: midfield ratio decides which side attacks. Chance probability uses attack vs defence, style modifiers and home advantage. A chance converts using the shooter's finishing/composure vs goalkeeping. Rare cards/injuries. `highlight: true` for goals, saves, big misses, reds and penalties-like big chances (~6–12 highlights per match). Style modifiers: attacking raises own chances and opponent's chances. Defensive lowers both. Counter gets a bonus against attacking opponents. Exact numbers are the builder's call, tuned to the balance tests.

- [ ] **Step 1: Write failing tests (`sim.test.ts`):**
  - `simulateFull is deterministic for a seed`.
  - `ends at minute 90 with halftime and fulltime events, finished=true`.
  - `score equals number of goal events per side`.
  - `applyChange sub swaps players and a 6th sub throws`.
  - `a red card leaves that side with 10 on the pitch`.
  - **Review Focus 2:** `a side with only 9 available players still completes a match`.
  - `stepping minute-by-minute equals simulateFull for the same seed`.
- [ ] **Step 2: Write failing balance tests (`balance.test.ts`, 2,000 sims each, fixed seeds):**
  - Equal teams: average goals per match 2.2–3.2. Home wins 40–50%, draws 22–32%.
  - Strong (overall ~13) vs weak (~8): strong wins > 65%.
  - Tactics matter: defensive vs defensive averages ≥ 0.5 fewer goals than attacking vs attacking.
  - Counter vs attacking: the counter side's win rate is higher than balanced vs attacking (same squads).
  - Highlights per match average 6–12.
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement and tune until the balance tests pass.
- [ ] **Step 5:** Run `npm test`. Expected: PASS.
- [ ] **Step 6:** Commit `feat(game): resumable match simulation with balance tests`.

### Task 7: Season flow

**Files:**
- Create: `src/game/season.ts`
- Test: `src/game/season.test.ts`

**Interfaces:**
- Consumes: `GameState`, `simulateFull`, `computeTable`, `buildFixtures`, `pickBestLineup`, `Rng`
- Produces:
  ```ts
  export function userFixture(state: GameState): Fixture | undefined          // user's fixture this matchday (undefined = bye)
  export function applyResult(state: GameState, fixtureId: string, match: MatchState): GameState   // stores score, cards→suspensions (red=1 match, 5 yellows=1), injuries 1–4 weeks
  export function playMatchday(state: GameState, userMatch?: MatchState): GameState   // sims all other fixtures this round, applies userMatch if given, ticks injuries/suspensions/fitness, AI re-picks lineups, matchday++
  export function isSeasonOver(state: GameState): boolean                    // matchday > 18
  export function endSeason(state: GameState): GameState                     // promotion/relegation, ages +1, retire >35 (replace with generated youngsters), season++, matchday=1, new fixtures
  ```

- [ ] **Step 1: Write failing tests:**
  - `playMatchday plays exactly that round's fixtures and increments matchday`.
  - `user bye week: userFixture is undefined and playMatchday still works`.
  - `after 18 matchdays isSeasonOver is true and every fixture has a result`.
  - `endSeason swaps bottom 2 of div1 with top 2 of div2` (division sizes stay 9 and 10).
  - **Review Focus 1:** force the user's club (`kapar`) into Div 2's top 2, then call `endSeason`. The user is now in Div 1, `userClubId` is unchanged, `userFixture` is defined on matchday 1 of the new season, and the user plays 16 matches. Also the reverse: a relegated user club plays 18.
  - `red card gives a 1-match suspension that clears after the next matchday`.
  - `squads stay 22–25 after endSeason retirements`.
  - `deterministic: same state + same calls gives same result`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. All RNG is derived from `state.rngState`, and the new rngState is stored back.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(game): season flow with promotion and relegation`.

### Task 8: i18n (English / Bahasa Melayu)

**Files:**
- Create: `src/i18n/en.ts`, `src/i18n/ms.ts`, `src/i18n/index.ts`, `src/i18n/commentary.ts`
- Test: `src/i18n/i18n.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Lang = 'en' | 'ms'
  export function t(lang: Lang, key: string, params?: Record<string, string | number>): string   // "{name}" interpolation; ms missing → en → key
  export function commentary(lang: Lang, event: MatchEvent, names: { player?: string; assist?: string; club?: string }, rng: Rng): string   // ≥3 variants per event type per language
  export const LanguageContext: React.Context<{ lang: Lang; setLang(l: Lang): void }>   // in src/ui/LanguageContext.tsx, not in i18n (keep i18n framework-free)
  ```
  `en.ts` is the source of truth (`export const en = {...} as const`). `ms.ts` is typed `Partial<Record<keyof typeof en, string>>`.

- [ ] **Step 1: Write failing tests:**
  - `interpolates params`.
  - **Review Focus 5:** `missing ms key falls back to en`, and `unknown key returns the key`.
  - `every en key has an ms translation` (completeness test; it lists missing keys in the failure message).
  - `commentary returns non-empty text for every EventType in both languages`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Malay should read naturally to a Malaysian football fan (e.g. "GOL!", "Sepakan percuma", "Kad merah"), not word-for-word translation.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(i18n): english and malay text and commentary`.

### Task 9: Saving, loading, export/import

**Files:**
- Create: `src/save/storage.ts`
- Test: `src/save/storage.test.ts`

**Interfaces:**
- Consumes: `GameState`
- Produces:
  ```ts
  export interface SaveMeta { slot: number /*1..3*/; clubId: string; season: number; matchday: number; savedAt: number }
  export class SaveError extends Error { code: 'invalid_json' | 'wrong_shape' | 'unsupported_version' }
  export async function storageAvailable(): Promise<boolean>
  export async function saveGame(slot: number, state: GameState): Promise<void>
  export async function loadGame(slot: number): Promise<GameState | undefined>
  export async function listSaves(): Promise<SaveMeta[]>
  export async function deleteSave(slot: number): Promise<void>
  export function exportSave(state: GameState): string
  export function importSave(json: string): GameState          // throws SaveError
  ```

- [ ] **Step 1: Write failing tests** (using `fake-indexeddb/auto`):
  - `save then load round-trips`. `listSaves returns metadata`. `deleteSave removes`.
  - `exportSave → importSave round-trips`.
  - **Review Focus 3:** `importSave('not json')` throws `SaveError` code `invalid_json`. `importSave('{"foo":1}')` → `wrong_shape`. `version: 99` → `unsupported_version`.
  - **Review Focus 4:** with `indexedDB` deleted from globalThis, `storageAvailable()` resolves false and `saveGame` rejects without throwing synchronously.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with `idb-keyval`. The shape check validates top-level keys and types, not deep contents.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(save): save slots, export and import`.

### Task 10: App shell and core screens

**Files:**
- Create: `src/ui/App.tsx`, `src/ui/LanguageContext.tsx`, `src/ui/useGame.ts`, `src/ui/theme.css`
- Create: `src/ui/screens/StartScreen.tsx` (new game / load / import / language), `NewGameScreen.tsx` (pick club, grouped by division with reputation stars), `Dashboard.tsx` (next match, position, last results, Continue button), `SquadScreen.tsx`, `TableScreen.tsx` (both divisions, promotion/relegation zones coloured), `FixturesScreen.tsx`, `SettingsScreen.tsx` (language, save, export, delete)
- Test: `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: everything in `src/game`, `t`, storage
- Produces:
  ```ts
  export function useGame(): { state: GameState | null; setState(s: GameState): void; startNew(seed: number, clubId: string): void; continueDay(userMatch?: MatchState): void; storageOk: boolean }
  ```
  `continueDay` calls `playMatchday`, runs `endSeason` when `isSeasonOver` (showing an end-of-season summary: final tables, who went up/down), and autosaves to the current slot.

- [ ] **Step 1: Write failing test** (`App.test.tsx`, RTL + fake-indexeddb):
  - `new game flow`: click New Game, pick Kapar, and the dashboard shows "Kapar".
  - `language toggle switches visible text to Malay` (e.g. the Continue button label changes).
  - **Review Focus 4:** `with storage unavailable, a warning banner is shown and a new game still starts`.
  - **Review Focus 3:** `importing an invalid file shows an error message and keeps the start screen`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement screens. Nav: sidebar on laptop, bottom bar under 640px. Style is original: Selangor red/yellow accents with club colours. Continue on a user match day opens the Match screen (Task 12). Until then it simulates directly.
- [ ] **Step 4:** Run `npm test`. Expected: PASS. Run `npm run dev` and check manually: play a full season to the end-of-season summary at 1280px and 375px widths with no horizontal scroll.
- [ ] **Step 5:** Commit `feat(ui): app shell, dashboard, squad, table, fixtures, settings`.

### Task 11: Tactics screen

**Files:**
- Create: `src/ui/screens/TacticsScreen.tsx`, `src/ui/components/FormationPitch.tsx`
- Test: `src/ui/screens/TacticsScreen.test.tsx`

**Interfaces:**
- Consumes: `FORMATIONS`, `pickBestLineup`, `teamStrength`, `Tactics`
- Produces: `<TacticsScreen state onChange={(t: Tactics) => void} />` and `<FormationPitch tactics players onSwap={(a: string, b: string) => void} />`, reused by the in-match panel in Task 12.

- [ ] **Step 1: Write failing tests:**
  - `changing formation re-slots players and keeps 11 in the lineup`.
  - `style buttons update tactics.style`.
  - `swapping a starter with a bench player updates lineup/subs`.
  - `injured/suspended players are marked and cannot be put in the lineup`.
  - `Auto-pick button fills the best XI`.
  - `strength bars (attack/midfield/defence) update when lineup changes`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Click-to-swap (click player A, then player B). Drag-and-drop is optional. A warning shows if the lineup has fewer than 11.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(ui): tactics screen`.

### Task 12: Match screen with 2D highlights

**Files:**
- Create: `src/ui/match/highlights.ts`, `src/ui/match/PitchCanvas.tsx`, `src/ui/screens/MatchScreen.tsx`
- Test: `src/ui/match/highlights.test.ts`, `src/ui/screens/MatchScreen.test.tsx`

**Interfaces:**
- Consumes: `createMatch`, `stepMinute`, `applyChange`, `commentary`, `FormationPitch`, `FORMATIONS`
- Produces:
  ```ts
  export interface Frame { t: number /*ms*/; ball: { x: number; y: number }; home: { x: number; y: number }[]; away: { x: number; y: number }[] }   // pitch coords 0..100 x 0..100, home attacks +x in first half
  export function buildHighlight(event: MatchEvent, homeFormation: FormationId, awayFormation: FormationId, half: 1 | 2, rng: Rng): Frame[]   // 3–6 s of keyframes
  export function interpolate(frames: Frame[], t: number): Frame
  ```
  `<MatchScreen state onFinish={(m: MatchState) => void} />`: runs `stepMinute` on a timer (speeds 1x/2x/4x, plus Skip to end). For `highlight` events it pauses the clock and plays `buildHighlight` on `PitchCanvas`. Shows a commentary feed, score, and clock. A Pause button opens the change panel (subs via `FormationPitch`, style/formation) and calls `applyChange`. At halftime it auto-pauses.

- [ ] **Step 1: Write failing tests (`highlights.test.ts`):**
  - `goal highlight ends with the ball inside the attacked goal` (home, half 1: x ≥ 100, 44 ≤ y ≤ 56. In half 2, x ≤ 0).
  - `save highlight ends with the ball near the keeper, not in the goal`.
  - `frames are time-ordered and players stay within 0..100`.
  - `interpolate at midpoint returns positions between keyframes`.
- [ ] **Step 2: Write failing tests (`MatchScreen.test.tsx`, fake timers):**
  - `Skip to end finishes the match and calls onFinish with finished=true`.
  - `making a sub in the pause panel is reflected in state; the 6th sub is disabled`.
  - `commentary feed shows text in the selected language`.
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement. The canvas draws a green pitch with markings, team-colour dots (the GK is a different shade) and a white ball, scaled to the container width. It uses `requestAnimationFrame` and stops when unmounted.
- [ ] **Step 5:** Wire it in: Dashboard Continue on a user match day → MatchScreen → `onFinish` → `continueDay(match)`.
- [ ] **Step 6:** Run `npm test`. Expected: PASS. Then check manually in `npm run dev`: watch a full match at 1x, make a sub at halftime, switch language mid-match, and see that the result appears in the table.
- [ ] **Step 7:** Commit `feat(ui): match screen with 2d highlights`.

### Task 13: Production build and share link

**Files:**
- Modify: `vite.config.ts` (relative `base: './'` so it works from any static host), `README.md` (how to run and deploy)

- [ ] **Step 1:** `npm run build`. Expected: success, no TypeScript errors. Then `npm test`. Expected: all pass.
- [ ] **Step 2:** `npx vite preview`, then play the start → new game → one match → save → reload → load flow. Expected: the game resumes at the same matchday.
- [ ] **Step 3:** Commit `chore: production build config and readme`. Hosting (GitHub Pages or similar) needs the owner's account, so ask before publishing anything.
