# Bola Daerah — Plan 2: News, Press, Fans, Board & Finances

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every match now has consequences. A news inbox reacts to results, press conferences let you talk up (or wind up) rivals, fans' mood rises and falls, the board judges you against a season target and can sack you, and the club's money moves with wages, tickets and prize money.

**Architecture:** New pure modules in `src/game/` (`finance.ts`, `reactions.ts`, `news.ts`, `press.ts`, `career.ts`) are called from `season.ts`. Plan 1 built the game logic and UI. `GameState` goes to version 2 with a migration so Plan 1 saves keep working. News is stored as `{ key, params, variant }` and rendered through i18n at view time, so switching language translates old news too.

**Tech Stack:** Same as Plan 1 (TypeScript, React 18.3.1, Vite, Vitest, RTL). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-23-bola-daerah-design.md` (sections: Media and news, Fan emotions, Board and finances). Plan 1: `docs/superpowers/plans/2026-11-23-bola-daerah-core.md`.

**Later:** Plan 3 Transfers (it will use `Player.wage` and `GameState.finance` from this plan) · Plan 4 Youth & training.

## Global Constraints

- All Plan 1 Global Constraints still apply (pure `src/game/`, seeded `Rng` only, all text via `t()` in EN + BM, 375px usable, data in data files).
- Fan mood and board confidence are integers 0..100. Money is whole Ringgit (RM), formatted `RM 1,234,567`.
- Each news and press template has at least 3 variants per key, in both languages.
- Plan 1 (version 1) saves must load: migrate to version 2 on import and on load.
- Sacking is never instant in the first 6 matchdays of a season.
- Rivalry = two clubs sharing a `district` (e.g. Klang–Kapar, Petaling–Damansara/Bukit Raja), plus the Petaling–Klang derby.

## Review Focus

1. **Old Plan 1 save** (version 1, no wages/fans/board/inbox) loads and plays: it's migrated with sensible defaults, not rejected or crashed. Test in Task 1.
2. **Sacked mid-season while a press conference is pending**: the press is cleared, the offers screen shows, and taking a new job mid-season gives a playable state (the new club's fixtures and finance). Test in Task 6.
3. **Money goes negative over several seasons**: no NaN/Infinity anywhere, the board reacts, and the game keeps going. Test in Task 6 (3-season autoplay).
4. **Inbox grows forever**: it's capped at 150 items (oldest read items dropped first) so saves stay small. Test in Task 4.
5. **Language switch**: news already in the inbox shows in the new language. Test in Task 7.

---

### Task 1: State v2, wages, migration

**Files:**
- Modify: `src/game/types.ts`, `src/game/generate.ts`, `src/save/storage.ts`
- Create: `src/game/migrate.ts`
- Test: `src/game/migrate.test.ts`, extend `src/game/generate.test.ts`, `src/save/storage.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  // Player gains:
  wage: number                       // RM per week
  // new types
  export type Expectation = 'title' | 'promotion' | 'topHalf' | 'midTable' | 'avoidRelegation'
  export interface FanLogEntry { season: number; matchday: number; delta: number; reason: string /*i18n key*/; params?: Record<string, string | number> }
  export interface FanState { mood: number; log: FanLogEntry[] /*newest first, max 12*/ }
  export interface BoardState { expectation: Expectation; targetPosition: number; confidence: number }
  export interface WeekLedger { season: number; matchday: number; tickets: number; sponsor: number; prize: number; wages: number; attendance?: number }
  export interface Finance { balance: number; history: WeekLedger[] /*newest first, max 40*/ }
  export type NewsKind = 'match' | 'league' | 'fans' | 'board' | 'press' | 'finance' | 'career'
  export interface NewsItem { id: string; season: number; matchday: number; kind: NewsKind; key: string; params: Record<string, string | number>; variant: number; read: boolean; important?: boolean }
  export type Answer = 'confident' | 'humble' | 'combative'
  export interface PressQuestion { key: string; params: Record<string, string | number> }
  export interface PressConference { kind: 'pre' | 'post'; fixtureId: string; questions: PressQuestion[] }
  export type CareerStatus = { kind: 'employed' } | { kind: 'sacked'; offers: string[] /*clubIds*/ }
  // GameState: version becomes 2, and gains:
  fans: FanState; board: BoardState; finance: Finance; inbox: NewsItem[]; press: PressConference | null; career: CareerStatus
  ```
- Produces (`generate.ts`): `export function wageFor(p: Player, club: Club): number`, used by `generatePlayer` callers. `newGame` initialises: `fans {mood: 60, log: []}`, `board` via `expectationFor` (Task 3: until it exists, use `{expectation:'midTable', targetPosition: 5, confidence: 60}` and replace it in Task 3), `finance {balance: startingBalance(club), history: []}`, `inbox: []`, `press: null`, `career: {kind:'employed'}`.
  `startingBalance(club) = club.reputation * 20000`. `wageFor = round((overall^2) * 8 * (0.6 + rep/100))`, rounded to RM 10.
- Produces (`migrate.ts`): `export function migrate(raw: Record<string, unknown>): GameState` handles v1 → v2 (adds wages, fans, board, finance, inbox, press, career) and passes v2 through. Throws `SaveError('unsupported_version')` for anything else.
- `storage.ts`: `importSave` and `loadGame` both run `migrate` before `isConsistent`. Accept `version` 1 or 2.

- [ ] **Step 1: Write failing tests:**
  - `generate`: every player has a `wage` > 0. Average wage at `petaling` > `jugra`. `newGame` has `version: 2`, `fans.mood === 60`, `career.kind === 'employed'`, `inbox` is empty, and `finance.balance === reputation*20000`.
  - **Review Focus 1** (`migrate.test.ts`): build a v1 save by taking a v2 `newGame`, setting `version: 1` and deleting `wage` from players and `fans/board/finance/inbox/press/career` from state. `migrate(v1)` returns `version: 2`, all players get a wage, and `fans.mood === 60`. Then `playMatchday(migrate(v1))` runs without throwing.
  - `migrate` passes a v2 state through unchanged (deep-equal). `version: 7` throws `unsupported_version`.
  - `storage`: `importSave(JSON.stringify(v1save))` returns a v2 state.
- [ ] **Step 2:** Run `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement. Fix existing tests and fixtures that construct `Player`/`GameState` by hand.
- [ ] **Step 4:** Run `npm test` and `npx tsc -p .`. Expected: all PASS, no type errors.
- [ ] **Step 5:** Commit `feat(game): state v2 with wages, fans, board, finance, inbox + v1 migration`.

