# Bola Daerah — Plan 3: Transfers & Contracts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a squad in the transfer market: search players, bid, agree terms, sell, renew contracts and sign free agents, while AI clubs trade around you.

**Architecture:** Three pure modules. `market.ts` answers questions (values, asking prices, windows, wage demands, squad limits). `transfers.ts` holds the user's actions, each returning `{ state, outcome }`. `transferWeek.ts` runs the weekly AI market, incoming offers and season-end contract expiry, and is called from `season.ts`. `GameState` goes to version 3.

**Tech Stack:** Same as Plans 1–2. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-23-bola-daerah-design.md` (Transfers; also Media: rumours, Fan emotions: signings and selling favourites, Board and finances).

**Later:** Plan 4 Youth & training.

## Global Constraints

- All Plan 1 and 2 Global Constraints still apply (pure `src/game/`, seeded `Rng` only, all text via `t()` in EN + BM, ≥3 variants per news key, 375px usable, whole Ringgit).
- Windows: matchdays 1–3 (pre-season) and 9–11 (mid-season). Free agents and renewals are possible at any time.
- Negotiation is instant: no waiting a week for an answer.
- Squad limits: user and AI squads stay within 17..28, with at least GK 2, DF 6, MF 5, FW 3. A sale that would break the minimum is refused.
- Version 1 and 2 saves must load (migrated to 3).
- While sacked, every transfer action is a no-op.
- Fees and wages are whole, positive, finite RM. Anything else is refused with no state change.

## Review Focus

1. **Selling a starter, then playing at once**: the lineup has 11 of the club's own players. Task 4.
2. **Old saves (v1, v2)** load, get contracts and free agents, and nobody leaves at the first season end. Task 1 and Task 6.
3. **Five seasons of AI trading**: every club stays inside squad limits, and the player count is bounded. Task 6.
4. **Nonsense amounts** (NaN, 0, negative, decimals, more than the budget): refused, state unchanged. Task 3.
5. **Sacked or new job with offers pending**: offers and agreed fees are cleared, and a stale offer id does nothing. Task 4 and Task 6.

---

### Task 1: State v3 and migration

**Files:** Modify `src/game/types.ts`, `generate.ts`, `migrate.ts`, `finance.ts`, `career.ts`, `testUtils.ts`, `src/save/storage.ts`. Test: `generate.test.ts`, `migrate.test.ts`, `finance.test.ts`, `storage.test.ts`.

**Interfaces — Produces:**
```ts
// types.ts
export const FREE_AGENT = 'free'            // Player.clubId of players without a club
// Player gains: contractEnd: number /* last season of the deal */; listed?: boolean
export interface Budget { transfer: number; wage: number }
export interface IncomingOffer { id: string; playerId: string; clubId: string; fee: number; expires: number /* last valid matchday */ }
export interface TransferRecord { season: number; matchday: number; playerId: string; name: string; fromId: string; toId: string; fee: number }
export interface TransferState {
  budgets: Record<string, Budget>; offers: IncomingOffer[]
  agreed: Record<string, number>    // playerId → fee agreed with the club
  blocked: string[]                 // playerIds not negotiable until the next matchday
  history: TransferRecord[]         // newest first, max 60
}
// GameState.version becomes 3; gains transfers: TransferState
// Finance gains transferNet: number (net fees since the last ledger entry); WeekLedger gains transfers?: number
// NewsKind gains 'transfer'
// generate.ts
export function budgetFor(club, balance: number): Budget  // transfer = 40% of max(0,balance), wage = wageBudgetFor(club)
export function wageBudgetFor(club: Pick<Club,'reputation'>): number
export function generateFreeAgents(rng: Rng, n: number): Player[]   // clubId FREE_AGENT, quality 5..11
export function initialTransfers(clubs, userClubId, userBalance): TransferState
```
`newGame` uses a second RNG (`seed ^ 0x51ed270b`) for contracts (`season + int(0..3)`) and 24 free agents, so existing seeded results do not move. AI `budgets.transfer` = 40% of `startingBalance`. `applyWeek` records `transfers: finance.transferNet` in the entry (the balance already moved) and resets it to 0. Migration v2→v3: contracts `season + int(1..3)`, 24 free agents, `transfers`, `transferNet: 0`.

- [ ] **Step 1: Failing tests:** new game is `version: 3`; every club player has `contractEnd` in 2027..2030; 24 free agents; each club's wage budget is 1.05–1.4× its wage bill; petaling's transfer budget > jugra's. `migrate(v1)` and `migrate(v2)` give version 3, every club player's `contractEnd > season`, 24 free agents, `transferNet === 0`, and play a matchday. `applyWeek` moves `transferNet` into the ledger without changing the balance twice. `importSave` accepts v1/v2/v3 and rejects v3 without `transfers` or with a player whose `clubId` is unknown.
- [ ] **Step 2:** `npm test` → new tests FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test && npx tsc -b` → PASS.
- [ ] **Step 5:** Commit `feat(game): state v3 with contracts, budgets and free agents`.

