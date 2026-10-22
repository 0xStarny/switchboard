import { useEffect, useState } from 'react'
import { useApp } from '../store/app'
import { useT } from '../lib/i18n'
import { Rail } from './Rail'
import { Sidebar, listOrder } from './Sidebar'
import { Conversation } from './Conversation'
import { Details } from './Details'
import { Palette, Settings, WorkspaceEditor } from './Panels'
import { Toasts } from './bits'

const typing = (el: EventTarget | null) => {
  const n = el as HTMLElement | null
  return !!n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable)
}

export function Shell() {
  const t = useT()
  const provider = useApp((s) => s.provider)
  const openChatId = useApp((s) => s.openChatId)
  const detailsOpen = useApp((s) => s.detailsOpen)
  const paletteOpen = useApp((s) => s.paletteOpen)
  const settingsOpen = useApp((s) => s.settingsOpen)
  const [editing, setEditing] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useApp.getState()
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        s.togglePalette()
        return
      }
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey || s.paletteOpen || s.settingsOpen) return
      const ids = listOrder.ids
      const at = s.openChatId ? ids.indexOf(s.openChatId) : -1
      if (e.key === 'j' || e.key === 'k') {
        const next = ids[e.key === 'j' ? Math.min(at + 1, ids.length - 1) : Math.max(at - 1, 0)]
        if (next) s.openChat(next)
      } else if (e.key === 'e' && s.openChatId) {
        // Triage: mark as read and move on to the next chat in the list.
        const next = ids[at + 1] ?? ids[at - 1]
        s.markRead([s.openChatId])
        if (next && next !== s.openChatId) s.openChat(next)
      } else if (e.key === 'Escape') {
        if (s.selection.length) s.clearSelection()
        else if (s.detailsOpen) s.toggleDetails(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={`app ${openChatId ? 'has-chat' : ''} ${detailsOpen && openChatId ? 'has-details' : ''}`}>
      {provider?.demo && (
        <div className="demo-banner">
          {t('demo.banner')}{' '}
          <button
            className="link-btn"
            onClick={() => {
              history.replaceState(null, '', location.pathname)
              location.reload()
            }}
          >
            {t('demo.leave')}
          </button>
        </div>
      )}
      <Rail onNewWorkspace={() => setEditing('new')} onEditWorkspace={setEditing} />
      <Sidebar onEditWorkspace={setEditing} />
      <Conversation />
      {detailsOpen && openChatId && <Details />}
      {editing && <WorkspaceEditor id={editing} onClose={() => setEditing(null)} />}
      {settingsOpen && <Settings onClose={() => useApp.getState().toggleSettings(false)} />}
      {paletteOpen && <Palette onClose={() => useApp.getState().togglePalette(false)} />}
      <Toasts />
    </div>
  )
}