### Task 2: Rivalries and finances

**Files:**
- Create: `src/game/finance.ts`, `src/game/rivals.ts`
- Test: `src/game/finance.test.ts`, `src/game/rivals.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Club`, `Finance`, `WeekLedger`, `computeTable`
- Produces:
  ```ts
  // rivals.ts
  export function isRivalry(a: Club, b: Club): boolean      // same district, or {petaling, klang}
  // finance.ts
  export const TICKET_PRICE: Record<1 | 2, number>          // {1: 15, 2: 8}
  export function attendance(club: Club, fanMood: number, leaguePosition: number, divisionSize: number, rivalry: boolean): number   // integer ≤ capacity, ≥ 15% capacity
  export function weeklySponsor(club: Club): number         // reputation * 300
  export function prizeMoney(division: 1 | 2, position: number): number   // div1: 500_000 - 50_000*(pos-1); div2: 200_000 - 15_000*(pos-1); floor 0
  export function wageBill(state: GameState, clubId: string): number
  export function applyWeek(state: GameState, opts: { homeAttendance?: number; prize?: number }): Finance   // user club only; adds a WeekLedger, caps history at 40
  export function formatRM(n: number): string               // "RM 1,234,567", negative "-RM 12,000"
  ```

- [ ] **Step 1: Write failing tests:**
  - `isRivalry`: klang–kapar true, petaling–damansara true, petaling–klang true, klang–sepang false.
  - `attendance` rises with fan mood, never exceeds capacity, never drops below 15% of capacity, and is higher in a rivalry (same inputs).
  - `prizeMoney(1,1) === 500000`, `prizeMoney(1,9) === 100000`, `prizeMoney(2,10) === 65000`.
  - `applyWeek` with a home game adds tickets = attendance × TICKET_PRICE[div], always adds sponsor and subtracts wages, and adds exactly one history entry. History never exceeds 40.
  - `formatRM(1234567) === 'RM 1,234,567'`, `formatRM(-12000) === '-RM 12,000'`.
  - **Balance target:** for each club, a season of 9 home games at fan mood 60 and mid-table finish changes the balance by between −40% and +40% of the starting balance. Tune `wageFor` and the sponsor so this passes. Money should matter without being a crisis by default.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(game): rivalries, attendance and club finances`.

### Task 3: Fan and board reactions

**Files:**
- Create: `src/game/reactions.ts`
- Test: `src/game/reactions.test.ts`
- Modify: `src/game/generate.ts` (use `expectationFor` in `newGame`)

**Interfaces:**
- Consumes: `isRivalry`, `computeTable`, `FanState`, `BoardState`
- Produces:
  ```ts
  export function expectationFor(state: GameState): BoardState     // by reputation rank inside the user's division; confidence 60
  export interface Reaction { fanDelta: number; boardDelta: number; reasons: Array<{ key: string; params?: Record<string, string | number> }> }
  export function resultReaction(state: GameState, fixture: Fixture): Reaction          // fixture has a result; user involved
  export function weeklyBoardCheck(state: GameState): Reaction                          // position vs target (after matchday 6), fan mood < 25, balance < 0
  export function seasonEndReaction(state: GameState): Reaction                         // promoted/champion/met/missed/relegated
  export function applyReaction(state: GameState, r: Reaction): GameState              // clamps 0..100, prepends fans.log (max 12)
  export function shouldSack(state: GameState): boolean                                // confidence < 15 and matchday > 6, or season over and confidence < 25
  ```
  Expectation rules: Div 1 by reputation rank among the 9: rank 1 → `title` (target 1), ranks 2–4 → `topHalf` (target 4), ranks 5–9 → `avoidRelegation` (target 7). Div 2 among the 10: ranks 1–3 → `promotion` (target 2), ranks 4–6 → `topHalf` (target 5), ranks 7–10 → `midTable` (target 8).
  Result deltas (fans / board): win +4/+3, draw 0/0, loss −4/−3. Rivalry adds ±3 fans. A margin of 3+ adds ±2 fans. Board results are scaled by opponent reputation (beating a bigger club counts more, losing to a smaller club hurts more), with the scale clamped 0.5–1.5.
  Season end (board / fans): champion +30/+20, promoted +25/+15, met target +15/+5, missed by 1–2 −10/−5, missed by 3+ −25/−10, relegated −35/−20.

- [ ] **Step 1: Write failing tests:**
  - `expectationFor`: petaling in div1 gets `title` with target 1, sabak-bernam gets `avoidRelegation`, kapar (3rd-highest reputation in div2: damansara 55, kajang 52, kapar 49) gets `promotion` with target 2, rawang (rank 5) gets `topHalf`, and jugra gets `midTable` with target 8.
  - A win raises fans and board, a loss lowers both, and a derby win raises fans by more than a normal win.
  - Losing to a much smaller club costs more board confidence than losing to a bigger one.
  - `applyReaction` clamps at 0 and 100 and keeps `fans.log` ≤ 12, newest first.
  - `shouldSack` is false at matchday 3 even with confidence 5, true at matchday 10 with confidence 10, and true at season end with confidence 20.
  - `seasonEndReaction` for a promoted club has `boardDelta === 25`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Replace the placeholder board in `newGame` with `expectationFor`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(game): fan mood and board confidence reactions`.