### Task 2: Market rules

**Files:** Create `src/game/market.ts`, `src/game/market.test.ts`.

**Interfaces — Produces:**
```ts
export const SQUAD_MAX = 28; export const SQUAD_MIN = 17
export const POSITION_MIN: Record<Position, number>  // GK 2, DF 6, MF 5, FW 3
export function transferWindow(matchday: number): 'pre' | 'mid' | null
export function squad(state, clubId): Player[]
export function playerValue(p: Player, season: number): number       // nearest RM 1,000, min 1,000
export function isKeyPlayer(state, p): boolean                       // top 5 by overall at their club
export function askingPrice(state, playerId): number                 // value × (listed 0.85 | key 1.5 | else 1.15) × 1.25 if buyer is a rival × mood 0.92..1.12 (hash of id+season)
export function canLeave(state, playerId): boolean                   // the selling club stays within limits
export function willJoin(state, playerId, clubId): boolean           // false when the club's reputation is > 20 below the player's current club
export function wageDemand(state, playerId, clubId): number          // RM 10 steps
export function maxYears(p: Player): number                          // 4; 2 from age 32
```
Value: `overall³ × 100 × age × potential × contract`. Age factor ≤20 1.3, ≤23 1.2, ≤27 1.0, ≤29 0.8, ≤31 0.55, ≤33 0.35, else 0.2. Potential factor `1 + 0.08 × max(0, potential − overall)`. Contract factor by `contractEnd − season`: ≤0 0.5, 1 0.8, else 1. Demand: new club `max(wageFor(p, club), 1.05 × wage)` plus 2% per reputation point dropped beyond 5; free agent `wageFor`; own player (renewal) `max(wage, wageFor)`, +½% per morale point below 50.

- [ ] **Step 1: Failing tests:** windows open on exactly 1,2,3,9,10,11. Value rises with ability and potential, falls with age and an expiring contract. A key player's price > the same player's price when not key; listed < unlisted; rival buyer pays more. `canLeave` false for the 2nd-last GK or a 17-man squad, true for a free agent. `willJoin` petaling→jugra false, jugra→petaling true, free agent true. Demand ≥ current wage ×1.05 for a move; a low-morale renewal costs more; `maxYears(33) === 2`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(game): transfer market values and rules`.

### Task 3: Buying, free agents and renewals

**Files:** Create `src/game/transfers.ts`, `src/game/transfers.test.ts`; modify `src/game/tactics.ts` (+ test).

**Interfaces — Produces:**
```ts
// tactics.ts
export function dropFromTactics(t: Tactics, playerId: string, squad: Player[]): Tactics  // best available replacement in the same slot; other slots untouched
// transfers.ts
export type Refusal = 'sacked' | 'windowClosed' | 'invalidAmount' | 'notForSale' | 'blocked' | 'squadFull' | 'transferBudget' | 'wageBudget' | 'wontJoin' | 'noAgreement' | 'tooManyYears' | 'gone' | 'squadTooSmall'
export type BidOutcome = { kind: 'accepted' } | { kind: 'counter'; fee: number } | { kind: 'rejected' } | { kind: 'refused'; reason: Refusal }
export type TermsOutcome = { kind: 'signed' } | { kind: 'counter'; wage: number } | { kind: 'rejected' } | { kind: 'refused'; reason: Refusal }
export interface Act<O> { state: GameState; outcome: O }
export function placeBid(state, playerId: string, fee: number): Act<BidOutcome>
export function offerTerms(state, playerId: string, wage: number, years: number, rng: Rng): Act<TermsOutcome>
export function renewContract(state, playerId: string, wage: number, years: number, rng: Rng): Act<TermsOutcome>
export function movePlayer(state, playerId, toId, opts: { fee: number; wage: number; contractEnd: number }): GameState  // shared by user and AI deals
```
Bid ≥ asking → `accepted` (records `agreed`); ≥ 75% → `counter` at the asking price; lower → `rejected` and `blocked`. Wage ≥ demand → signed; ≥ 85% → `counter`; lower → `rejected` and `blocked`. A free agent needs no agreed fee. `movePlayer` updates club, contract, tactics, budgets of both clubs, the user's `balance` and `transferNet`, and `history`; clears `listed` and any offers/agreement for that player. `contractEnd = season + years − 1`. Renewal needs `bill − old + new ≤ max(wage budget, bill)`. Signings give fans +3 (better than the best-XI average) or +1 (a starter-level player for their position), reason `fans.reason.signing`.

- [ ] **Step 1: Failing tests:** bid at asking accepted; at 80% counters with the asking price; at 50% rejected, then blocked on retry. Completing terms moves the player, lowers balance and transfer budget by the fee, raises the seller's budget, adds history and a ledger `transferNet`. Counter then accept on wage. Free agent signs outside a window; a club player cannot. **Review Focus 4:** NaN, 0, −5, 1.5, Infinity, budget+1 all refused with the same state object. Wage over budget, full squad, unwilling player, too many years, no agreed fee: each refused with its reason. Renewal extends `contractEnd`. `dropFromTactics` keeps 10 slots unchanged.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(game): bids, player terms, free agents and renewals`.

