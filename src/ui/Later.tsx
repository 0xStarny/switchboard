import { useState } from 'react'
import { useApp } from '../store/app'
import { useOrg } from '../store/org'
import { dateLabel, laterTargets, toLocalInput } from '../lib/format'
import { explainError, useLang, useT } from '../lib/i18n'
import { Icon } from './Icon'

/** Ask once, from a click, so the browser can show reminders when they come due. */
export function askNotifications() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => undefined)
}

/** Preset horizons plus an exact date. Calls onPick with a timestamp in ms. */
function WhenPicker({ onPick, disabled }: { onPick: (at: number) => void; disabled?: boolean }) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const [custom, setCustom] = useState(toLocalInput(laterTargets()[0].at))
  const [error, setError] = useState('')
  return (
    <div className="when">
      {laterTargets().map((p) => (
        <button key={p.key} className="menu-item" disabled={disabled} onClick={() => onPick(p.at)}>
          <Icon name="clock" size={14} />
          <span className="grow">{t(p.key)}</span>
          <span className="muted small">{new Date(p.at).toLocaleDateString(lang, { weekday: 'short', day: 'numeric' })}</span>
        </button>
      ))}
      <form
        className="when-custom"
        onSubmit={(e) => {
          e.preventDefault()
          const at = new Date(custom).getTime()
          if (!at || at < Date.now() + 60000) return setError(t('when.past'))
          setError('')
          onPick(at)
        }}
      >
        <label className="field-label" htmlFor="when-custom">
          {t('when.custom')}
        </label>
        <div className="inline-form">
          <input id="when-custom" type="datetime-local" value={custom} min={toLocalInput(Date.now())} onChange={(e) => setCustom(e.target.value)} />
          <button className="btn sm" disabled={disabled}>
            OK
          </button>
        </div>
        {error && <p className="error small">{error}</p>}
      </form>
    </div>
  )
}

/** Reminder for one or many chats ("bring these back on Monday"). */
export function ReminderMenu({ chatIds, onDone }: { chatIds: string[]; onDone: () => void }) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const toast = useApp((s) => s.toast)
  const reminders = useOrg((s) => s.reminders)
  const addReminders = useOrg((s) => s.addReminders)
  const removeReminder = useOrg((s) => s.removeReminder)
  const existing = chatIds.length === 1 ? reminders.find((r) => r.chatId === chatIds[0]) : undefined
  const [note, setNote] = useState(existing?.note ?? '')
  const [ifNoReply, setIfNoReply] = useState(existing?.ifNoReply ?? false)

  return (
    <div className="later-menu">
      <p className="later-title">{t('rem.title')}</p>
      <p className="muted small">{t('rem.help')}</p>
      {existing && (
        <div className="later-current">
          <Icon name="alarm" size={15} />
          <span className="grow">{t('rem.current', { time: dateLabel(existing.at, lang) })}</span>
          <button
            className="link-btn sm"
            onClick={() => {
              removeReminder(existing.id)
              onDone()
            }}
          >
            {t('rem.remove')}
          </button>
        </div>
      )}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('rem.note')} aria-label={t('rem.note')} />
      <label className="check">
        <input type="checkbox" checked={ifNoReply} onChange={(e) => setIfNoReply(e.target.checked)} />
        {t('rem.ifNoReply')}
      </label>
      <WhenPicker
        onPick={(at) => {
          askNotifications()
          addReminders(chatIds, at, note, ifNoReply)
          toast(t('rem.set', { time: dateLabel(at, lang) }))
          onDone()
        }}
      />
    </div>
  )
}

/** "Send later" for the composer's current text. */
export function ScheduleMenu({ text, replyTo, onDone }: { text: string; replyTo?: number; onDone: () => void }) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const scheduleMessage = useApp((s) => s.scheduleMessage)
  const toast = useApp((s) => s.toast)
  const [cancelOnReply, setCancelOnReply] = useState(true)
  const [busy, setBusy] = useState(false)
  const empty = !text.trim()

  return (
    <div className="later-menu">
      <p className="later-title">{t('later.title')}</p>
      <p className="muted small">{t('later.help')}</p>
      {empty && <p className="error small">{t('later.needText')}</p>}
      <label className="check">
        <input type="checkbox" checked={cancelOnReply} onChange={(e) => setCancelOnReply(e.target.checked)} />
        {t('later.cancelOnReply')}
      </label>
      {cancelOnReply && <p className="muted small">{t('later.cancelHelp')}</p>}
      <WhenPicker
        disabled={empty || busy}
        onPick={async (at) => {
          setBusy(true)
          try {
            await scheduleMessage(text, at, { replyTo, cancelOnReply })
            toast(t('later.done', { time: dateLabel(at, lang) }))
            onDone()
          } catch (e) {
            toast(explainError(e), 'error')
          } finally {
            setBusy(false)
          }
        }}
      />
    </div>
  )
}

/** The queue of messages Telegram will send for this chat. */
export function ScheduledBar({ chatId }: { chatId: string }) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const list = useApp((s) => s.scheduled[chatId])
  const cancel = useApp((s) => s.cancelScheduled)
  const sendNow = useApp((s) => s.sendScheduledNow)
  const toast = useApp((s) => s.toast)
  const followups = useOrg((s) => s.followups)
  const [open, setOpen] = useState(false)
  if (!list?.length) return null

  const run = (fn: () => Promise<void>) => fn().catch((e) => toast(explainError(e), 'error'))

  return (
    <div className="scheduled">
      <button className="scheduled-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="later" size={16} />
        <span className="grow">{t('later.queue', { n: list.length })}</span>
        <span className="muted small">{dateLabel(list[0].date * 1000, lang)}</span>
        <Icon name={open ? 'down' : 'right'} size={14} />
      </button>
      {open && (
        <ul>
          {list.map((m) => (
            <li key={m.id}>
              <div className="scheduled-meta">
                <b>{dateLabel(m.date * 1000, lang)}</b>
                {followups.some((f) => f.scheduledId === m.id && f.chatId === chatId) && <span className="fu-pill">{t('later.isFollowup')}</span>}
              </div>
              <p className="scheduled-text">{m.text}</p>
              <div className="row-btns">
                <button className="btn sm" onClick={() => run(() => sendNow(chatId, [m.id]))}>
                  <Icon name="send" size={14} /> {t('later.sendNow')}
                </button>
                <button className="btn sm" onClick={() => run(() => cancel(chatId, [m.id]))}>
                  <Icon name="x" size={14} /> {t('later.cancel')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