### Task 4: News generation + bilingual templates

**Files:**
- Create: `src/game/news.ts`, `src/i18n/news.ts`
- Modify: `src/i18n/index.ts` (add `newsText`)
- Test: `src/game/news.test.ts`, extend `src/i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Fixture`, `Reaction`, `computeTable`, `isRivalry`, `Rng`
- Produces:
  ```ts
  // game/news.ts
  export const INBOX_CAP = 150
  export function addNews(state: GameState, items: Array<Omit<NewsItem, 'id' | 'season' | 'matchday' | 'read' | 'variant'>>, rng: Rng): GameState   // assigns id/variant, newest first, enforces cap (drop oldest read first, then oldest)
  export function matchdayNews(before: GameState, after: GameState): Array<Omit<NewsItem, 'id'|'season'|'matchday'|'read'|'variant'>>
  //   user match report (key by outcome: news.match.win|draw|loss|bigWin|heavyLoss|derbyWin|derbyLoss),
  //   biggest win of the round (news.league.bigWin), new leader in user's division (news.league.newLeader),
  //   fan threshold crossings at 25/40/75 (news.fans.angry|uneasy|delighted), board crossings at 30/80 (news.board.warning|backing, important when warning)
  export function seasonStartNews(state: GameState): ...   // news.board.expectation.<expectation>
  export function seasonEndNews(before: GameState, after: GameState): ...   // champions, promoted, relegated, user outcome
  export function markRead(state: GameState, id: string): GameState
  export function unreadCount(state: GameState): number
  // i18n/news.ts
  export const NEWS: Record<Lang, Record<string, string[]>>   // ≥3 variants each, placeholders {club} {opp} {score} {player} {pos} {n}
  // i18n/index.ts
  export function newsText(lang: Lang, item: NewsItem, clubName: (id: string) => string): { headline: string; body?: string }   // params ending in "Id" are resolved to club names
  ```

