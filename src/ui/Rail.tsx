import { useMemo } from 'react'
import { useApp } from '../store/app'
import { useOrg, placementOf } from '../store/org'
import { waitingCount } from '../lib/select'
import { useT } from '../lib/i18n'
import { Icon } from './Icon'

/**
 * The switchboard itself: one jack per workspace, with a lamp that lights when
 * something in it is waiting for you.
 */
export function Rail({ onNewWorkspace, onEditWorkspace }: { onNewWorkspace: () => void; onEditWorkspace: (id: string) => void }) {
  const t = useT()
  const chats = useApp((s) => s.chats)
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const toggleSettings = useApp((s) => s.toggleSettings)
  const togglePalette = useApp((s) => s.togglePalette)
  const org = useOrg()

  const counts = useMemo(() => {
    const list = Object.values(chats)
    const byWs = new Map<string, typeof list>()
    const unsorted: typeof list = []
    for (const c of list) {
      const p = placementOf(c, org)
      if (p) byWs.set(p.ws, [...(byWs.get(p.ws) ?? []), c])
      else unsorted.push(c)
    }
    return {
      inbox: waitingCount(list, org),
      unsorted: waitingCount(unsorted, org),
      ws: Object.fromEntries(org.workspaces.map((w) => [w.id, waitingCount(byWs.get(w.id) ?? [], org)])),
    }
  }, [chats, org])

  const jack = (key: string, active: boolean, label: string, onClick: () => void, body: React.ReactNode, count: number, color?: string, onEdit?: () => void) => (
    <button
      key={key}
      className={`jack ${active ? 'active' : ''}`}
      onClick={onClick}
      onDoubleClick={onEdit}
      onContextMenu={
        onEdit
          ? (e) => {
              e.preventDefault()
              onEdit()
            }
          : undefined
      }
      title={label}
      aria-label={count ? `${label}, ${count}` : label}
      aria-current={active ? 'page' : undefined}
      style={color ? ({ '--ws': color } as React.CSSProperties) : undefined}
    >
      <span className="jack-plug">{body}</span>
      {count > 0 && <span className="jack-lamp">{count > 99 ? '99+' : count}</span>}
      <span className="jack-label">{label}</span>
    </button>
  )

  return (
    <nav className="rail" aria-label="Workspaces">
      <div className="rail-group">
        {jack('inbox', view.kind === 'inbox', t('nav.inbox'), () => setView({ kind: 'inbox' }), <Icon name="inbox" />, counts.inbox)}
        {jack('all', view.kind === 'all', t('nav.all'), () => setView({ kind: 'all' }), <Icon name="stack" />, 0)}
      </div>
      <div className="rail-sep" />
      <div className="rail-group rail-ws">
        {org.workspaces.map((w) =>
          jack(
            w.id,
            view.kind === 'ws' && view.id === w.id,
            w.name,
            () => setView({ kind: 'ws', id: w.id }),
            <b>{w.name.slice(0, 2)}</b>,
            counts.ws[w.id] ?? 0,
            w.color,
            () => onEditWorkspace(w.id),
          ),
        )}
        {jack('unsorted', view.kind === 'unsorted', t('nav.unsorted'), () => setView({ kind: 'unsorted' }), <Icon name="tray" />, counts.unsorted)}
        <button className="jack jack-add" onClick={onNewWorkspace} title={t('nav.newWorkspace')} aria-label={t('nav.newWorkspace')}>
          <span className="jack-plug">
            <Icon name="plus" />
          </span>
          <span className="jack-label">{t('nav.new')}</span>
        </button>
      </div>
      <div className="rail-group rail-bottom">
        <button className="jack" onClick={() => togglePalette(true)} title={`${t('nav.search')} (Ctrl K)`} aria-label={t('nav.search')}>
          <span className="jack-plug">
            <Icon name="search" />
          </span>
          <span className="jack-label">{t('nav.search')}</span>
        </button>
        <button className="jack" onClick={() => toggleSettings(true)} title={t('nav.settings')} aria-label={t('nav.settings')}>
          <span className="jack-plug">
            <Icon name="gear" />
          </span>
          <span className="jack-label">{t('nav.settings')}</span>
        </button>
      </div>
    </nav>
  )
}
