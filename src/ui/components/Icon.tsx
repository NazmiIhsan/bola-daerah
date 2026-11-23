import type { ReactNode } from 'react'

/** Line icons drawn on a 24×24 grid. They take the text colour around them. */
const ICONS = {
  home: <><path d="M4 11 12 4l8 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
  news: <><path d="M4 5h13v14H6a2 2 0 0 1-2-2z" /><path d="M17 9h3v8a2 2 0 0 1-2 2h-1" /><path d="M7.5 9h6M7.5 12.5h6M7.5 16h4" /></>,
  stadium: <><ellipse cx="12" cy="8" rx="9" ry="3.5" /><path d="M3 8v7c0 2 4 3.5 9 3.5s9-1.5 9-3.5V8" /><path d="M8 11.2v7M16 11.2v7" /></>,
  squad: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.6 2.6-6 6-6s6 2.4 6 6" /><path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.8M17 14.4c2.4.7 4 2.8 4 5.6" /></>,
  transfers: <><path d="M4 8h14" /><path d="m14.5 4.5 3.5 3.5-3.5 3.5" /><path d="M20 16H6" /><path d="m9.5 12.5-3.5 3.5 3.5 3.5" /></>,
  youth: <><path d="M12 21v-9" /><path d="M12 13c0-4-2.5-6.5-7-6.5 0 4.5 2.5 6.5 7 6.500z" /><path d="M12 11c0-4.5 2.5-7 7-7 0 4.5-2.5 7-7 7z" /></>,
  tactics: <><rect x="4" y="3.5" width="16" height="17" rx="2" /><circle cx="8.5" cy="15.5" r="1.8" /><path d="m14 7 3 3M17 7l-3 3" /><path d="M10 13.500c1-2.5 2.5-3 4-3.2" /></>,
  table: <><path d="M4 20h16" /><path d="M6.5 20v-6M12 20V5M17.5 20v-10" strokeWidth="3" /></>,
  fixtures: <><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10.500h16M8.5 3v4M15.5 3v4" /></>,
  settings: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  ball: <><circle cx="12" cy="12" r="9" /><path d="m12 8 3.8 2.8-1.4 4.400H9.600l-1.4-4.400z" /><path d="M12 3v5M20.5 9.500l-4.7 1.300M17.5 19l-3.1-3.800M6.5 19l3.1-3.800M3.5 9.500l4.7 1.3" /></>,
  trophy: <><path d="M8 4h8v6a4 4 0 0 1-8 0z" /><path d="M8 6H4.500c0 3 1.5 4.5 3.7 4.500M16 6h3.500c0 3-1.5 4.5-3.7 4.5" /><path d="M12 14v3.500M8.5 20.500h7M10 17.500h4" /></>,
  megaphone: <><path d="M4 10v4h3l9 4.500v-13L7 10z" /><path d="M8 14.5 9.5 20H12" /><path d="M19 9.500a4 4 0 0 1 0 5" /></>,
  board: <><path d="M4 9.5 12 4l8 5.500z" /><path d="M6.5 12v5M12 12v5M17.5 12v5M4 20h16" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.500a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" /></>,
  money: <><ellipse cx="12" cy="6.5" rx="7" ry="3" /><path d="M5 6.500v5.500c0 1.7 3.1 3 7 3s7-1.3 7-3V6.5" /><path d="M5 12v5.500c0 1.7 3.1 3 7 3s7-1.3 7-3V12" /></>,
  briefcase: <><rect x="3.5" y="8" width="17" height="12" rx="2" /><path d="M9 8V5.500A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.500V8M3.5 13h17" /></>,
  up: <path d="M12 20V5M6 11l6-6 6 6" />,
  down: <path d="M12 4v15M6 13l6 6 6-6" />,
  back: <path d="M20 12H5M11 6l-6 6 6 6" />,
  star: <path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.300L12 17.200l-5.6 3.1 1.2-6.300L3 9.600l6.3-.8z" fill="currentColor" />,
  angry: <><circle cx="12" cy="12" r="9" /><path d="m7.5 8.5 3 1.500M16.5 8.500l-3 1.500M8.5 17c1-2 6-2 7 0" /><path d="M9 11.500v.1M15 11.500v.1" strokeWidth="2.5" /></>,
  worried: <><circle cx="12" cy="12" r="9" /><path d="M8.5 16.500c1-1.5 6-1.5 7 0" /><path d="M9 10v.1M15 10v.1" strokeWidth="2.5" /></>,
  happy: <><circle cx="12" cy="12" r="9" /><path d="M8 14c1.2 2.6 6.8 2.6 8 0" /><path d="M9 9.500v.1M15 9.500v.1" strokeWidth="2.5" /></>,
  delighted: <><circle cx="12" cy="12" r="9" /><path d="M7.5 13h9c-.3 3-2.2 4.5-4.5 4.500S7.8 16 7.5 13z" /><path d="M7.5 10c.7-1.5 2.3-1.5 3 0M13.5 10c.7-1.5 2.3-1.5 3 0" /></>,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof ICONS

/** Decorative: always put text (or a label) next to it. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className={`icon icon-${name}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {ICONS[name]}
    </svg>
  )
}
