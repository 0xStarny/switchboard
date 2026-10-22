import { useMemo, useState } from 'react'
import { useApp, type ListFilter } from '../store/app'
import { useOrg, placementOf } from '../store/org'
import { inboxSections, snoozedChats, visibleChats } from '../lib/select'
import { preview, shortTime, whenLabel } from '../lib/format'
import { useLang, useT, type Key } from '../lib/i18n'
import type { Chat } from '../tg/types'
import { Avatar, Lamp, kindIcon } from './bits'
import { Icon } from './Icon'
import { BulkBar } from './BulkBar'

/** Current list order, shared with the J/K keyboard shortcuts. */
export const listOrder: { ids: string[] } = { ids: [] }

const FILTERS: ListFilter[] = ['all', 'unread', 'groups', 'channels', 'dms', 'muted', 'archived']

export function Sidebar({ onEditWorkspace }: { onEditWorkspace: (id: string) => void }) {
  const t = useT()
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const selection = useApp((s) => s.selection)
  const ws = useOrg((s) => (view.kind === 'ws' ? s.workspaces.find((w) => w.id === view.id) : undefined))

  const title =
    view.kind === 'inbox' ? t('nav.inbox') : view.kind === 'all' ? t('nav.all') : view.kind === 'unsorted' ? t('nav.unsorted') : ws?.name ?? ''

  return (
    <aside className="sidebar" style={ws ? ({ '--ws': ws.color } as React.CSSProperties) : undefined}>
      <header className="side-head">
        <h1>
          {ws && <span className="ws-dot" />}
          {title}
        </h1>
        {ws && (
          <button className="icon-btn" onClick={() => onEditWorkspace(ws.id)} aria-label={t('ws.edit')} title={t('ws.edit')}>
            <Icon name="edit" />
          </button>
        )}
      </header>
      {ws && ws.folders.length > 0 && (
        <div className="folder-tabs" role="tablist">
          <button role="tab" aria-selected={!('folder' in view && view.folder)} onClick={() => setView({ kind: 'ws', id: ws.id })}>
            {t('list.allFolders')}
          </button>
          {ws.folders.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={view.kind === 'ws' && view.folder === f.id}
              onClick={() => setView({ kind: 'ws', id: ws.id, folder: f.id })}
            >
              <Icon name="folder" size={14} /> {f.name}
            </button>
          ))}
        </div>
      )}
      {view.kind === 'inbox' ? <Inbox /> : <ChatList />}
      {selection.length > 0 && <BulkBar />}
    </aside>
  )
}