### Task 4: Selling

**Files:** Modify `src/game/transfers.ts`, `transfers.test.ts`.

**Interfaces — Produces:**
```ts
export function toggleListed(state, playerId): GameState
export function makeOffer(state, playerId, rng): IncomingOffer | null   // an AI club that can afford, improve with, and attract the player
export type OfferOutcome = { kind: 'sold' } | { kind: 'declined' } | { kind: 'raised'; fee: number } | { kind: 'withdrawn' } | { kind: 'refused'; reason: Refusal }
export function respondToOffer(state, offerId, answer: 'accept' | 'reject' | 'negotiate', rng): Act<OfferOutcome>
```
Fee = value × 0.85..1.2 (listed 0.75..1.0), capped by the buyer's budget, expiring two matchdays later. Negotiate: 50% raises by 15% (capped by budget, only once per offer via `negotiated?: boolean` on `IncomingOffer`), otherwise withdrawn. Selling a top-3 player fans −6 (`fans.reason.soldStar`), a top-11 player −3 (`fans.reason.sold`), to a rival a further −4; unlisted fringe players 0.

- [ ] **Step 1: Failing tests:** accept raises balance and budget by the fee and moves the player. **Review Focus 1:** sell a starter → lineup is 11 unique own players and `playMatchday` works. Refused when the squad would be too small. Star sale −6, to a rival −10. Negotiate across seeds gives both `raised` and `withdrawn`, and a second negotiate withdraws. **Review Focus 5 (part):** unknown/expired offer → `gone`, unchanged; sacked → refused.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(game): incoming offers and player sales`.

### Task 5: Weekly market and transfer news

**Files:** Create `src/game/transferWeek.ts`, `transferWeek.test.ts`; modify `src/i18n/news.ts`, `i18n.test.ts`, `transfers.ts` (signing/sale/renewal news).

**Interfaces — Produces:**
```ts
export function transferWeek(state: GameState, rng: Rng): GameState   // called with the new matchday already set
```
Clears `agreed`/`blocked`, drops expired offers, and all offers once the window is closed. In a window: each AI club has a 25% chance to sign one player improving its weakest position (from AI clubs or free agents, never the user's); max 4 deals a week; AI squads ≤ 26. Incoming offers: 45% for one random user player, plus 50% per listed player, max 4 open, one per player. 40% chance of a rumour about an affordable, willing player. News keys (all `news.transfer.*`): `signed`, `signedFree`, `sold`, `renewed`, `offer` (important), `deal`, `rumour`, `windowOpen`, `deadline`, `closed`, `expiring` (matchday 14, important), `left`. At most 2 `deal` items a week, biggest fees first. Params: `clubId`, `oppId`, `player`, `fee`, `n`.

- [ ] **Step 1: Failing tests:** running window weeks over 20 seeds moves AI players, never a user player, and keeps limits and non-negative AI budgets. No deals outside windows. A listed player attracts an offer within 10 seeds. Offers vanish when the window closes. `windowOpen` at 9, `deadline` at 3 and 11, `closed` at 4 and 12, `expiring` at 14. i18n: every key ≥3 variants, no leftover placeholders in both languages.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(game): ai transfer market, offers, rumours and transfer news`.

