# Bola Daerah: Seasons with more story

Date: 2026-11-26

## Intent

Make the game "spicier": surprises that interrupt the weekly routine and make the manager react.

## Decided with the owner

- **Breaking news pop-ups** that you react to (option B): most come with 2–3 choices that have consequences.
- **Choice events:** big bid for your star, pay-rise demand (with promises that come due),
  unhappy benchwarmer, derby war of words, board ultimatum, night-out scandal, sponsor offer,
  scout's tip, national call-up, wedding, training-ground bust-up, family emergency,
  job offer from a bigger club, TV interview.
- **Random events:** dengue fever, going viral, rival managers sacked, touchline ban (no shouts
  next match), Ramadan (a few weeks of heavier legs).
- **Named managers** for every club, including the user (asked once).
- **Pre-match screen:** both line-ups, managers, formations, styles, form, key men, derby tag,
  last-minute tactics.
- **Existing saves keep working, and upgrade mid-season.**

## Ground rules (builder calls)

- At most one choice event per matchday, shown on the home screen after the match. Headlines
  without a choice collect in one "Breaking" pop-up.
- A kind of event cannot repeat within 8 matchdays.
- Consequences move morale, fan mood, board confidence, money or availability. None ends the
  career by itself: sacking stays the board's normal rule.
- Every event and its outcome goes into the inbox.
- Story effects only touch the user's club. AI clubs' balance is unchanged.

## Save

Version 6 adds `managerName` ('' until asked), `managers` (one per club, seeded from the old
derived personalities so AI behaviour carries over), `story` (pending event, promises,
ultimatum, derby stance, touchline ban, Ramadan window, cooldowns), optional `away` on players
and `breaking` on news.

## Approach

Built on the existing systems: news/inbox, reactions (fans/board), transfer offers, `takeJob`,
player morale and availability. A new `game/story.ts` rolls and resolves events; the season
loop calls it once per league matchday.