function ChatList() {
  const t = useT()
  const chats = useApp((s) => s.chats)
  const view = useApp((s) => s.view)
  const filter = useApp((s) => s.filter)
  const setFilter = useApp((s) => s.setFilter)
  const tagFilter = useApp((s) => s.tagFilter)
  const setTagFilter = useApp((s) => s.setTagFilter)
  const query = useApp((s) => s.query)
  const setQuery = useApp((s) => s.setQuery)
  const org = useOrg()

  const list = useMemo(() => visibleChats(chats, org, view, filter, tagFilter, query), [chats, org, view, filter, tagFilter, query])
  listOrder.ids = list.map((c) => c.id)

  return (
    <>
      <div className="side-tools">
        <label className="search">
          <Icon name="search" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('list.search')} aria-label={t('list.search')} />
          {query && (
            <button className="icon-btn sm" onClick={() => setQuery('')} aria-label={t('chat.cancel')}>
              <Icon name="x" size={14} />
            </button>
          )}
        </label>
        <div className="chips" role="radiogroup" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f} role="radio" aria-checked={filter === f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
              {t(`filter.${f}` as Key)}
            </button>
          ))}
        </div>
        {org.tags.length > 0 && (
          <div className="chips tags">
            {org.tags.map((tg) => (
              <button
                key={tg.id}
                className={`chip tag ${tagFilter === tg.id ? 'on' : ''}`}
                style={{ '--tag': tg.color } as React.CSSProperties}
                onClick={() => setTagFilter(tagFilter === tg.id ? undefined : tg.id)}
              >
                <Icon name="tag" size={12} /> {tg.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="list" role="listbox" aria-multiselectable="true">
        {list.length === 0 && <p className="empty">{view.kind === 'ws' && !query && filter === 'all' ? t('list.emptyWs') : t('list.empty')}</p>}
        {list.map((c) => (
          <ChatRow key={c.id} chat={c} showWs={view.kind === 'all'} />
        ))}
      </div>
      <footer className="side-foot">{t('list.count', { n: list.length })}</footer>
    </>
  )
}

function Inbox() {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const chats = useApp((s) => s.chats)
  const held = useApp((s) => s.held)
  const markRead = useApp((s) => s.markRead)
  const org = useOrg()
  const setSnooze = useOrg((s) => s.setSnooze)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const sections = useMemo(() => {
    const h = held && chats[held.id]
    return inboxSections(h ? { ...chats, [h.id]: { ...h, unread: held.unread, mentions: held.mentions } } : chats, org)
  }, [chats, org, held])
  const snoozed = useMemo(() => snoozedChats(chats, org), [chats, org])
  listOrder.ids = sections.filter((s) => !(s.collapsed && !open[s.key])).flatMap((s) => s.chats.map((c) => c.id))

  if (!sections.length && !snoozed.length)
    return (
      <div className="list">
        <p className="empty inbox-empty">{t('inbox.empty')}</p>
      </div>
    )

  return (
    <div className="list">
      {sections.map((s) => {
        const expanded = !s.collapsed || open[s.key]
        return (
          <section key={s.key} className="inbox-sec" style={s.color ? ({ '--ws': s.color } as React.CSSProperties) : undefined}>
            <header>
              <button className="sec-toggle" onClick={() => setOpen({ ...open, [s.key]: !expanded })} aria-expanded={expanded}>
                <Icon name={expanded ? 'down' : 'right'} size={14} />
                {s.color && <span className="ws-dot" />}
                {s.translate ? t(s.title as Key) : s.title}
                <span className="sec-count">{s.chats.length}</span>
              </button>
              <button className="link-btn sm" onClick={() => markRead(s.chats.map((c) => c.id))} title={t('inbox.markAll')}>
                <Icon name="checks" size={16} />
                <span className="sr-only">{t('inbox.markAll')}</span>
              </button>
            </header>
            {expanded && s.chats.map((c) => <ChatRow key={c.id} chat={chats[c.id] ?? c} showWs={s.key === 'first' || s.key === 'muted'} />)}
          </section>
        )
      })}
      {snoozed.length > 0 && (
        <section className="inbox-sec snoozed">
          <header>
            <button className="sec-toggle" onClick={() => setOpen({ ...open, snoozed: !open.snoozed })} aria-expanded={!!open.snoozed}>
              <Icon name={open.snoozed ? 'down' : 'right'} size={14} />
              <Icon name="clock" size={14} /> {t('inbox.snoozed')}
              <span className="sec-count">{snoozed.length}</span>
            </button>
          </header>
          {open.snoozed &&
            snoozed.map((c) => (
              <div key={c.id} className="snooze-row">
                <ChatRow chat={c} />
                <div className="snooze-meta">
                  {t('inbox.until', { time: whenLabel(org.snooze[c.id], lang) })}
                  <button className="link-btn sm" onClick={() => setSnooze([c.id], null)}>
                    {t('inbox.wake')}
                  </button>
                </div>
              </div>
            ))}
        </section>
      )}
    </div>
  )
}

export function ChatRow({ chat, showWs }: { chat: Chat; showWs?: boolean }) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const openChatId = useApp((s) => s.openChatId)
  const openChat = useApp((s) => s.openChat)
  const selected = useApp((s) => s.selection.includes(chat.id))
  const selecting = useApp((s) => s.selection.length > 0)
  const select = useApp((s) => s.select)
  const org = useOrg()
  const p = showWs ? placementOf(chat, org) : null
  const ws = p ? org.workspaces.find((w) => w.id === p.ws) : undefined
  const tags = (org.chatTags[chat.id] ?? []).map((id) => org.tags.find((x) => x.id === id)).filter(Boolean)
  const prio = org.priority[chat.id]
  const sender = chat.last && chat.kind === 'group' ? (chat.last.out ? t('chat.you') : chat.last.senderName?.split(' ')[0]) : chat.last?.out ? t('chat.you') : ''

  const onClick = (e: React.MouseEvent) => {
    if (e.shiftKey) return select(chat.id, 'range', listOrder.ids)
    if (e.metaKey || e.ctrlKey || selecting) return select(chat.id, 'toggle')
    openChat(chat.id)
  }

  return (
    <div
      className={`row ${openChatId === chat.id ? 'open' : ''} ${selected ? 'selected' : ''} ${chat.unread || chat.mentions ? 'unread' : ''} ${chat.muted ? 'muted' : ''}`}
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && openChat(chat.id)}
    >
      <button
        className="row-check"
        aria-label="Select"
        onClick={(e) => {
          e.stopPropagation()
          select(chat.id, e.shiftKey ? 'range' : 'toggle', listOrder.ids)
        }}
      >
        {selected ? <Icon name="check" size={14} /> : null}
      </button>
      <Avatar chat={chat} />
      <div className="row-main">
        <div className="row-top">
          <span className="row-title">
            {chat.kind !== 'user' && <Icon name={kindIcon(chat.kind)} size={14} className="row-kind" />}
            <span className="ellipsis">{chat.title}</span>
            {chat.muted && <Icon name="mute" size={13} className="row-muted" />}
            {prio === 'high' && <span className="prio" title={t('details.pHigh')} />}
          </span>
          <time className="row-time">{chat.last ? shortTime(chat.last.date, lang) : ''}</time>
        </div>
        <div className="row-bottom">
          <span className="row-preview ellipsis">
            {sender && <b>{sender}: </b>}
            {preview(chat.last, lang)}
          </span>
          <Lamp chat={chat} />
        </div>
        {(ws || tags.length > 0) && (
          <div className="row-meta">
            {ws && (
              <span className="ws-pill" style={{ '--ws': ws.color } as React.CSSProperties}>
                {ws.name}
              </span>
            )}
            {tags.map((tg) => (
              <span key={tg!.id} className="tag-pill" style={{ '--tag': tg!.color } as React.CSSProperties}>
                {tg!.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