### Task 6: Season and career integration

**Files:** Modify `src/game/season.ts`, `career.ts`, `transferWeek.ts`; test `season.test.ts`, `career.test.ts`.

**Interfaces — Produces:**
```ts
// transferWeek.ts
export function expireContracts(state: GameState, rng: Rng): { state: GameState; left: Player[] }  // during roll-over, state.season = the finished season
export function refillSquads(state: GameState, rng: Rng): GameState  // youth up to POSITION_MIN and 20 players, every club
```
`playMatchday` calls `transferWeek` after the matchday advances and before the sack check. `endSeason` expires contracts (user's leave; AI renew 85% for 1–3 years; a sacked manager's club counts as AI), refills squads, trims free agents to the best 40 under 36, resets all budgets (user from balance), clears offers, then runs `transferWeek` for matchday 1. `left` news per departed user player (max 3). `takeJob` resets the new club's budget and clears offers/agreed/blocked.

- [ ] **Step 1: Failing tests:** an expired user player becomes a free agent and a renewed one stays. **Review Focus 2:** a migrated v2 save loses nobody at its first season end. **Review Focus 3:** 5 autoplayed seasons: each club 17..28 with position minimums, 11-man lineups of own players, total players ≤ 620, free agents ≤ 60 at any time. **Review Focus 5:** sack + `takeJob` clears offers and agreed. Budgets reset at season start. Every club can field 11 each matchday.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(game): contracts expire, squads refill and the market runs each week`.

### Task 7: Transfers screen

**Files:** Create `src/ui/screens/TransfersScreen.tsx`, `src/ui/components/PlayerDialog.tsx`, `TransfersScreen.test.tsx`; modify `App.tsx`, `useGame.ts`, `InboxScreen.tsx` (filter + icon), `en.ts`, `ms.ts`, `theme.css`.

**Interfaces — Produces:** `<TransfersScreen state actions={TransferActions} />` where
```ts
export interface TransferActions {
  bid(playerId: string, fee: number): BidOutcome
  terms(playerId: string, wage: number, years: number): TermsOutcome
  renew(playerId: string, wage: number, years: number): TermsOutcome
  respond(offerId: string, answer: 'accept' | 'reject' | 'negotiate'): OfferOutcome
  list(playerId: string): void
}   // from useGame() as game.transfers
```
Header: window status, transfer budget, wages used/budget. Sections (chips): Market, Offers (n), Done deals. Market: name search, position chips, max age, max value, free-agents-only, sort by OVR/value/age; first 40 rows and a count. A row opens `PlayerDialog` (attributes, value, wage, contract, bid → terms, or terms directly for free agents). Every outcome shows as text in a `role="status"`. Nav tab `transfers` with a badge of open offers.

- [ ] **Step 1: Failing tests:** filters narrow the list; free agent signing end to end; a low bid shows the rejection, a counter shows the fee, an accepted bid shows the terms form; accepting an offer calls through and removes it; a closed window disables bidding with an explanation; Malay labels render. App: the tab opens, and signing a free agent shows them in Squad.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ui): transfer market, offers and negotiations`.

### Task 8: Contracts in Squad, transfers in Club

**Files:** Modify `SquadScreen.tsx`, `ClubScreen.tsx`, `App.tsx`, i18n, `theme.css`, `README.md`; test `SquadScreen.test.tsx`, `ClubScreen.test.tsx`.

**Interfaces — Produces:** `<SquadScreen state actions />` adds value, wage and contract columns (expiring highlighted) and opens `PlayerDialog` in renew mode with a list/unlist button. ClubScreen adds a Transfers column (included in net) and the two budgets.

- [ ] **Step 1: Failing tests:** contract year and wage shown, expiring marked; renewing via the dialog calls `renew`; list button calls `list`; ClubScreen net includes transfers.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npm test && npm run build` → PASS.
- [ ] **Step 5:** Commit `feat(ui): contracts in squad and transfers in club finances`.
