import { useState } from 'react'
import { useApp } from '../store/app'
import { useOrg } from '../store/org'
import { snoozeTargets } from '../lib/format'
import { explainError, useT } from '../lib/i18n'
import { Icon } from './Icon'
import { Popover } from './bits'
import { ReminderMenu } from './Later'

type Menu = 'move' | 'tag' | 'snooze' | 'remind' | null

export function BulkBar() {
  const t = useT()
  const selection = useApp((s) => s.selection)
  const chats = useApp((s) => s.chats)
  const clear = useApp((s) => s.clearSelection)
  const toast = useApp((s) => s.toast)
  const app = useApp.getState
  const org = useOrg()
  const [menu, setMenu] = useState<Menu>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [newTag, setNewTag] = useState('')

  const sel = selection.map((id) => chats[id]).filter(Boolean)
  const allMuted = sel.every((c) => c.muted)
  const allArchived = sel.every((c) => c.archived)

  const open = (m: Menu) => (e: React.MouseEvent<HTMLElement>) => {
    setAnchor(e.currentTarget)
    setMenu(menu === m ? null : m)
  }

  // Telegram calls go one by one through the rate-limited queue; tell people it is working.
  const remote = async (fn: (ids: string[]) => Promise<void>) => {
    const ids = [...selection]
    if (ids.length > 3) toast(t('bulk.working', { done: 0, n: ids.length }))
    try {
      await fn(ids)
      toast(t('bulk.done', { n: ids.length }))
      clear()
    } catch (e) {
      toast(explainError(e), 'error')
    }
  }

  const local = (fn: () => void) => {
    fn()
    toast(t('bulk.done', { n: selection.length }))
    setMenu(null)
    clear()
  }

  return (
    <div className="bulkbar" role="toolbar" aria-label={t('bulk.selected', { n: selection.length })}>
      <div className="bulk-head">
        <strong>{t('bulk.selected', { n: selection.length })}</strong>
        <button className="icon-btn sm" onClick={clear} aria-label={t('bulk.clear')} title={t('bulk.clear')}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="bulk-actions">
        <button className="btn sm" onClick={open('move')}>
          <Icon name="move" size={16} /> {t('bulk.move')}
        </button>
        <button className="btn sm" onClick={open('tag')}>
          <Icon name="tag" size={16} /> {t('bulk.tag')}
        </button>
        <button className="btn sm" onClick={open('remind')}>
          <Icon name="alarm" size={16} /> {t('rem.button')}
        </button>
        <button className="btn sm" onClick={open('snooze')}>
          <Icon name="clock" size={16} /> {t('bulk.snooze')}
        </button>
        <button className="btn sm" onClick={() => remote((ids) => app().markRead(ids))}>
          <Icon name="checks" size={16} /> {t('bulk.read')}
        </button>
        <button className="btn sm" onClick={() => remote((ids) => app().setMuted(ids, !allMuted))}>
          <Icon name={allMuted ? 'bell' : 'mute'} size={16} /> {allMuted ? t('bulk.unmute') : t('bulk.mute')}
        </button>
        <button className="btn sm" onClick={() => remote((ids) => app().setArchived(ids, !allArchived))}>
          <Icon name="archive" size={16} /> {allArchived ? t('bulk.unarchive') : t('bulk.archive')}
        </button>
      </div>

      {menu === 'move' && (
        <Popover anchor={anchor} onClose={() => setMenu(null)}>
          {org.workspaces.map((w) => (
            <div key={w.id}>
              <button className="menu-item" onClick={() => local(() => org.place(selection, w.id))}>
                <span className="ws-dot" style={{ '--ws': w.color } as React.CSSProperties} /> {w.name}
              </button>
              {w.folders.map((f) => (
                <button key={f.id} className="menu-item sub" onClick={() => local(() => org.place(selection, w.id, f.id))}>
                  <Icon name="folder" size={14} /> {f.name}
                </button>
              ))}
            </div>
          ))}
          {org.workspaces.length > 0 && <hr />}
          <button className="menu-item" onClick={() => local(() => org.place(selection, null))}>
            <Icon name="tray" size={14} /> {t('bulk.removeWs')}
          </button>
        </Popover>
      )}
      {menu === 'tag' && (
        <Popover anchor={anchor} onClose={() => setMenu(null)}>
          {org.tags.map((tg) => {
            const all = selection.every((id) => (org.chatTags[id] ?? []).includes(tg.id))
            return (
              <button key={tg.id} className="menu-item" onClick={() => org.toggleTag(selection, tg.id, !all)}>
                <span className="check-box">{all && <Icon name="check" size={12} />}</span>
                <span className="tag-pill" style={{ '--tag': tg.color } as React.CSSProperties}>
                  {tg.name}
                </span>
              </button>
            )
          })}
          <form
            className="menu-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newTag.trim()) return
              const id = org.addTag(newTag.trim())
              useOrg.getState().toggleTag(selection, id, true)
              setNewTag('')
            }}
          >
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder={t('details.newTag')} aria-label={t('details.newTag')} />
          </form>
        </Popover>
      )}
      {menu === 'remind' && (
        <Popover anchor={anchor} onClose={() => setMenu(null)}>
          <ReminderMenu
            chatIds={selection}
            onDone={() => {
              setMenu(null)
              clear()
            }}
          />
        </Popover>
      )}
      {menu === 'snooze' && (
        <Popover anchor={anchor} onClose={() => setMenu(null)}>
          {snoozeTargets().map((s) => (
            <button key={s.key} className="menu-item" onClick={() => local(() => org.setSnooze(selection, s.at))}>
              <Icon name="clock" size={14} /> {t(s.key)}
            </button>
          ))}
        </Popover>
      )}
    </div>
  )
}
