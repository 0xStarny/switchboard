import { create } from 'zustand'
import type { Chat, Me, Message, Provider, ScheduledMessage, Topic, Update } from '../tg/types'
import { useOrg } from './org'
import { onIncoming, reconcileFollowups } from './followups'

export type View = { kind: 'inbox' } | { kind: 'all' } | { kind: 'ws'; id: string; folder?: string } | { kind: 'unsorted' }
export type ListFilter = 'all' | 'unread' | 'groups' | 'channels' | 'dms' | 'muted' | 'archived'

interface Toast {
  id: number
  text: string
  tone?: 'error'
}

interface AppStore {
  provider?: Provider
  me?: Me
  ready: boolean
  loadError?: string
  chats: Record<string, Chat>
  messages: Record<string, Message[]>
  topics: Record<string, Topic[]>
  hasMore: Record<string, boolean>
  scheduled: Record<string, ScheduledMessage[]>

  view: View
  filter: ListFilter
  tagFilter?: string
  query: string
  openChatId?: string
  /** The chat opened from the inbox keeps its place there until you move on, even once read. */
  held?: { id: string; unread: number; mentions: number }
  topicId?: number
  selection: string[]
  detailsOpen: boolean
  paletteOpen: boolean
  settingsOpen: boolean
  toasts: Toast[]

  start(p: Provider): Promise<void>
  reloadDialogs(): Promise<void>
  stop(): Promise<void>
  setView(v: View): void
  setFilter(f: ListFilter): void
  setTagFilter(t?: string): void
  setQuery(q: string): void
  openChat(id?: string): void
  setTopic(id?: number): void
  loadOlder(chatId: string): Promise<void>
  send(text: string, replyTo?: number): Promise<void>
  loadScheduled(chatId: string): Promise<void>
  /** Schedule on Telegram; with cancelOnReply it becomes a follow-up Switchboard withdraws if they answer. */
  scheduleMessage(text: string, at: number, opts?: { replyTo?: number; cancelOnReply?: boolean }): Promise<void>
  cancelScheduled(chatId: string, ids: number[]): Promise<void>
  sendScheduledNow(chatId: string, ids: number[]): Promise<void>
  markRead(ids: string[]): Promise<void>
  setMuted(ids: string[], muted: boolean): Promise<void>
  setArchived(ids: string[], archived: boolean): Promise<void>
  select(id: string, mode: 'toggle' | 'only' | 'range', order?: string[]): void
  clearSelection(): void
  toggleDetails(open?: boolean): void
  togglePalette(open?: boolean): void
  toggleSettings(open?: boolean): void
  toast(text: string, tone?: 'error'): void
}

let unsubscribe: (() => void) | undefined
let reloadTimer: number | undefined
let toastSeq = 0

function applyUpdate(u: Update) {
  const s = useApp.getState()
  if (u.type === 'dialogsChanged') {
    window.clearTimeout(reloadTimer)
    reloadTimer = window.setTimeout(() => useApp.getState().reloadDialogs(), 800)
    return
  }
  if (u.type === 'read') {
    const c = s.chats[u.chatId]
    if (!c) return
    useApp.setState({ chats: { ...s.chats, [u.chatId]: { ...c, unread: u.unread, readMaxId: u.maxId, mentions: u.unread ? c.mentions : 0 } } })
    return
  }
  if (u.type === 'scheduledChanged') {
    s.loadScheduled(u.chatId).catch(() => undefined)
    return
  }
  const m = u.message
  const c = s.chats[m.chatId]
  if (!c) return
  const list = s.messages[m.chatId]
  const isOpen = s.openChatId === m.chatId && document.visibilityState === 'visible'
  const nextChat: Chat = {
    ...c,
    last: { id: m.id, text: m.text, date: m.date, out: m.out, senderName: m.senderName, mediaKind: m.media?.kind, serviceKey: m.service?.key },
    unread: m.out || isOpen ? c.unread : c.unread + 1,
  }
  const patch: Partial<AppStore> = { chats: { ...s.chats, [m.chatId]: nextChat } }
  if (list && !list.some((x) => x.id === m.id)) patch.messages = { ...s.messages, [m.chatId]: [...list, m] }
  useApp.setState(patch)
  if (isOpen && !m.out) s.provider?.markRead(m.chatId, m.id).catch(() => undefined)
  if (!m.out) onIncoming(m)
}

