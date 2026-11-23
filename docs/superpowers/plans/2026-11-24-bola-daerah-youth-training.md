# Bola Daerah — Plan 4: Youth, Training & Icons

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players grow and decline, a youth intake arrives every season, you set a weekly training focus, scouts rate players in stars, and icons replace emoji.

**Architecture:** `development.ts` (weekly growth/decline), `youth.ts` (intake, scouting, signing, breakthroughs) and `training.ts` (focus effects) are pure modules called from `season.ts`. `GameState` goes to version 4. `Icon.tsx` holds the inline SVG set.

**Tech Stack:** Same as Plans 1–3. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-23-bola-daerah-design.md` (Youth development, Training, Fan emotions, Media). Icons and the market filter come from the owner's request and Plan 3's deferred list.

## Global Constraints

- All earlier Global Constraints still apply (pure `src/game/`, seeded `Rng`, EN + BM, ≥3 variants per news key, 375px usable, saves v1–v3 migrate).
- Potential stays hidden: the UI shows only the scout's star range. Attributes stay integers 1..20.
- No emoji in the UI. Icons are decorative (`aria-hidden`) beside text, or labelled.

## Review Focus

1. **Ten seasons**: average best-XI ability per division drifts by at most 1.5, and squads stay legal. Task 2.
2. **v3 saves** load and play, with empty intake and balanced training. Task 1.
3. **Full squad or stale id** when signing a youth: refused, nothing changes. Task 3.
4. **New job or sacking** with an intake pending: intake cleared, training reset. Task 3.
5. **Attributes** never leave 1..20, and nobody grows past potential. Task 2.

### Task 1: State v4 and development

**Files:** Create `development.ts` + test; modify `types.ts`, `generate.ts`, `migrate.ts`, `season.ts`, `storage.ts`, `testUtils.ts`.

**Interfaces — Produces:**
```ts
// types: Player gains apps: number, ovrStart: number, homeClubId?: string, debuted?: boolean
export type TrainingFocus = 'balanced' | 'attack' | 'defence' | 'fitness' | 'youth'
// GameState.version 4; gains training: TrainingFocus; youth: { intake: Player[] }
// NewsKind gains 'youth'
export function growthChance(p: Player, played: boolean, focus: TrainingFocus): number
export function declineChance(p: Player, focus: TrainingFocus): number
export function developWeek(before: GameState, after: GameState, rng: Rng): GameState  // played = apps went up
```
Base growth ≤18 .55, ≤20 .5, ≤22 .4, ≤24 .28, ≤26 .15, ≤29 .05, else 0; × min(1, (potential − overall)/2); × 1.25 played, 0.6 not. Youth focus ×1.35 at ≤21; attack ×1.2 for MF/FW; defence ×1.2 for GK/DF. Decline from 31 (GK 34): .12, .2, .3, .4 for each year, ×0.7 on fitness focus. +1/−1 goes to a relevant attribute (growth weighted by position weights; decline favours pace/stamina/strength). Focus applies to the user's club only. `apps` counts matches; it resets each season, when `ovrStart` becomes `overall`.

- [ ] Failing tests → implement → `npm test` → commit `feat(game): player development and decline`.

### Task 2: Youth intake and renewal of squads

**Files:** Create `youth.ts` + test; modify `season.ts`, `transferWeek.ts`.

**Interfaces — Produces:**
```ts
export function generateYouth(rng, club, position, season): Player   // 16–18, homeClubId, contract season+2
export function youthIntake(rng, state, clubId): Player[]            // 3–4 players, thin positions first
export function aiIntake(state, rng): GameState                      // every club but the user's; releases worst over AI_SQUAD_MAX
```
Retired players are no longer replaced one for one; intake and `refillSquads` renew squads. `newGame` and `endSeason` fill `youth.intake` for the user. A ten-season soak tunes `generateYouth`.

- [ ] Failing tests (Review Focus 1, 5) → implement → `npm test` → commit `feat(game): yearly youth intake`.

### Task 3: Scouting, signing, breakthroughs and training effects

**Files:** `youth.ts`, create `training.ts` + test; modify `season.ts`, `career.ts`, `match/*`, `news.ts` templates.

**Interfaces — Produces:**
```ts
export function stars(v: number): number                                   // 0.5..5 in halves
export function scoutRange(p: Player): { lo: number; hi: number }          // stars, always contains stars(potential); narrower with age
export function signYouth(state, playerId, rng): Act<{ kind: 'signed' } | { kind: 'refused'; reason: Refusal }>
export function releaseYouth(state, playerId): GameState
export function youthWeek(before, after, rng): GameState                   // debuts, breakthroughs, intake deadline (matchday 6)
export function setTraining(state, focus): GameState
export function matchOptions(state): MatchOptions                          // homeBoost plus sharpness
// MatchOptions/MatchState gain sharpness?: Partial<Record<Side, { attack: number; defence: number }>>
```
Attack focus ×1.02 attack, defence ×1.02 defence, fitness +25 weekly recovery instead of +20. Homegrown ≤21 debut: fans +2 and `news.youth.debut`; 8th appearance: fans +1 and `news.youth.breakthrough`. `news.youth.intake`, `news.youth.wonderkid` (potential ≥ club level + 3).

- [ ] Failing tests (Review Focus 3, 4) → implement → `npm test` → commit `feat(game): scouting, youth signings and training focus`.

### Task 3b: Underdogs (owner's request: the same clubs always win)

**Files:** Create `momentum.ts` + test; modify `types.ts`, `generate.ts`, `migrate.ts`, `season.ts`, `match/*`, `news.ts`.

Measured before: 3 different champions in 60 seasons.

**Interfaces — Produces:**
```ts
// GameState gains form: Record<string, number>   // hidden season form, 0.88..1.12; the user's club always plays at 1
export function rollForm(state, rng): Record<string, number>       // gaussian ±; one dark horse from each division's lower half, one stumbling favourite
export function moveReputations(ended: GameState): Record<string, Club>  // finish vs reputation rank, titles, promotion/relegation; gentle pull to the original level; 20..90
export function underdogNews(ended): NewNews[]                     // champion or promoted club that was ranked low
```
Targets over 40 seasons: ≥ 5 different Division 1 champions, none with more than half; ≥ 9 different promoted clubs; the top three by starting reputation still win the most titles.

### Task 4: Youth & training screen, icons, market filter

**Files:** Create `components/Icon.tsx`, `screens/YouthScreen.tsx` + tests; modify every screen using emoji, `SquadScreen`, `PlayerDialog`, `TransfersScreen`, `index.html`, i18n, `theme.css`, README.

`<YouthScreen state actions={{ train, sign, release }} />`: focus buttons with descriptions, intake cards with star ranges, and a table of own players ≤21 (apps, change since the season began). Squad shows ▲/▼ change. Dialog shows star range. Market hides players who won't join by default. A test scans `src/**` for emoji. `index.html` gets an SVG icon.

- [ ] Failing tests → implement → `npm test && npm run build` → browser check → commit.
