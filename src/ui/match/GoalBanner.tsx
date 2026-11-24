import { useT } from '../LanguageContext'

const PIECES = Array.from({ length: 18 }, (_, i) => i)

/** Celebration over the pitch. The commentary announces the goal, so this stays silent. */
export function GoalBanner({ player, club, colors }: { player: string; club: string; colors: [string, string] }) {
  const { t } = useT()
  return (
    <div className="goal-banner" data-testid="goal" aria-hidden>
      {PIECES.map((i) => <i key={i} className="confetti" style={{ left: `${(i * 37) % 100}%`, background: colors[i % 2], animationDelay: `${(i % 6) * 90}ms` }} />)}
      <div className="goal-text" style={{ borderColor: colors[0] }}>
        <strong>{t('match.goal')}</strong>
        <span>{player}</span>
        <span className="small">{club}</span>
      </div>
    </div>
  )
}
