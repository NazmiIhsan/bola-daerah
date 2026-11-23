import { useState } from 'react'
import { useT } from '../LanguageContext'
import { FORMATIONS, isAvailable, pickBestLineup, reslot, swapInTactics, teamStrength } from '../../game/tactics'
import { overall } from '../../game/generate'
import type { FormationId, GameState, Player, Style, Tactics } from '../../game/types'
import { FormationPitch } from '../components/FormationPitch'

const STYLES: Style[] = ['attacking', 'balanced', 'defensive', 'counter']

export function StrengthBars({ tactics, players }: { tactics: Tactics; players: Record<string, Player> }) {
  const { t } = useT()
  const st = teamStrength(tactics.lineup.map((id) => players[id]), tactics.formation)
  const bars: Array<[string, number]> = [[t('tactics.attack'), st.attack], [t('tactics.midfield'), st.midfield], [t('tactics.defence'), st.defence]]
  return (
    <div className="strength">
      {bars.map(([label, v]) => (
        <div key={label} className="sbar">
          <span className="small">{label}</span>
          <span className="meter wide" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={20} aria-valuenow={Math.round(v * 10) / 10}>
            <span style={{ width: `${Math.min(100, (v / 20) * 100)}%` }} />
          </span>
          <strong className="small">{v.toFixed(1)}</strong>
        </div>
      ))}
    </div>
  )
}

function PlayerRow({ p, selected, onClick }: { p: Player; selected: boolean; onClick(): void }) {
  const { t } = useT()
  const status = p.injuredWeeks > 0 ? t('squad.injured', { n: p.injuredWeeks }) : p.suspendedMatches > 0 ? t('squad.suspended') : ''
  return (
    <button className={`prow ${selected ? 'sel' : ''} ${isAvailable(p) ? '' : 'out'}`} aria-label={`${p.firstName} ${p.lastName}${status ? ` – ${status}` : ''}`} onClick={onClick}>
      <span className={`pos ${p.position}`}>{t(`pos.${p.position}`)}</span>
      <span className="left grow">{p.firstName} {p.lastName}</span>
      {status && <span className="tag bad">{status}</span>}
      <strong>{Math.round(overall(p))}</strong>
    </button>
  )
}

export function TacticsScreen({ state, onChange }: { state: GameState; onChange(t: Tactics): void }) {
  const { t } = useT()
  const [selected, setSelected] = useState<string | null>(null)
  const tac = state.tactics[state.userClubId]
  const squad = Object.values(state.players).filter((p) => p.clubId === state.userClubId)
  const byId = state.players
  const subs = tac.subs.map((id) => byId[id]).filter(Boolean)
  const reserves = squad.filter((p) => !tac.lineup.includes(p.id) && !tac.subs.includes(p.id)).sort((a, b) => overall(b) - overall(a))
  const swap = (a: string, b: string) => onChange(swapInTactics(tac, a, b, byId))
  const clickRow = (id: string) => {
    if (selected && selected !== id) { swap(selected, id); setSelected(null) }
    else setSelected(selected === id ? null : id)
  }

  return (
    <div className="tactics">
      <section className="card">
        <div className="row between">
          <h2>{t('tactics.title')}</h2>
          <button onClick={() => onChange({ ...tac, ...pickBestLineup(squad, tac.formation) })}>{t('tactics.autopick')}</button>
        </div>
        <div className="row">
          <label htmlFor="formation">{t('tactics.formation')}</label>
          <select id="formation" value={tac.formation} onChange={(e) => onChange(reslot(tac, e.target.value as FormationId, byId))}>
            {(Object.keys(FORMATIONS) as FormationId[]).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="row style-row" role="group" aria-label={t('tactics.style')}>
          {STYLES.map((s) => (
            <button key={s} className={tac.style === s ? 'primary' : ''} aria-pressed={tac.style === s} onClick={() => onChange({ ...tac, style: s })}>{t(`style.${s}`)}</button>
          ))}
        </div>
        {tac.lineup.length < 11 && <p className="banner warn">{t('tactics.short', { n: tac.lineup.length })}</p>}
        <p className="muted small">{t('tactics.swapHint')}</p>
        <StrengthBars tactics={tac} players={byId} />
      </section>
      <section className="card">
        <h2>{t('tactics.starting')}</h2>
        <FormationPitch tactics={tac} players={byId} selected={selected} onSelect={setSelected} onSwap={swap} />
      </section>
      <section className="card">
        <h3>{t('tactics.bench')}</h3>
        <div data-testid="bench" className="plist">
          {subs.map((p) => <PlayerRow key={p.id} p={p} selected={selected === p.id} onClick={() => clickRow(p.id)} />)}
        </div>
        <h3>{t('tactics.reserves')}</h3>
        <div data-testid="reserves" className="plist">
          {reserves.map((p) => <PlayerRow key={p.id} p={p} selected={selected === p.id} onClick={() => clickRow(p.id)} />)}
        </div>
      </section>
    </div>
  )
}
