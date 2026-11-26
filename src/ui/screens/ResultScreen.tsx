import { useEffect, useRef } from 'react'
import { useT } from '../LanguageContext'
import { ordinal } from '../../i18n'
import { computeTable } from '../../game/table'
import { matchRatings } from '../../game/match/ratings'
import { penalties } from '../../game/match/penalties'
import type { MatchEvent, MatchState, Side } from '../../game/match/types'
import type { GameState } from '../../game/types'
import { Crest } from '../components/Crest'
import { Icon } from '../components/Icon'
import { Avatar } from '../avatars/Avatar'
import { playerFace } from '../avatars/face'
import { MatchStats } from '../match/MatchStats'
import { teamColors } from '../match/PitchCanvas'

/** Where the user's club stands in its division. */
function place(state: GameState): number {
  const div = state.divisions.find((d) => d.clubIds.includes(state.userClubId))!
  const table = computeTable(div.clubIds, state.fixtures.filter((f) => f.division === div.id))
  return table.findIndex((r) => r.clubId === state.userClubId) + 1
}

/**
 * The full-time summary between the match and the press conference: final score, who scored,
 * your players' marks, the player of the match, the numbers and what it did to the table.
 */
export function ResultScreen({ match, before, after, cup, onContinue }: { match: MatchState; before: GameState; after: GameState; cup: boolean; onContinue(): void }) {
  const { t, lang } = useT()
  const go = useRef<HTMLButtonElement>(null)
  useEffect(() => { go.current?.focus() }, [])
  const players = before.players
  const mySide: Side = match.home.clubId === before.userClubId ? 'home' : 'away'
  const other: Side = mySide === 'home' ? 'away' : 'home'
  const home = before.clubs[match.home.clubId]
  const away = before.clubs[match.away.clubId]
  const colors = teamColors(home.colors, away.colors)
  const pens = cup && match.score.home === match.score.away ? penalties(match, players) : null
  const mine = match.score[mySide] + (pens ? pens[mySide] / 100 : 0)
  const theirs = match.score[other] + (pens ? pens[other] / 100 : 0)
  const outcome = mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw'
  const ratings = matchRatings(match, players)
  const [motm] = Object.entries(ratings).sort((a, b) => b[1] - a[1])
  const name = (id?: string) => (id && players[id] ? `${players[id].firstName.split(' ')[0]} ${players[id].lastName}` : '')
  const goals = (side: Side) => match.events.filter((e) => e.type === 'goal' && e.side === side)
  const goalLine = (e: MatchEvent) => `${players[e.playerId!]?.lastName ?? ''} ${e.minute > 90 ? `90+${e.minute - 90}` : e.minute}'${e.kind === 'penalty' ? ` (${t('result.pen')})` : ''}`
  const team = match[mySide]
  const cameOn = match.events.filter((e) => e.type === 'sub' && e.side === mySide).map((e) => e.subOnId!)
  const mineRated = [...team.tactics.lineup, ...cameOn].filter((id) => ratings[id] !== undefined).sort((a, b) => ratings[b] - ratings[a])
  const scored = (id: string) => match.events.filter((e) => e.type === 'goal' && e.playerId === id).length
  const assisted = (id: string) => match.events.filter((e) => e.type === 'goal' && e.assistId === id).length
  const was = cup ? 0 : place(before)
  const now = cup ? 0 : place(after)

  return (
    <div className="result">
      <section className={`card result-head ${outcome}`} role="region" aria-label={t('match.fulltime')}>
        <p className="result-kicker">{t('match.fulltime')} · {cup ? t('cup.title') : t('common.matchday', { n: before.matchday })}</p>
        <div className="result-score">
          <div className="result-team"><Crest club={home} size={56} /><strong>{home.name}</strong></div>
          <div className="result-nums" data-testid="final-score">{match.score.home} – {match.score.away}</div>
          <div className="result-team"><Crest club={away} size={56} /><strong>{away.name}</strong></div>
        </div>
        {pens && <p className="result-pens">{t('cup.shootout', { home: pens.home, away: pens.away })}</p>}
        <div className="result-scorers">
          {(['home', 'away'] as Side[]).map((side) => (
            <ul key={side} className={`small ${side}`} aria-label={t('result.scorers', { club: before.clubs[match[side].clubId].name })}>
              {goals(side).map((e, i) => <li key={i}><Icon name="ball" size={13} /> {goalLine(e)}</li>)}
            </ul>
          ))}
        </div>
        <p className={`result-verdict ${outcome}`}>{t(`result.${outcome}`)}</p>
        {!cup && was > 0 && now > 0 && (
          <p className="muted small" data-testid="table-move">
            {now < was ? t('result.up', { from: ordinal(lang, was), to: ordinal(lang, now) }) : now > was ? t('result.down', { from: ordinal(lang, was), to: ordinal(lang, now) }) : t('result.same', { pos: ordinal(lang, now) })}
          </p>
        )}
        <button ref={go} className="primary big" onClick={onContinue}>{t('result.continue')}</button>
      </section>

      <div className="result-grid">
        <section className="card" role="region" aria-label={t('result.ratings')}>
          <h2>{t('result.ratings')}</h2>
          {motm && (
            <div className="motm">
              <Avatar face={playerFace(players[motm[0]], before.clubs)} size={48} />
              <div>
                <span className="small muted">{t('result.motm')}</span>
                <strong>{name(motm[0])}</strong>
                <span className="small">{before.clubs[players[motm[0]].clubId]?.name}</span>
              </div>
              <span className="rating big">{motm[1].toFixed(1)}</span>
            </div>
          )}
          <ol className="ratings">
            {mineRated.map((id) => (
              <li key={id}>
                <span className={`pos ${players[id].position}`}>{t(`pos.${players[id].position}`)}</span>
                <span className="r-name">{name(id)}</span>
                <span className="r-icons small" aria-label={t('result.involvement', { g: scored(id), a: assisted(id) })}>
                  {Array.from({ length: scored(id) }, (_, i) => <Icon key={`g${i}`} name="ball" size={13} />)}
                  {assisted(id) > 0 && <span className="muted">{assisted(id) === 1 ? t('result.assist') : t('result.assists', { n: assisted(id) })}</span>}
                </span>
                <span className={`rating ${ratings[id] >= 7.5 ? 'good' : ratings[id] < 6 ? 'bad' : ''}`}>{ratings[id].toFixed(1)}</span>
              </li>
            ))}
          </ol>
        </section>
        <MatchStats events={match.events} possession={match.possession} colors={colors} />
      </div>
    </div>
  )
}
