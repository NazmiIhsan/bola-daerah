import { useT } from '../LanguageContext'
import { matchStats } from '../../game/match/stats'
import type { MatchEvent, MatchState, Side } from '../../game/match/types'

export function MatchStats({ events, possession, colors }: { events: MatchEvent[]; possession: MatchState['possession']; colors: Record<Side, [string, string]> }) {
  const { t } = useT()
  const st = matchStats(events)
  const minutes = possession.home + possession.away
  const homePct = minutes ? Math.round((possession.home / minutes) * 100) : 50
  const rows: Array<[string, number, number, string]> = [
    ['possession', homePct, 100 - homePct, '%'],
    ['shots', st.home.shots, st.away.shots, ''],
    ['onTarget', st.home.onTarget, st.away.onTarget, ''],
    ['yellow', st.home.yellow, st.away.yellow, ''],
    ['red', st.home.red, st.away.red, ''],
  ]
  return (
    <section className="card mstats" role="region" aria-label={t('match.stats')}>
      <h3>{t('match.stats')}</h3>
      {rows.map(([key, h, a, unit]) => (
        <div key={key} className="mstat">
          <div className="mstat-top"><strong>{h}{unit}</strong><span className="small muted">{t(`match.stat.${key}`)}</span><strong>{a}{unit}</strong></div>
          <div className="mstat-bar" aria-hidden>
            <span style={{ flexGrow: h, background: colors.home[0] }} />
            <span style={{ flexGrow: a, background: colors.away[0] }} />
          </div>
        </div>
      ))}
    </section>
  )
}
