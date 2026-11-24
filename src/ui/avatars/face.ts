import type { Club, Player } from '../../game/types'

/** What a face is drawn from. Kept free of the avatar library so screens don't pull it in. */
export interface Face {
  seed: string
  /** #rrggbb */
  shirt: string
  /** 0..100 */
  beard: number
  reporter?: boolean
}

const NO_CLUB = '#8a8578'
const REPORTER = '#4a5568'

/** The face depends only on the player's id, so it never changes; club and age only affect shirt and beard. */
export function playerFace(p: Pick<Player, 'id' | 'clubId' | 'age'>, clubs: Record<string, Club>): Face {
  return { seed: p.id, shirt: clubs[p.clubId]?.colors[0] ?? NO_CLUB, beard: p.age < 20 ? 0 : 25 }
}

export function reporterFace(fixtureId: string): Face {
  return { seed: `reporter-${fixtureId}`, shirt: REPORTER, beard: 15, reporter: true }
}