export const useApp = create<AppStore>((set, get) => ({
  ready: false,
  chats: {},
  messages: {},
  topics: {},
  hasMore: {},
  scheduled: {},
  view: { kind: 'inbox' },
  filter: 'all',
  query: '',
  selection: [],
  detailsOpen: false,
  paletteOpen: false,
  settingsOpen: false,
  toasts: [],

  async start(p) {
    set({ provider: p, ready: false, loadError: undefined })
    try {
      const me = await p.me()
      useOrg.getState().load(p.demo ? 'demo' : me.id)
      set({ me })
      await get().reloadDialogs()
      unsubscribe?.()
      unsubscribe = p.onUpdate(applyUpdate)
      set({ ready: true })
      reconcileFollowups().catch(() => undefined)
    } catch (err) {
      set({ loadError: String((err as Error).message ?? err) })
      throw err
    }
  },
  async reloadDialogs() {
    const p = get().provider
    if (!p) return
    const list = await p.dialogs()
    set({ chats: Object.fromEntries(list.map((c) => [c.id, c])) })
  },
  async stop() {
    unsubscribe?.()
    unsubscribe = undefined
    await get().provider?.logout()
    set({ provider: undefined, me: undefined, ready: false, chats: {}, messages: {}, topics: {}, openChatId: undefined, selection: [] })
  },

  setView(view) {
    set({ view, selection: [], held: undefined })
  },
  setFilter(filter) {
    set({ filter })
  },
  setTagFilter(tagFilter) {
    set({ tagFilter })
  },
  setQuery(query) {
    set({ query })
  },
  openChat(id) {
    const { provider, messages, chats } = get()
    const chat = id ? chats[id] : undefined
    set({
      openChatId: id,
      topicId: undefined,
      held: chat && (chat.unread || chat.mentions) ? { id: chat.id, unread: chat.unread, mentions: chat.mentions } : get().held?.id === id ? get().held : undefined,
    })
    if (!id) return
    if (!provider || !chat) return
    if (!messages[id]) {
      provider
        .history(id, { limit: 50 })
        .then((list) => set({ messages: { ...get().messages, [id]: list }, hasMore: { ...get().hasMore, [id]: list.length >= 50 } }))
        .catch((e) => get().toast(String(e.message ?? e), 'error'))
    }
    if (chat.forum && !get().topics[id]) {
      provider
        .topics(id)
        .then((t) => set({ topics: { ...get().topics, [id]: t } }))
        .catch(() => undefined)
    }
    if (chat.unread > 0 || chat.mentions > 0) get().markRead([id])
    get().loadScheduled(id).catch(() => undefined)
  },
  setTopic(topicId) {
    set({ topicId })
  },
  async loadOlder(chatId) {
    const { provider, messages, hasMore } = get()
    const list = messages[chatId]
    if (!provider || !list?.length || hasMore[chatId] === false) return
    const older = await provider.history(chatId, { offsetId: list[0].id, limit: 50 })
    const cur = get().messages[chatId] ?? []
    const seen = new Set(cur.map((m) => m.id))
    set({
      messages: { ...get().messages, [chatId]: [...older.filter((m) => !seen.has(m.id)), ...cur] },
      hasMore: { ...get().hasMore, [chatId]: older.length >= 50 },
    })
  },
  async send(text, replyTo) {
    const { provider, openChatId, topicId } = get()
    if (!provider || !openChatId || !text.trim()) return
    const msg = await provider.send(openChatId, text, { replyTo, topicId })
    const s = get()
    const list = s.messages[openChatId] ?? []
    const c = s.chats[openChatId]
    set({
      messages: { ...s.messages, [openChatId]: list.some((m) => m.id === msg.id) ? list : [...list, msg] },
      chats: c ? { ...s.chats, [openChatId]: { ...c, last: { id: msg.id, text: msg.text, date: msg.date, out: true } } } : s.chats,
    })
  },
  async loadScheduled(chatId) {
    const p = get().provider
    if (!p) return
    const list = await p.scheduled(chatId)
    set({ scheduled: { ...get().scheduled, [chatId]: list } })
    // A follow-up whose message left the queue was either sent or deleted elsewhere: stop tracking it.
    const org = useOrg.getState()
    for (const f of org.followups) if (f.chatId === chatId && !list.some((m) => m.id === f.scheduledId)) org.removeFollowup(f.id)
  },
  async scheduleMessage(text, at, opts) {
    const { provider, openChatId, topicId } = get()
    if (!provider || !openChatId || !text.trim()) return
    const m = await provider.schedule(openChatId, text.trim(), at, { replyTo: opts?.replyTo, topicId })
    set({ scheduled: { ...get().scheduled, [openChatId]: [...(get().scheduled[openChatId] ?? []).filter((x) => x.id !== m.id), m].sort((a, b) => a.date - b.date) } })
    if (opts?.cancelOnReply) useOrg.getState().addFollowup({ chatId: openChatId, scheduledId: m.id, at, text: m.text })
  },
  async cancelScheduled(chatId, ids) {
    await get().provider?.cancelScheduled(chatId, ids)
    set({ scheduled: { ...get().scheduled, [chatId]: (get().scheduled[chatId] ?? []).filter((m) => !ids.includes(m.id)) } })
    const org = useOrg.getState()
    for (const f of org.followups) if (f.chatId === chatId && ids.includes(f.scheduledId)) org.removeFollowup(f.id)
  },
  async sendScheduledNow(chatId, ids) {
    await get().provider?.sendScheduledNow(chatId, ids)
    await get().loadScheduled(chatId)
  },
  async markRead(ids) {
    const { provider } = get()
    if (!provider) return
    const chats = { ...get().chats }
    for (const id of ids) if (chats[id]) chats[id] = { ...chats[id], unread: 0, mentions: 0 }
    set({ chats })
    for (const id of ids) await provider.markRead(id, get().chats[id]?.last?.id).catch(() => undefined)
  },
  async setMuted(ids, muted) {
    const { provider } = get()
    if (!provider) return
    for (const id of ids) {
      await provider.setMuted(id, muted)
      const c = get().chats[id]
      if (c) set({ chats: { ...get().chats, [id]: { ...c, muted } } })
    }
  },
  async setArchived(ids, archived) {
    const { provider } = get()
    if (!provider) return
    for (const id of ids) {
      await provider.setArchived(id, archived)
      const c = get().chats[id]
      if (c) set({ chats: { ...get().chats, [id]: { ...c, archived } } })
    }
  },
  select(id, mode, order) {
    const cur = get().selection
    if (mode === 'only') return set({ selection: [id] })
    if (mode === 'toggle') return set({ selection: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
    const anchor = cur[cur.length - 1]
    if (!order || !anchor) return set({ selection: [id] })
    const a = order.indexOf(anchor)
    const b = order.indexOf(id)
    const range = order.slice(Math.min(a, b), Math.max(a, b) + 1)
    set({ selection: [...new Set([...cur, ...range])] })
  },
  clearSelection() {
    set({ selection: [] })
  },
  toggleDetails(open) {
    set({ detailsOpen: open ?? !get().detailsOpen })
  },
  togglePalette(open) {
    set({ paletteOpen: open ?? !get().paletteOpen })
  },
  toggleSettings(open) {
    set({ settingsOpen: open ?? !get().settingsOpen })
  },
  toast(text, tone) {
    const id = ++toastSeq
    set({ toasts: [...get().toasts, { id, text, tone }] })
    window.setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 4200)
  },
}))
