import type { GameState } from '../../game/types'

export function Stars({ value }: { value: number }) {
  const n = Math.max(1, Math.min(5, Math.round(value / 20)))
  return <span className="stars" aria-label={`${n}/5`}>{'★'.repeat(n)}<span className="dim">{'★'.repeat(5 - n)}</span></span>
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