- [ ] **Step 1: Write failing tests:**
  - After a user win, `matchdayNews` contains `news.match.win` (or `bigWin`/`derbyWin` when those apply) with `clubId`, `oppId` and `score` params.
  - A derby loss produces `news.match.derbyLoss`.
  - Fan mood going from 45 to 38 produces `news.fans.uneasy`. Board confidence going from 35 to 28 produces an important `news.board.warning`.
  - **Review Focus 4:** adding 400 items keeps the inbox at 150, unread items are kept over read ones, and order is newest first.
  - `markRead` and `unreadCount` work.
  - i18n: every key `news.ts` can emit has ≥3 variants in `en` and `ms`, `newsText` leaves no `{…}` placeholders, and `variant` picks a stable template (the same item gives the same text twice).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Malay headlines should read like Malaysian sports pages ("Kapar bikin kejutan, tumbangkan Klang 3–1!"), not translated English.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(game): news inbox generation with bilingual templates`.

### Task 5: Press conferences and player morale

**Files:**
- Create: `src/game/press.ts`
- Modify: `src/game/tactics.ts` (morale factor in `contribution`), `src/game/match/sim.ts` (`createMatch` option `homeBoost`)
- Test: `src/game/press.test.ts`, extend `src/game/tactics.test.ts`, `src/game/match/sim.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Fixture`, `isRivalry`, `Rng`, `applyReaction`, `addNews`
- Produces:
  ```ts
  export function maybePress(state: GameState, kind: 'pre' | 'post', fixture: Fixture, rng: Rng): PressConference | null
  //   pre: always before a rivalry, after a 3-match win/loss streak, else 35%; post: after rivalry, margin ≥3, else 25%. 1–3 questions.
  export const ANSWER_EFFECTS: Record<Answer, { fans: number; morale: number; board: number }>   // confident {+2,+3,0}, humble {-1,+1,+1}, combative {+1,+1,-2}; combative in rivalry: fans +4
  export function answerPress(state: GameState, answers: Answer[], rng: Rng): GameState   // applies effects (morale to whole squad, clamp 0..100), adds news.press.<answer> headline, clears state.press
  export function skipPress(state: GameState, rng: Rng): GameState                         // fans -1, board -1, news.press.skipped, clears press
  // sim.ts
  export interface MatchOptions { homeBoost?: number /*multiplier on home attack, default 1*/ }
  export function createMatch(homeId, awayId, tactics, seed, opts?: MatchOptions): MatchState   // MatchState gains homeBoost: number
  // tactics.ts — contribution(p, role) multiplies by 0.95 + 0.1 * (morale/100)
  ```
  Press question keys: `press.q.pre.rival`, `press.q.pre.streakWin`, `press.q.pre.streakLoss`, `press.q.pre.generic`, `press.q.post.win`, `press.q.post.loss`, `press.q.post.draw`, `press.q.post.derby`. Each has ≥3 variants in EN + BM, plus answer labels `press.a.confident|humble|combative`.

- [ ] **Step 1: Write failing tests:**
  - `maybePress('pre')` before a rivalry always returns a conference with 1–3 questions, including `press.q.pre.rival`.
  - `answerPress` with all `confident` raises squad morale and fans, clears `press`, and adds a `press` news item. `combative` in a rivalry gives fans +4 per answer.
  - `skipPress` lowers fans and board by 1 and clears press.
  - Morale: the same player at morale 100 contributes more than at morale 0, and the difference is ≤ 10%.
  - Sim: `homeBoost: 1.1` gives more home goals than `1.0` over 1,000 seeded sims. The existing balance tests still pass (default 1).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: all PASS, including Plan 1 balance tests.
- [ ] **Step 5:** Commit `feat(game): press conferences, squad morale and fan-driven home boost`.

### Task 6: Season integration and career (sacking, job offers)

**Files:**
- Create: `src/game/career.ts`
- Modify: `src/game/season.ts`
- Test: `src/game/career.test.ts`, extend `src/game/season.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–5
- Produces:
  ```ts
  // season.ts changes
  playMatchday(state, userMatch?)    // now also: finance.applyWeek (home attendance if user at home), resultReaction + weeklyBoardCheck → applyReaction,
                                     // squad morale ±5 for players who played (win/loss), matchdayNews, post-match maybePress, sack check → career
  endSeason(state)                   // also: prize money via applyWeek({prize}), seasonEndReaction, seasonEndNews, new expectationFor, seasonStartNews, sack check
  export function preMatch(state: GameState): GameState   // sets state.press = maybePress('pre', userFixture) if none pending; no-op on bye/sacked
  export function userHomeBoost(state: GameState): number // 1 + (fans.mood - 50) / 1000 when user is home, else 1
  // career.ts
  export function makeOffers(state: GameState, rng: Rng): string[]          // 2–3 clubs with reputation ≤ old club's − 5 (fallback: lowest-rep div-2 clubs), never the old club
  export function sack(state: GameState, rng: Rng): GameState              // career = sacked with offers, press = null, news.career.sacked (important)
  export function takeJob(state: GameState, clubId: string): GameState     // userClubId = clubId, fans {60, []}, board = expectationFor, finance = {startingBalance, []}, career employed, news.career.newJob
  ```
  While `career.kind === 'sacked'`, `playMatchday` and `preMatch` are no-ops.

