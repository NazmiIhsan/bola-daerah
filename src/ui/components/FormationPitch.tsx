import { useT } from '../LanguageContext'
import { slotPositions } from './formationLayout'
import { slotRoles } from '../../game/tactics'
import type { Player, Tactics } from '../../game/types'

export function FormationPitch({ tactics, players, onSwap, selected, onSelect, onPitch }: {
  tactics: Tactics
  players: Record<string, Player>
  /** Called when a second player is clicked after a first. */
  onSwap?(a: string, b: string): void
  selected?: string | null
  onSelect?(id: string | null): void
  /** Override who is on the pitch (in-match); '' = empty slot. */
  onPitch?: string[]
}) {
  const { t } = useT()
  const ids = onPitch ?? tactics.lineup
  const pos = slotPositions(tactics.formation)
  const roles = slotRoles(tactics.formation)
  const click = (id: string) => {
    if (!onSelect) return
    if (selected && selected !== id) { onSwap?.(selected, id); onSelect(null) }
    else onSelect(selected === id ? null : id)
  }
  return (
    <div className="formation-pitch" data-testid="pitch">
      <div className="fp-lines" aria-hidden><span className="fp-half" /><span className="fp-circle" /><span className="fp-box top" /><span className="fp-box bottom" /></div>
      {pos.map((p, i) => {
        const id = ids[i]
        const pl = id ? players[id] : undefined
        return (
          <div key={i} className="fp-slot" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            {pl ? (
              <button
                className={`fp-player ${selected === id ? 'sel' : ''} ${pl.position !== roles[i] ? 'oop' : ''}`}
                aria-label={`${pl.firstName} ${pl.lastName} (${t(`pos.${roles[i]}`)})`}
                onClick={() => click(id)}
              >
                <span className={`pos ${roles[i]}`}>{t(`pos.${roles[i]}`)}</span>
                <span className="fp-name">{pl.lastName}</span>
              </button>
            ) : (
              <span className="fp-empty">{t(`pos.${roles[i]}`)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
