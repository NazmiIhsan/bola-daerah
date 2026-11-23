# Bola Daerah — Design

*Working title ("District Football"). Placeholder, can be renamed.*
Date: 2026-11-23

## Intent and why

A small, original football management game set in Selangor, Malaysia. You manage
one club through tactics, transfers, youth development, media pressure and fan
emotions, and watch your matches as 2D highlights. It's for fun, played by the
owner and their friends, who each play their own save in the browser.

It's in the same genre as big football management sims, but much smaller and
with its own identity: local clubs, local drama, bilingual (English / Bahasa
Melayu).

## Goals

- A complete, replayable season loop: pre-season → matchdays → end of season
  (promotion/relegation, youth intake, contracts) → next season, indefinitely.
- The five features the owner cares about, each done properly:
  tactics, transfers, media/news, youth development, fan emotions.
- 2D highlights match view.
- English and Bahasa Melayu, switchable at any time.
- Friends can play by opening a link. No install, no account.

## Non-goals (v1)

- Shared/online multiplayer league. *Later:* game logic is kept separate from
  the UI so a shared league can be added.
- Divisions 3–4 / all ~55 mukim. *Later:* league structure is data-driven so
  more divisions are just more data.
- Cup competitions (e.g. a Selangor cup). Possible later addition.
- Full 90-minute live simulation of all 22 players.
- Real players or real club branding.
- Native mobile app.

## Anti-goals (failure even if it "works")

- Looking or reading like a copy of Football Manager (name, screens, branding).
- Tactics that don't visibly change results.
- A slow, tedious loop: advancing a week should take seconds, not minutes of clicking.
- News that's just walls of repetitive text.

## League structure (decided)

- **Division 1:** the 9 Selangor districts: Petaling, Klang, Gombak,
  Hulu Langat, Sepang, Kuala Selangor, Kuala Langat, Hulu Selangor, Sabak Bernam.
- **Division 2:** ~10 mukim (sub-district) clubs, one or two per district so the
  whole state is covered. Proposed: Kapar (Klang), Damansara (Petaling),
  Bukit Raja (Petaling), Semenyih (Hulu Langat), Kajang (Hulu Langat),
  Rawang (Gombak), Dengkil (Sepang), Ijok (Kuala Selangor),
  Serendah (Hulu Selangor), Jugra (Kuala Langat). *Builder may adjust the list.*
- **Open pyramid:** bottom 2 of Division 1 go down, top 2 of Division 2 go up.
  Any club, including mukim clubs, can be chosen at the start.
- Season: double round-robin in each division. Division 1 has an odd number of
  teams, so one club has a bye each round (*my call*; a bye week still allows
  training and transfers).

## Approaches considered

**Match view**
1. **Highlights-style (chosen).** The match is simulated as events driven by
   ratings and tactics, and key moments are animated on a 2D pitch with
   commentary between them. Reliable, quick to build, easy to tune so tactics matter.
2. Full live simulation: all 22 players move for 90 minutes. Looks great but is far
   harder to make realistic. Possible future upgrade.

**Platform**
1. **Web game: TypeScript + React for screens, HTML canvas for the pitch
   (chosen, my call).** Management games are mostly screens and tables. Shared as a
   link, saves stored in the browser.
2. Game engine (e.g. Godot): better for action games, worse for menus.

**Sharing**
1. **Separate saves per player (chosen).**
2. Shared league with a server: deferred.

## Features

