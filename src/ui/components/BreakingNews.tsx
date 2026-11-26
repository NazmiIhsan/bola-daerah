import { useT } from '../LanguageContext'
import { newsText } from '../../i18n'
import { storyParams } from '../../game/story'
import type { GameState, StoryEvent } from '../../game/types'
import { Icon } from './Icon'
import { useModal } from './useModal'

/** Text params for a story: ids become club names, money is already written out. */
function textParams(s: GameState, e: StoryEvent): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(storyParams(e.params))) {
    if (k.endsWith('Id') && typeof v === 'string') out[k.slice(0, -2)] = s.clubs[v]?.name ?? v
    else out[k] = v
  }
  if (out.pos) out.pos = String(out.pos)
  return out
}

/** A story waiting for the manager's call. There is no way out but to choose. */
function StoryChoice({ state, event: e, onDecide }: { state: GameState; event: StoryEvent; onDecide(option: string): void }) {
  const { t } = useT()
  const modal = useModal(() => {})
  const p = textParams(state, e)
  const title = e.kind === 'wedding' ? t(`story.wedding.title.${e.params.what}`, p) : t(`story.${e.kind}.title`, p)
  const body = e.kind === 'sponsor' ? t(`story.sponsor.body.${e.params.catch}`, p) : t(`story.${e.kind}.body`, p)
  return (
    <div className="modal-back">
      <div className="modal breaking" {...modal} aria-label={title}>
        <p className="breaking-tag"><span className="dot" aria-hidden /> {t('story.breaking')} · {t('common.matchday', { n: e.matchday })}</p>
        <h2>{title}</h2>
        <p>{body}</p>
        <p className="small muted">{t('story.decide')}</p>
        <div className="choices">
          {e.options.map((o, i) => (
            <button key={o} className={`choice ${i === 0 ? 'primary' : ''}`} onClick={() => onDecide(o)}>
              <strong>{t(`story.${e.kind}.opt.${o}`, p)}</strong>
              <span className="small">{t(`story.${e.kind}.hint.${o}`, p)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Headlines with no decision: shown together, once. */
function Headlines({ state, ids, onSeen }: { state: GameState; ids: string[]; onSeen(ids: string[]): void }) {
  const { t, lang } = useT()
  const close = () => onSeen(ids)
  const modal = useModal(close)
  const items = state.inbox.filter((n) => ids.includes(n.id))
  const shown = items.slice(0, 3)
  return (
    <div className="modal-back" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) close() }}>
      <div className="modal breaking" {...modal} aria-label={t('story.breaking')}>
        <p className="breaking-tag"><span className="dot" aria-hidden /> {t('story.breaking')}</p>
        <ul className="headlines">
          {shown.map((n) => {
            const { headline, body } = newsText(lang, n, (id) => state.clubs[id]?.name ?? id)
            return <li key={n.id}><Icon name="news" size={16} /> <div><strong>{headline}</strong>{body && <span className="small muted">{body}</span>}</div></li>
          })}
        </ul>
        {items.length > shown.length && <p className="small muted">{t('story.more', { n: items.length - shown.length })}</p>}
        <button className="primary" onClick={close}>{t('story.ok')}</button>
      </div>
    </div>
  )
}

/** Breaking news on the home screens: a decision first, otherwise any unseen headlines. */
export function BreakingNews({ state, onDecide, onSeen }: { state: GameState; onDecide(option: string): void; onSeen(ids: string[]): void }) {
  const e = state.story?.pending
  if (e) return <StoryChoice key={e.id} state={state} event={e} onDecide={onDecide} />
  const ids = state.inbox.filter((n) => n.breaking && !n.read && n.season === state.season).map((n) => n.id)
  return ids.length ? <Headlines state={state} ids={ids} onSeen={onSeen} /> : null
}
