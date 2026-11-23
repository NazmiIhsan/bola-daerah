import { useT } from '../LanguageContext'
import { overall } from '../../game/generate'
import { scoutRange } from '../../game/youth'
import type { GameState, Player } from '../../game/types'
import { Icon } from './Icon'

/** Star rating in halves, 0..5. Decorative unless labelled by the caller. */
export function StarRow({ value }: { value: number }) {
  const five = [0, 1, 2, 3, 4]
  return (
    <span className="star-row" aria-hidden>
      <span className="dim">{five.map((i) => <Icon key={i} name="star" size={15} />)}</span>
      <span className="lit" style={{ width: `${(value / 5) * 100}%` }}>{five.map((i) => <Icon key={i} name="star" size={15} />)}</span>
    </span>
  )
}

/** Club reputation in whole stars. */
export function Stars({ value }: { value: number }) {
  const n = Math.max(1, Math.min(5, Math.round(value / 20)))
  return <span className="stars" role="img" aria-label={`${n}/5`}><StarRow value={n} /></span>
}

/** The scout's estimate of a player's potential. */
export function ScoutStars({ p, bare }: { p: Player; bare?: boolean }) {
  const { t } = useT()
  const { lo, hi } = scoutRange(p)
  const same = lo === hi
  return (
    <span className="scout small" role="img" aria-label={t('youth.scout', { lo, hi })}>
      {!bare && <span className="muted">{t('youth.potential')}</span>}
      <StarRow value={lo} />{!same && <><span className="muted">–</span><StarRow value={hi} /></>}
    </span>
  )
}

/** Change in ability since the season began. */
export function Progress({ p }: { p: Player }) {
  const d = Math.round((overall(p) - p.ovrStart) * 10) / 10
  if (d === 0) return null
  return <span className={`delta small ${d > 0 ? 'pos' : 'neg'}`}>{d > 0 ? '+' : ''}{d.toFixed(1)}</span>
}

export function Kit({ colors, size = 28 }: { colors: [string, string]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="kit">
      <path d="M10 3 L4 7 L6 13 L9 12 L9 29 L23 29 L23 12 L26 13 L28 7 L22 3 Q16 7 10 3 Z" fill={colors[0]} stroke={colors[1]} strokeWidth="2" />
    </svg>
  )
}

export function ClubLabel({ state, id, short }: { state: GameState; id: string; short?: boolean }) {
  const c = state.clubs[id]
  return (
    <span className={`club-label ${id === state.userClubId ? 'me' : ''}`}>
      <Kit colors={c.colors} size={18} /> {short ? c.shortName : c.name}
    </span>
  )
}

export const playerName = (state: GameState, id: string | undefined) => {
  if (!id) return ''
  const p = state.players[id]
  return p ? `${p.firstName.split(' ')[0][0]}. ${p.lastName}` : ''
}
