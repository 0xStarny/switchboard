import { create } from 'zustand'
import type { Chat, ChatKind } from '../tg/types'

// Everything here lives only in this browser. Telegram never sees workspaces, tags,
// notes or snoozes, which is why none of it is limited by Premium.

export interface Folder {
  id: string
  name: string
}
export interface Workspace {
  id: string
  name: string
  color: string
  folders: Folder[]
}
export interface Tag {
  id: string
  name: string
  color: string
}
export type Priority = 'high' | 'normal' | 'low'
export interface Rule {
  id: string
  workspaceId: string
  folderId?: string
  titleIncludes?: string
  kinds?: ChatKind[]
}
export interface Placement {
  ws: string
  folder?: string
}

export interface OrgData {
  workspaces: Workspace[]
  tags: Tag[]
  rules: Rule[]
  placement: Record<string, Placement>
  chatTags: Record<string, string[]>
  notes: Record<string, string>
  snooze: Record<string, number>
  priority: Record<string, Priority>
}

export const SWATCHES = ['#3d6fb6', '#2f8a6c', '#b4572e', '#8a5bb5', '#b38a1d', '#c2416b', '#3f8f9e', '#6b7686']

const empty = (): OrgData => ({ workspaces: [], tags: [], rules: [], placement: {}, chatTags: {}, notes: {}, snooze: {}, priority: {} })

const uid = () => Math.random().toString(36).slice(2, 9)

interface OrgStore extends OrgData {
  accountKey?: string
  load(accountId: string): void
  importData(d: Partial<OrgData>): void
  exportData(): OrgData

  addWorkspace(name: string, color?: string): string
  updateWorkspace(id: string, patch: Partial<Omit<Workspace, 'id'>>): void
  removeWorkspace(id: string): void
  moveWorkspace(id: string, dir: -1 | 1): void
  addFolder(wsId: string, name: string): string
  renameFolder(wsId: string, folderId: string, name: string): void
  removeFolder(wsId: string, folderId: string): void

  place(chatIds: string[], ws: string | null, folder?: string): void
  addTag(name: string): string
  removeTag(id: string): void
  toggleTag(chatIds: string[], tagId: string, on: boolean): void
  setNote(chatId: string, text: string): void
  setSnooze(chatIds: string[], until: number | null): void
  setPriority(chatIds: string[], p: Priority): void
  addRule(r: Omit<Rule, 'id'>): void
  removeRule(id: string): void
}

const DATA_KEYS: (keyof OrgData)[] = ['workspaces', 'tags', 'rules', 'placement', 'chatTags', 'notes', 'snooze', 'priority']

