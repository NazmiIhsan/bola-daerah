import { useT, LanguageToggle } from '../LanguageContext'
import { exportSave } from '../../save/storage'
import type { GameApi } from '../useGame'

export function SettingsScreen({ game }: { game: GameApi }) {
  const { t } = useT()
  const s = game.state!
  function download() {
    const blob = new Blob([exportSave(s)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bola-daerah-${s.userClubId}-${s.season}-md${s.matchday}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div className="card settings">
      <h2>{t('settings.title')}</h2>
      <div className="row"><span>{t('common.language')}</span><LanguageToggle /></div>
      <div className="row"><button onClick={download}>{t('settings.export')}</button></div>
      <div className="row"><button onClick={() => void game.quit()}>{t('settings.quit')}</button></div>
      {game.storageOk && (
        <div className="row"><button className="danger" onClick={() => { if (confirm(t('settings.deleteSave') + '?')) void game.removeSave() }}>{t('settings.deleteSave')}</button></div>
      )}
    </div>
  )
}