### Tactics
- Formations: at least 4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2, 4-5-1.
- Pick starting XI and subs. Players out of position perform worse.
- Team style: Attacking / Balanced / Defensive / Counter. Optional extras
  (*builder's call*): pressing high/low, tempo fast/slow.
- During a match: pause, make substitutions (max 5), change style/formation.
- Tactics must have clear, testable effects, e.g. Defensive lowers chances for
  both sides; Counter is stronger against Attacking opponents.

### Transfers
- Two windows: pre-season and mid-season.
- Search/browse players at other clubs plus free agents, filtered by position,
  age and value.
- Bid → club accepts / rejects / counters → agree wage and contract length with
  the player (they may refuse a smaller club or low wage).
- Sell players: AI clubs make offers for yours.
- Budget split into transfer funds and wage budget. District clubs richer than mukim clubs.
- AI clubs also make transfers between themselves so the world changes.

### Media and news
- An inbox/news feed: match reports, transfer rumours, manager pressure, fan
  reactions, youth breakthroughs, award/table news.
- Templated, with variety (several phrasings per event type, in both languages)
  and real names/scores filled in.
- **Press conferences:** before/after some matches, 1–3 questions with 3 answer
  choices (e.g. confident / humble / combative). Answers move fan mood, player
  morale and board confidence, and can generate follow-up headlines.
- Rivalries (e.g. clubs from the same district) make news hotter.

### Youth development
- Every season, a youth intake of a few players from the club's area.
- Players have current ability and hidden potential. The scout gives an
  estimated range (e.g. 2–4 stars).
- Growth depends on age, potential, minutes played and training focus.
  Older players decline.
- Notable youngsters create news ("Wonderkid from Semenyih!").

### Fan emotions
- Fan mood 0–100, shown clearly (e.g. a face/meter plus recent reasons).
- Driven by results (especially vs rivals), league position vs expectation,
  signings, selling favourites, press answers, and giving local youth a chance.
- Effects: attendance and ticket income, home-match boost, news tone, and board confidence.

### Board and finances (supporting systems, kept simple)
- Board sets a season expectation based on club size (e.g. avoid relegation,
  top half, win the league).
- Board confidence driven by results vs expectation, finances and fan mood.
  Too low → sacked. *My call:* you then get job offers from (usually smaller)
  clubs or start a new game.
- Income: tickets, prize money. Costs: wages. Simple and readable.

### Training (supporting, simple)
- Weekly team focus (e.g. Attack / Defence / Fitness / Youth) with small effects
  on development and match sharpness. No per-player training schedules in v1.

## Match engine

- **Simulation:** minute-by-minute event simulation using team strengths
  (attack, midfield, defence, goalkeeping) from the selected XI's attributes,
  adjusted by tactics, morale, fitness, home advantage and fan mood. Produces
  events: chances, shots, goals, saves, fouls, cards, injuries, substitutions.
- **Highlights view:** for key events, an animated 2D top-down pitch (dots in
  team colours, ball, simple pass/shot paths) plus a commentary line. Between
  highlights: a ticking clock, score, and short text commentary. Speed controls
  and skip-to-end.
- Seeded randomness, so a match can be reproduced for testing.
- Other matches in the round are simulated instantly (no animation).
- Results should look realistic across a season: typical scorelines, stronger
  teams usually win, upsets happen sometimes.

## Players and clubs data

- Fictional players with names reflecting Selangor's mix (Malay, Chinese,
  Indian, others), generated at new-game time from name lists.
- Each player: name, age, nationality, position(s), ~10 attributes
  (e.g. finishing, passing, dribbling, tackling, positioning, pace, stamina,
  strength, goalkeeping, composure), potential, morale, fitness, form,
  value, wage, contract end.
- Each club: name, short name, district, colours, stadium name and capacity,
  reputation, budget. Club data lives in data files, not code.
- Squad size ~22–25.

## Language

- Full English and Bahasa Melayu for all UI text, news, commentary and press
  conferences. Toggle in settings and on the start screen.
- All text comes from translation files; no hard-coded strings in components.

## Saving

- Multiple save slots in browser storage (IndexedDB), autosave after each matchday.
- Export/import a save file (backup, or sending a save to a friend).

## Technical shape

- TypeScript + React + Vite. Canvas for the match view.
- **Game logic is a pure TypeScript module** with no React and no browser APIs:
  league, schedule, match sim, transfers, news, youth, fans and finance. The UI calls
  into it. This keeps it testable and ready for a future shared league.
- Unit tests for the game logic (match sim balance, promotion/relegation,
  transfer negotiation, development).
- Static site, deployable anywhere free (e.g. GitHub Pages). Exact hosting is the
  builder's call.
- Desktop browser is the main target. Should be usable on a phone (friends),
  but not phone-optimised in v1 (*my call*, see open questions).

## Visual identity

- Original look: clean, modern, its own colour scheme. Local flavour (Selangor
  red/yellow accents are fine, club colours by district) without copying any
  existing game's screens.

## Left to the builder

- Exact attribute formulas, match sim tuning, and the numbers for budgets, wages and growth.
- Exact screen layout (should include: home/dashboard, squad, tactics, match,
  league table, fixtures, transfers, inbox/news, club/finances, settings).
- Name lists, news/commentary template wording (both languages).
- Final Division 2 club list.
