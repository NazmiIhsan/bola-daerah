# Bola Daerah: Match day design

Date: 2026-11-26

## Intent and why

The owner finds the in-game match "too simple". Right now the match is a per-minute dice roll with one
animation pattern (centre → wing → shot) and a frozen pitch between highlights. The only way to manage
during a match is to pause. The goal is to make matches fun to watch and to *manage*: decisions during
the match should feel like they matter, and the pitch should show what is happening.

## Goals

- **Chances have a story:** every shot is a cross, through ball, long shot, counter-attack, solo run,
  corner, free kick or penalty. Tactics and player attributes set the mix, and each type has its own odds.
- **Set pieces:** corners, free kicks and penalties during the match. Headers use strength, free kicks
  and penalties use the best taker.
- **Momentum:** goals and red cards swing the next few minutes, then fade.
- **Stoppage time** at the end of the second half (90+N).
- **Touchline shouts** while the clock runs: Attack, Calm down, Waste time (leading only), Encourage.
  Each lasts 10 minutes, and only one is active at a time.
- **Assistant prompts:** at key moments (red card, conceding late, level at 75', a tired or booked
  player, protecting a late lead) the clock pauses and the assistant offers 2–3 one-tap choices.
  Each prompt fires at most once per match, with at most 4 per match.
- **Living pitch:** the ball and players move between highlights, following possession and momentum.
  Each chance type has its own animation. Crosses and lofted balls arc. Big late moments and near misses
  play in slow motion.
- Momentum bar, an xG stat, and a "late winner / equaliser" banner.

## Non-goals

- A 22-player positional simulation.
- First-half stoppage time (minute numbering stays simple). *Builder call.*
- AI managers using shouts. AI behaviour and season balance stay the same.

## Anti-goals

- Slower weekly loop: Skip and 4× stay, and prompts never appear after Skip.
- Balance drift: the existing balance tests (goals per game, home wins, draws, strong vs weak,
  style effects, highlights per match) must keep passing.
- Old saves breaking: every new field is optional.

## Approaches

- **A (chosen): keep the per-minute model and add a chance "kind".** Small risk, keeps seeds,
  tests and saves working. Animations are per-kind templates with random variation.
- B: a move-by-move possession-chain engine. More realistic, but a rewrite plus full rebalancing.
- C: a full 22-player simulation. Ruled out (a non-goal in the original design, and slow).

## Design

- `MatchEvent` gains optional `kind` (chance type) and `xg`; a new `shout` event type with a
  `shout` field; a `stoppage` event carries the added minutes in `added`.
- `MatchState` gains optional `momentum` (−1..1, positive = home), `shouts` (active shout per
  side with its end minute) and `added` (stoppage minutes).
- The chance roll is unchanged in shape. Momentum and shouts multiply it, and the conversion
  probability is multiplied by a per-kind factor. Constants are retuned so the balance tests hold.
- `applyChange` accepts `{ kind: 'shout', shout }`.
- `game/match/assistant.ts`: a pure function returns the next prompt (or none) for the user's side.
  Its options map to `TeamChange`s.
- `ui/match/highlights.ts`: one builder per kind, plus `ambientFrame` for play between highlights.
  `PitchCanvas` tweens between ambient frames. The ball has an optional height (a shadow plus a larger
  ball when it is in the air).
- All new text in English and Malay.

## Left to the builder

Exact weights and constants (set by the tests), animation details and copy.