- [ ] **Step 1: Write failing tests:**
  - After `playMatchday`, the user's `finance.history` has one new entry, `fans.log` reflects the result, and at least one `match` news item exists.
  - Morale of the user's starters goes up after a win and down after a loss.
  - `preMatch` before a rivalry fixture sets `state.press`, and `preMatch` on a bye week leaves it `null`.
  - `endSeason` adds prize money to the history, resets the board expectation for the new division, and adds season-end news.
  - Forced sacking: set confidence 5 at matchday 10, then `playMatchday` gives `career.kind === 'sacked'` with 2–3 offers that are all smaller clubs.
  - **Review Focus 2:** with `press` pending, sacking clears it. `takeJob(offer)` mid-season makes `userFixture` return the new club's fixture on the next matchday, `finance.balance` is the new club's starting balance, and `playMatchday` works.
  - **Review Focus 3:** set the user balance to −5,000,000 and autoplay 3 seasons, taking the first offer whenever sacked. Every number in `fans`, `board` and `finance` is finite, the game reaches season 2030, and the inbox stays ≤ 150.
  - `userHomeBoost` is 1.05 at mood 100 at home and 1 away.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Keep `playMatchday` readable by calling one helper per concern.
- [ ] **Step 4:** Run `npm test`. Expected: all PASS.
- [ ] **Step 5:** Commit `feat(game): wire finances, reactions, news, press and sacking into the season`.

### Task 7: Inbox screen and dashboard headlines

