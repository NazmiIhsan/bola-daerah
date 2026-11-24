import type { ReactNode } from 'react'
import type { Club } from '../../game/types'

/** Outlines on a 32×32 grid. */
const SHAPES = {
  shield: 'M4 4h24v12c0 7-5 11-12 14C9 27 4 23 4 16z',
  round: 'M16 2a14 14 0 1 1 0 28 14 14 0 0 1 0-28z',
  hex: 'M16 2 28 9v14l-12 7-12-7V9z',
  swallow: 'M4 5c4 1.500 8 0 12-2.500C20 5 24 6.500 28 5v15L16 30 4 20z',
}

/** Original pictures, one per club, drawn in the second colour (f fills, s strokes). */
const CHARGES = {
  towers: <path className="f" d="M9 22V13h3v9zm5 0V9l2-2.500L18 9v13zm6 0v-9h3v9z" />,
  anchor: <path className="s" d="M16 9.500V23M12.500 13h7M9 17.500c.5 3.500 3.500 5.500 7 5.500s6.500-2 7-5.500M16 9.500a1.800 1.800 0 1 1 0-3.600 1.800 1.800 0 0 1 0 3.600" />,
  hills: <path className="f" d="M7 21.500 13 11l3.500 6 2.500-4 6 8.500z" />,
  cave: <path className="f" fillRule="evenodd" d="M7.500 22c0-8 3-14 8.500-14s8.500 6 8.500 14zm5 0h7c0-4.500-1-8-3.500-8s-3.500 3.500-3.500 8z" />,
  wing: <path className="f" d="M6.500 12c7 0 11 1 19 7.500-5 .5-7 0-9 1.500-1-2-3-3-5-3 .5-1 1-1.500 2-1.700C10.500 15.800 8 14.500 6.500 12z" />,
  lighthouse: <path className="f" d="M13 22.500 14.200 13h3.600L19 22.500zM13.500 11.500 16 7l2.500 4.500zM7 10l5 1.200v1.200L7 13.500zM25 10l-5 1.200v1.200l5 1.100z" />,
  river: <path className="s" d="M7 12.500c3-2.500 6 2.500 9 0s6-2.500 9 0M7 17c3-2.500 6 2.500 9 0s6-2.500 9 0M9 21.500c2.500-2 4.500 2 7 0s4.500-2 7 0" />,
  sail: <path className="f" d="M15.200 7v11H8.500zM17 9.500 23 18h-6zM7.500 19.500h17l-2.500 4H10z" />,
  paddy: <path className="s" d="M16 24V9M16 13c-3.500 0-5-2-5-4.500 3 0 5 1.500 5 4.500zm0 0c3.500 0 5-2 5-4.500-3 0-5 1.500-5 4.500zm0 6c-3.500 0-5.500-2-5.500-4.500 3 0 5.500 1.500 5.500 4.500zm0 0c3.500 0 5.500-2 5.500-4.500-3 0-5.500 1.500-5.500 4.500z" />,
  tree: <path className="f" d="M16 6.500a6 6 0 0 1 5.800 7.600A4.200 4.200 0 0 1 20 22h-2.700v3h-2.600v-3H12a4.200 4.200 0 0 1-1.800-7.900A6 6 0 0 1 16 6.500z" />,
  flame: <path className="f" d="M16.500 6c.5 4 5.500 6 5.500 11.500a6 6 0 0 1-12 0c0-3 1.700-4.500 2.500-6.500 1 1 1.500 2 1.700 3.200C15.800 12 16.800 9.500 16.500 6z" />,
  palm: <path className="s" d="M16.500 24c.7-5 .5-8-.5-11M16 13c-2-3-5.500-3.500-8-1.500M16 13c2-3 5.500-3.500 8-1.500M16 13c-3.500-.5-5.500 1.500-6 4.500M16 13c3.500-.5 5.500 1.500 6 4.500M16 13c-.5-2.500.5-4.500 2-5.500" />,
  crown: <path className="f" d="M8 12l4 3.500L16 9l4 6.500 4-3.500-1.500 8h-13zM9.500 21.500h13v2h-13z" />,
  picks: <path className="s" d="M10 23 21 11M22 23 11 11M8 13.500c.5-3 3-5 6-5M24 13.500c-.5-3-3-5-6-5" />,
  drop: <path className="f" d="M16 6.500c3.500 5 6 8 6 11.500a6 6 0 0 1-12 0c0-3.500 2.500-6.500 6-11.500z" />,
  fish: <path className="f" d="M7 16c3-4.500 9-5.500 13-1.500l4.500-3v9l-4.500-3C16 21.500 10 20.500 7 16z" />,
  leaf: <path className="f" d="M23.500 8c.5 9-3.500 14-11 13.500L10 24l-1.500-1.500 2.500-2.500C10 12.500 15 8 23.500 8z" />,
  bird: <path className="f" d="M6.500 11c4 0 6.500 1.500 8 4.500C15.500 11 19 9 25.500 9.500 23 12 22.500 14 20.500 17c-2 3.500-6 4.500-10 3 2-.5 3-1 3.500-2-3.500-.5-6-3-7.500-7z" />,
  star: <path className="f" d="m16 6.500 2.600 6.200 6.700.6-5.100 4.400 1.500 6.500L16 20.700l-5.700 3.500 1.500-6.500-5.100-4.400 6.700-.6z" />,
} satisfies Record<string, ReactNode>

type Design = { shape: keyof typeof SHAPES; charge: keyof typeof CHARGES }

export const CRESTS: Record<string, Design> = {
  petaling: { shape: 'shield', charge: 'towers' },
  klang: { shape: 'round', charge: 'anchor' },
  'hulu-langat': { shape: 'hex', charge: 'hills' },
  gombak: { shape: 'shield', charge: 'cave' },
  sepang: { shape: 'swallow', charge: 'wing' },
  'kuala-selangor': { shape: 'shield', charge: 'lighthouse' },
  'hulu-selangor': { shape: 'round', charge: 'river' },
  'kuala-langat': { shape: 'swallow', charge: 'sail' },
  'sabak-bernam': { shape: 'hex', charge: 'paddy' },
  damansara: { shape: 'round', charge: 'tree' },
  kajang: { shape: 'shield', charge: 'flame' },
  kapar: { shape: 'hex', charge: 'palm' },
  'bukit-raja': { shape: 'swallow', charge: 'crown' },
  rawang: { shape: 'hex', charge: 'picks' },
  semenyih: { shape: 'round', charge: 'drop' },
  dengkil: { shape: 'swallow', charge: 'fish' },
  serendah: { shape: 'shield', charge: 'leaf' },
  ijok: { shape: 'round', charge: 'bird' },
  jugra: { shape: 'hex', charge: 'star' },
}

/** Decorative: the club's name is always next to it. */
export function Crest({ club, size = 28 }: { club: Pick<Club, 'id' | 'colors'>; size?: number }) {
  const { shape, charge } = CRESTS[club.id] ?? { shape: 'shield', charge: 'star' }
  const [main, second] = club.colors
  return (
    <svg className="crest-badge" width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false" style={{ '--crest': second } as React.CSSProperties}>
      <path d={SHAPES[shape]} fill={main} stroke={second} strokeWidth="2" strokeLinejoin="round" />
      <path d={SHAPES[shape]} fill="none" stroke="rgba(0,0,0,.28)" strokeWidth=".6" />
      {CHARGES[charge]}
    </svg>
  )
}
