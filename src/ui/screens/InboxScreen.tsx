import { useState } from 'react'
import { useT } from '../LanguageContext'
import { newsText } from '../../i18n'
import type { GameState, NewsKind } from '../../game/types'

const FILTERS: Array<NewsKind | 'all'> = ['all', 'match', 'fans', 'board', 'press', 'league', 'finance']
const ICON: Record<NewsKind, string> = { match: '⚽', league: '🏆', fans: '📣', board: '🏛️', press: '🎤', finance: '💰', career: '💼', transfer: '🔁' }

export function InboxScreen({ state, onRead }: { state: GameState; onRead(id: string): void }) {
  const { t, lang } = useT()
  const [filter, setFilter] = useState<NewsKind | 'all'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const clubName = (id: string) => state.clubs[id]?.name ?? id
  const items = state.inbox.filter((n) => filter === 'all' || n.kind === filter)
  return (
    <div className="card inbox">
      <h2>{t('inbox.title')}</h2>
      <div className="chips" role="group" aria-label={t('inbox.title')}>
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} aria-pressed={filter === f} onClick={() => setFilter(f)}>{t(`inbox.filter.${f}`)}</button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="muted">{t('inbox.empty')}</p>
      ) : (
        <ul className="news-list">
          {items.map((n) => {
            const { headline, body } = newsText(lang, n, clubName)
            const expanded = open === n.id
            return (
              <li key={n.id} className={`${n.read ? '' : 'unread'} ${n.important ? 'important' : ''}`}>
                <button className="news-item" aria-expanded={expanded} onClick={() => { setOpen(expanded ? null : n.id); if (!n.read) onRead(n.id) }}>
                  <span className="news-icon" aria-hidden>{ICON[n.kind]}</span>
                  <span className="news-main">
                    <span className="news-headline">{headline}</span>
                    <span className="muted small">{t('common.season', { season: n.season })} · {t('common.matchday', { n: n.matchday })}</span>
                    {expanded && body && <span className="news-body">{body}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
