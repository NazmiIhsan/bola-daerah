import { useState } from 'react'
import { Icon } from '../components/Icon'
import { useT } from '../LanguageContext'
import { pressText } from '../../i18n'
import type { Answer, GameState, PressConference } from '../../game/types'

const ANSWERS: Answer[] = ['confident', 'humble', 'combative']

export function PressScreen({ press, state, onSubmit, onSkip }: { press: PressConference; state: GameState; onSubmit(a: Answer[]): void; onSkip(): void }) {
  const { t, lang } = useT()
  const [answers, setAnswers] = useState<Answer[]>([])
  const i = answers.length
  const q = press.questions[Math.min(i, press.questions.length - 1)]
  const pick = (a: Answer) => {
    const next = [...answers, a]
    if (next.length >= press.questions.length) onSubmit(next)
    else setAnswers(next)
  }
  return (
    <div className="press card">
      <h2><Icon name="mic" /> {t('press.title')}</h2>
      <p className="muted small">{t('press.question', { n: i + 1, total: press.questions.length })}</p>
      <blockquote className="press-q">{pressText(lang, q, (id) => state.clubs[id]?.name ?? id)}</blockquote>
      <div className="press-answers">
        {ANSWERS.map((a) => (
          <button key={a} className={`press-a ${a}`} onClick={() => pick(a)}>
            <strong>{t(`press.a.${a}`)}</strong>
            <span className="small">{t(`press.a.${a}.quote`)}</span>
          </button>
        ))}
      </div>
      <button className="link" onClick={onSkip}>{t('press.skip')}</button>
    </div>
  )
}
