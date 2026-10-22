import type { Chat } from '../tg/types'
import { placementOf, type OrgData } from '../store/org'
import type { ListFilter, View } from '../store/app'

type Org = Pick<OrgData, 'placement' | 'rules' | 'workspaces' | 'chatTags' | 'priority' | 'snooze'>

const lastDate = (c: Chat) => c.last?.date ?? 0

export function byRecent(org: Org) {
  return (a: Chat, b: Chat) => {
    const pa = org.priority[a.id] === 'high' ? 1 : 0
    const pb = org.priority[b.id] === 'high' ? 1 : 0
    if (pa !== pb) return pb - pa
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return lastDate(b) - lastDate(a)
  }
}

export function inView(c: Chat, view: View, org: Org): boolean {
  if (view.kind === 'all' || view.kind === 'inbox') return true
  const p = placementOf(c, org)
  if (view.kind === 'unsorted') return !p
  if (!p || p.ws !== view.id) return false
  return view.folder ? p.folder === view.folder : true
}

export function matchesFilter(c: Chat, f: ListFilter): boolean {
  if (f === 'archived') return c.archived
  if (c.archived) return false
  switch (f) {
    case 'unread':
      return c.unread > 0 || c.mentions > 0
    case 'groups':
      return c.kind === 'group'
    case 'channels':
      return c.kind === 'channel'
    case 'dms':
      return c.kind === 'user' || c.kind === 'bot'
    case 'muted':
      return c.muted
    default:
      return true
  }
}

export function visibleChats(
  chats: Record<string, Chat>,
  org: Org,
  view: View,
  filter: ListFilter,
  tagFilter: string | undefined,
  query: string,
): Chat[] {
  const q = query.trim().toLowerCase()
  return Object.values(chats)
    .filter((c) => inView(c, view, org))
    .filter((c) => matchesFilter(c, filter))
    .filter((c) => !tagFilter || (org.chatTags[c.id] ?? []).includes(tagFilter))
    .filter((c) => !q || c.title.toLowerCase().includes(q) || (c.username ?? '').toLowerCase().includes(q))
    .sort(byRecent(org))
}

export const isSnoozed = (c: Chat, org: Org, now = Date.now()) => (org.snooze[c.id] ?? 0) > now

/** A chat "needs attention" when it is unread, not archived, not snoozed and not set to low priority. */
export function needsAttention(c: Chat, org: Org, now = Date.now()) {
  if (c.archived || isSnoozed(c, org, now)) return false
  if (org.priority[c.id] === 'low' && c.mentions === 0) return false
  return c.unread > 0 || c.mentions > 0
}

export interface InboxSection {
  key: string
  title: string // i18n key or workspace name
  color?: string
  chats: Chat[]
  collapsed?: boolean
  translate: boolean
}

export function inboxSections(chats: Record<string, Chat>, org: Org, now = Date.now()): InboxSection[] {
  const sort = byRecent(org)
  const all = Object.values(chats).filter((c) => needsAttention(c, org, now))
  const first: Chat[] = []
  const muted: Chat[] = []
  const byWs = new Map<string, Chat[]>()
  const unsorted: Chat[] = []
  for (const c of all) {
    const direct = c.mentions > 0 || org.priority[c.id] === 'high' || ((c.kind === 'user' || c.kind === 'bot') && !c.muted)
    if (direct) first.push(c)
    else if (c.muted) muted.push(c)
    else {
      const p = placementOf(c, org)
      if (p) byWs.set(p.ws, [...(byWs.get(p.ws) ?? []), c])
      else unsorted.push(c)
    }
  }
  const out: InboxSection[] = []
  if (first.length) out.push({ key: 'first', title: 'inbox.first', chats: first.sort(sort), translate: true })
  for (const w of org.workspaces) {
    const list = byWs.get(w.id)
    if (list?.length) out.push({ key: `ws:${w.id}`, title: w.name, color: w.color, chats: list.sort(sort), translate: false })
  }
  if (unsorted.length) out.push({ key: 'unsorted', title: 'inbox.unsorted', chats: unsorted.sort(sort), translate: true })
  if (muted.length) out.push({ key: 'muted', title: 'inbox.muted', chats: muted.sort(sort), collapsed: true, translate: true })
  return out
}

export const snoozedChats = (chats: Record<string, Chat>, org: Org, now = Date.now()) =>
  Object.values(chats)
    .filter((c) => isSnoozed(c, org, now))
    .sort((a, b) => (org.snooze[a.id] ?? 0) - (org.snooze[b.id] ?? 0))

/** Rail badges count chats waiting, not messages: 3 chats with 400 messages is still 3 things to look at. */
export function waitingCount(chats: Chat[], org: Org, now = Date.now()) {
  return chats.filter((c) => needsAttention(c, org, now) && (!c.muted || c.mentions > 0)).length
}
