import { useState } from 'react'
import { useT } from '../LanguageContext'
import { useModal } from './useModal'

/** Asked once: what the game calls the user. */
export function NamePrompt({ onSave }: { onSave(name: string): void }) {
  const { t } = useT()
  const [name, setName] = useState('')
  const modal = useModal(() => {})
  return (
    <div className="modal-back">
      <div className="modal" {...modal} aria-label={t('name.title')}>
      <form className="name-form" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name) }}>
        <h2>{t('name.title')}</h2>
        <p>{t('name.body')}</p>
        <label className="field">
          <span className="small muted">{t('name.label')}</span>
          <input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="primary" type="submit" disabled={!name.trim()}>{t('name.save')}</button>
      </form>
      </div>
    </div>
  )
}
