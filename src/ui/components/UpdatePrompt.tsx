import { useRegisterSW } from 'virtual:pwa-register/react'
import { useT } from '../LanguageContext'

/** The banner itself, kept free of the service worker so it can be tested. */
export function UpdateBanner({ onReload, onLater }: { onReload: () => void; onLater: () => void }) {
  const { t } = useT()
  return (
    <div className="update-prompt" role="status">
      <span>{t('update.ready')}</span>
      <div className="update-actions">
        <button onClick={onLater}>{t('update.later')}</button>
        <button className="primary" onClick={onReload}>{t('update.reload')}</button>
      </div>
    </div>
  )
}

/** Registers the offline service worker and offers a reload when a new version is deployed. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return <UpdateBanner onReload={() => void updateServiceWorker(true)} onLater={() => setNeedRefresh(false)} />
}
