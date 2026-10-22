import { useEffect, useState } from 'react'
import { useApp } from '../store/app'
import { useOrg, placementOf, type Priority } from '../store/org'
import { useT, type Key } from '../lib/i18n'
import { snoozeTargets } from '../lib/format'
import { Avatar } from './bits'
import { Icon } from './Icon'
import { tgLink } from './Conversation'
import { ReminderMenu } from './Later'

export function Details() {
  const t = useT()
  const chat = useApp((s) => (s.openChatId ? s.chats[s.openChatId] : undefined))
  const close = () => useApp.getState().toggleDetails(false)
  const setMuted = useApp((s) => s.setMuted)
  const setArchived = useApp((s) => s.setArchived)
  const org = useOrg()
  const [note, setNote] = useState('')
  const [newTag, setNewTag] = useState('')

  useEffect(() => setNote(chat ? org.notes[chat.id] ?? '' : ''), [chat?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!chat) return null
  const manual = org.placement[chat.id]
  const p = placementOf(chat, org)
  const ws = p ? org.workspaces.find((w) => w.id === p.ws) : undefined
  const tags = org.chatTags[chat.id] ?? []
  const prio: Priority = org.priority[chat.id] ?? 'normal'
  const link = tgLink(chat)

  return (
    <aside className="details" aria-label={t('chat.details')}>
      <header className="details-head">
        <h2>{t('chat.details')}</h2>
        <button className="icon-btn" onClick={close} aria-label={t('settings.close')}>
          <Icon name="x" />
        </button>
      </header>
      <div className="details-body">
        <div className="details-id">
          <Avatar chat={chat} size={64} />
          <h3>{chat.title}</h3>
          <p className="muted">{t(`kind.${chat.kind}` as Key)}</p>
        </div>

        <div className="field">
          <span className="field-label">{t('details.workspace')}</span>
          <select
            value={p?.ws ?? ''}
            onChange={(e) => org.place([chat.id], e.target.value || null)}
            style={ws ? ({ '--ws': ws.color } as React.CSSProperties) : undefined}
          >
            <option value="">{t('details.none')}</option>
            {org.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          {p && !manual && <small className="muted">{t('details.byRule')}</small>}
        </div>
        {ws && ws.folders.length > 0 && (
          <div className="field">
            <span className="field-label">{t('details.folder')}</span>
            <select value={p?.folder ?? ''} onChange={(e) => org.place([chat.id], ws.id, e.target.value || undefined)}>
              <option value="">{t('list.noFolder')}</option>
              {ws.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <span className="field-label">{t('details.tags')}</span>
          <div className="chips">
            {org.tags.map((tg) => (
              <button
                key={tg.id}
                className={`chip tag ${tags.includes(tg.id) ? 'on' : ''}`}
                style={{ '--tag': tg.color } as React.CSSProperties}
                onClick={() => org.toggleTag([chat.id], tg.id, !tags.includes(tg.id))}
                aria-pressed={tags.includes(tg.id)}
              >
                {tg.name}
              </button>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!newTag.trim()) return
                const id = org.addTag(newTag.trim())
                useOrg.getState().toggleTag([chat.id], id, true)
                setNewTag('')
              }}
            >
              <input className="chip-input" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder={`+ ${t('details.newTag')}`} />
            </form>
          </div>
        </div>

        <div className="field">
          <span className="field-label">{t('details.priority')}</span>
          <div className="segmented" role="radiogroup">
            {(['high', 'normal', 'low'] as Priority[]).map((x) => (
              <button key={x} role="radio" aria-checked={prio === x} className={prio === x ? 'on' : ''} onClick={() => org.setPriority([chat.id], x)}>
                {t(x === 'high' ? 'details.pHigh' : x === 'low' ? 'details.pLow' : 'details.pNormal')}
              </button>
            ))}
          </div>
          <small className="muted">{t('details.pHelp')}</small>
        </div>

        <div className="field">
          <span className="field-label">{t('details.note')}</span>
          <textarea
            rows={4}
            value={note}
            placeholder={t('details.notePh')}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => org.setNote(chat.id, note)}
          />
        </div>

        <div className="field">
          <span className="field-label">{t('rem.button')}</span>
          <div className="details-reminder">
            <ReminderMenu key={chat.id} chatIds={[chat.id]} onDone={() => undefined} />
          </div>
        </div>

        <div className="details-actions">
          <button className="btn sm" onClick={() => setMuted([chat.id], !chat.muted)}>
            <Icon name={chat.muted ? 'bell' : 'mute'} size={16} /> {chat.muted ? t('bulk.unmute') : t('bulk.mute')}
          </button>
          <button className="btn sm" onClick={() => setArchived([chat.id], !chat.archived)}>
            <Icon name="archive" size={16} /> {chat.archived ? t('bulk.unarchive') : t('bulk.archive')}
          </button>
          {snoozeTargets()
            .slice(0, 1)
            .concat(snoozeTargets().filter((s) => s.key === 'snooze.tomorrow'))
            .map((s) => (
              <button key={s.key} className="btn sm" onClick={() => org.setSnooze([chat.id], s.at)}>
                <Icon name="clock" size={16} /> {t(s.key)}
              </button>
            ))}
          {link && (
            <a className="btn sm" href={link} target="_blank" rel="noreferrer">
              <Icon name="external" size={16} /> {t('chat.openTg')}
            </a>
          )}
        </div>
      </div>
    </aside>
  )
}