**Files:**
- Create: `src/ui/screens/InboxScreen.tsx`
- Modify: `src/ui/App.tsx` (nav item `inbox` with unread badge), `src/ui/screens/Dashboard.tsx` (latest 3 headlines, fan + board mini meters), `src/ui/useGame.ts` (`markRead`, `answerPress`, `skipPress`, `takeJob`, `preMatch` before opening the match), `src/i18n/en.ts`, `src/i18n/ms.ts`, `src/ui/theme.css`
- Test: `src/ui/screens/InboxScreen.test.tsx`, extend `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: `newsText`, `markRead`, `unreadCount`
- Produces: `<InboxScreen state onRead={(id: string) => void} />`, a list newest first with kind filter chips (All / Match / Fans / Board / Press / League / Finance). Important items are highlighted. Clicking expands the item and marks it read.

- [ ] **Step 1: Write failing tests:**
  - The inbox lists headlines newest first. Clicking one marks it read and lowers the unread badge.
  - The filter "Fans" shows only `fans` items.
  - **Review Focus 5:** an item added in EN shows Malay text after switching language (same item, text changes, no placeholders).
  - App: after playing a week, the nav badge shows ≥1 unread and the dashboard shows a headline.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(ui): news inbox and dashboard headlines`.

### Task 8: Club screen (fans, board, finances)

**Files:**
- Create: `src/ui/screens/ClubScreen.tsx`
- Modify: `src/ui/App.tsx` (nav item `club`), i18n, `theme.css`
- Test: `src/ui/screens/ClubScreen.test.tsx`

**Interfaces:**
- Consumes: `formatRM`, `wageBill`, `FanState`, `BoardState`, `Finance`
- Produces: `<ClubScreen state />` with three cards:
  - **Fans:** mood meter with a face (😡 <25, 😟 <40, 🙂 <75, 🤩 ≥75) and the last 6 `fans.log` reasons with ± deltas.
  - **Board:** expectation in words plus target position, and a confidence meter (red <30).
  - **Finances:** balance, weekly wage bill, and the last home attendance. Then the last 6 weeks as a table (tickets, sponsor, prize, wages, net) with negative values in red.

- [ ] **Step 1: Write failing tests:** shows `RM` balance, the expectation text in the current language, a fan mood meter with the right `aria-valuenow`, and a negative balance styled as negative (class `neg`).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(ui): club screen with fans, board and finances`.

### Task 9: Press conference and sacked screens, plus flow gating

**Files:**
- Create: `src/ui/screens/PressScreen.tsx`, `src/ui/screens/SackedScreen.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/screens/Dashboard.tsx`, i18n, `theme.css`
- Test: `src/ui/screens/PressScreen.test.tsx`, `src/ui/screens/SackedScreen.test.tsx`, extend `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: `answerPress`, `skipPress`, `takeJob`, `preMatch`
- Produces:
  - `<PressScreen press state onSubmit={(a: Answer[]) => void} onSkip={() => void} />` shows one question at a time with three answer buttons (labels show the tone, e.g. "Confident: 'We'll win this.'"), then submits.
  - `<SackedScreen state onTakeJob={(id: string) => void} onNewGame={() => void} />` shows the sacking headline, the offers as club cards (reputation stars and division), and a New game option.
- Flow: Dashboard "Play match" calls `preMatch` first. If a press conference is created, PressScreen shows before the match. A post-match press conference shows after Finish, before returning to the dashboard. If `career.kind === 'sacked'`, the shell shows SackedScreen instead of the tabs.

- [ ] **Step 1: Write failing tests:**
  - Press: answering all questions calls `onSubmit` with one answer per question, and Skip calls `onSkip`.
  - Sacked: offers are listed, and clicking one calls `onTakeJob(id)`.
  - App: with a state forced to have a pending pre-match press, "Play match" shows the press screen first, and after answering the match screen opens.
  - App: with a forced sacked state, the offers screen shows. Taking a job shows the new club in the header.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. App tests set up forced states by writing them with `saveGame(slot, state)` (fake-indexeddb) and loading that slot from the start screen, so no test-only props go into production code.
- [ ] **Step 4:** Run `npm test` and `npm run build`. Expected: all PASS, build succeeds.
- [ ] **Step 5:** Commit `feat(ui): press conferences, sacking and job offers`.
