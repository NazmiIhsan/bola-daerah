import { useT, LanguageToggle } from '../LanguageContext'
import { ThemeToggle } from '../ThemeToggle'
import { exportSave } from '../../save/storage'
import type { GameApi } from '../useGame'

const Out = ({ href, children }: { href: string; children: string }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>

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
      <div className="row"><span>{t('settings.theme')}</span><ThemeToggle /></div>
      <div className="row"><button onClick={download}>{t('settings.export')}</button></div>
      <div className="row"><button onClick={() => void game.quit()}>{t('settings.quit')}</button></div>
      {game.storageOk && (
        <div className="row"><button className="danger" onClick={() => { if (confirm(t('settings.deleteSave') + '?')) void game.removeSave() }}>{t('settings.deleteSave')}</button></div>
      )}
      <p className="small muted credits">
        {t('settings.faces')} <Out href="https://personas.draftbit.com/">Personas by Draftbit</Out> (<Out href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</Out>, {t('settings.adapted')}), <Out href="https://www.dicebear.com/">DiceBear</Out>
      </p>
    </div>
  )
}