export const useOrg = create<OrgStore>((set, get) => ({
  ...empty(),

  load(accountId) {
    const key = `sb.org.${accountId}`
    let data = empty()
    try {
      data = { ...data, ...JSON.parse(localStorage.getItem(key) || '{}') }
    } catch {
      /* corrupted: start fresh */
    }
    set({ ...data, accountKey: key })
  },
  importData(d) {
    set({ ...empty(), ...d })
  },
  exportData() {
    const s = get()
    return Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as unknown as OrgData
  },

  addWorkspace(name, color) {
    const id = uid()
    const ws = get().workspaces
    set({ workspaces: [...ws, { id, name, color: color ?? SWATCHES[ws.length % SWATCHES.length], folders: [] }] })
    return id
  },
  updateWorkspace(id, patch) {
    set({ workspaces: get().workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w)) })
  },
  removeWorkspace(id) {
    const placement = Object.fromEntries(Object.entries(get().placement).filter(([, p]) => p.ws !== id))
    set({
      workspaces: get().workspaces.filter((w) => w.id !== id),
      rules: get().rules.filter((r) => r.workspaceId !== id),
      placement,
    })
  },
  moveWorkspace(id, dir) {
    const list = [...get().workspaces]
    const i = list.findIndex((w) => w.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    set({ workspaces: list })
  },
  addFolder(wsId, name) {
    const id = uid()
    set({ workspaces: get().workspaces.map((w) => (w.id === wsId ? { ...w, folders: [...w.folders, { id, name }] } : w)) })
    return id
  },
  renameFolder(wsId, folderId, name) {
    set({
      workspaces: get().workspaces.map((w) =>
        w.id === wsId ? { ...w, folders: w.folders.map((f) => (f.id === folderId ? { ...f, name } : f)) } : w,
      ),
    })
  },
  removeFolder(wsId, folderId) {
    const placement = { ...get().placement }
    for (const [cid, p] of Object.entries(placement)) if (p.ws === wsId && p.folder === folderId) placement[cid] = { ws: wsId }
    set({
      workspaces: get().workspaces.map((w) => (w.id === wsId ? { ...w, folders: w.folders.filter((f) => f.id !== folderId) } : w)),
      placement,
    })
  },

  place(chatIds, ws, folder) {
    const placement = { ...get().placement }
    for (const id of chatIds) {
      if (ws) placement[id] = folder ? { ws, folder } : { ws }
      else delete placement[id]
    }
    set({ placement })
  },
  addTag(name) {
    const id = uid()
    const tags = get().tags
    set({ tags: [...tags, { id, name, color: SWATCHES[(tags.length + 3) % SWATCHES.length] }] })
    return id
  },
  removeTag(id) {
    const chatTags = Object.fromEntries(Object.entries(get().chatTags).map(([c, ts]) => [c, ts.filter((t) => t !== id)]))
    set({ tags: get().tags.filter((t) => t.id !== id), chatTags })
  },
  toggleTag(chatIds, tagId, on) {
    const chatTags = { ...get().chatTags }
    for (const id of chatIds) {
      const cur = new Set(chatTags[id] ?? [])
      if (on) cur.add(tagId)
      else cur.delete(tagId)
      chatTags[id] = [...cur]
    }
    set({ chatTags })
  },
  setNote(chatId, text) {
    const notes = { ...get().notes }
    if (text.trim()) notes[chatId] = text
    else delete notes[chatId]
    set({ notes })
  },
  setSnooze(chatIds, until) {
    const snooze = { ...get().snooze }
    for (const id of chatIds) {
      if (until) snooze[id] = until
      else delete snooze[id]
    }
    set({ snooze })
  },
  setPriority(chatIds, p) {
    const priority = { ...get().priority }
    for (const id of chatIds) {
      if (p === 'normal') delete priority[id]
      else priority[id] = p
    }
    set({ priority })
  },
  addRule(r) {
    set({ rules: [...get().rules, { ...r, id: uid() }] })
  },
  removeRule(id) {
    set({ rules: get().rules.filter((r) => r.id !== id) })
  },
}))

// Persist on every change, per Telegram account.
useOrg.subscribe((s) => {
  if (!s.accountKey) return
  try {
    localStorage.setItem(s.accountKey, JSON.stringify(s.exportData()))
  } catch {
    /* storage full or blocked */
  }
})

/** Manual placement wins; otherwise the first matching rule decides. */
export function placementOf(chat: Chat, org: Pick<OrgData, 'placement' | 'rules' | 'workspaces'>): Placement | null {
  const manual = org.placement[chat.id]
  if (manual && org.workspaces.some((w) => w.id === manual.ws)) return manual
  const title = chat.title.toLowerCase()
  for (const r of org.rules) {
    if (r.kinds?.length && !r.kinds.includes(chat.kind)) continue
    if (r.titleIncludes && !title.includes(r.titleIncludes.toLowerCase())) continue
    if (!r.kinds?.length && !r.titleIncludes) continue
    return r.folderId ? { ws: r.workspaceId, folder: r.folderId } : { ws: r.workspaceId }
  }
  return null
}

const STOP = new Set(
  'the and for with team group chat official community channel news les des pour avec groupe officiel general dao labs capital partners support'.split(' '),
)

/** Words shared by several chat titles make good workspace candidates ("Halden" in 4 chats). */
export function suggestWorkspaces(chats: Chat[], existing: Workspace[]): { word: string; count: number }[] {
  const have = new Set(existing.map((w) => w.name.toLowerCase()))
  const counts = new Map<string, { word: string; ids: Set<string> }>()
  for (const c of chats) {
    if (c.kind === 'user' || c.kind === 'bot') continue
    for (const raw of c.title.split(/[^\p{L}\p{N}]+/u)) {
      if (raw.length < 4) continue
      const k = raw.toLowerCase()
      if (STOP.has(k) || have.has(k)) continue
      const entry = counts.get(k) ?? { word: raw, ids: new Set() }
      entry.ids.add(c.id)
      counts.set(k, entry)
    }
  }
  return [...counts.values()]
    .filter((e) => e.ids.size >= 2)
    .sort((a, b) => b.ids.size - a.ids.size)
    .slice(0, 6)
    .map((e) => ({ word: e.word, count: e.ids.size }))
}
