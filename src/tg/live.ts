import { TelegramClient, Api, utils } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { NewMessage, type NewMessageEvent } from 'telegram/events'
import { Raw } from 'telegram/events'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import { enqueue, limiter } from '../lib/queue'
import type { Chat, ChatKind, Me, Media, Message, Provider, Topic, Update } from './types'

const SESSION_KEY = 'sb.session'
const CREDS_KEY = 'sb.apiCreds'

export interface ApiCreds {
  apiId: number
  apiHash: string
}

/** Build-time credentials win; self-hosters without them can paste their own in the UI. */
export function getCreds(): ApiCreds | null {
  const id = Number(import.meta.env.VITE_TG_API_ID)
  const hash = import.meta.env.VITE_TG_API_HASH as string | undefined
  if (id && hash) return { apiId: id, apiHash: hash }
  try {
    const saved = JSON.parse(localStorage.getItem(CREDS_KEY) || 'null')
    if (saved?.apiId && saved?.apiHash) return { apiId: Number(saved.apiId), apiHash: String(saved.apiHash) }
  } catch {
    /* ignore */
  }
  return null
}

export const credsFromBuild = () => !!(Number(import.meta.env.VITE_TG_API_ID) && import.meta.env.VITE_TG_API_HASH)

export function forgetCreds() {
  localStorage.removeItem(CREDS_KEY)
}

export function saveCreds(c: ApiCreds) {
  localStorage.setItem(CREDS_KEY, JSON.stringify(c))
}

export const hasSession = () => !!localStorage.getItem(SESSION_KEY)

export function makeClient(creds: ApiCreds): TelegramClient {
  const client = new TelegramClient(new StringSession(localStorage.getItem(SESSION_KEY) || ''), creds.apiId, creds.apiHash, {
    connectionRetries: 5,
    useWSS: true,
    deviceModel: 'Switchboard Web',
    systemVersion: navigator.platform || 'Web',
    appVersion: '0.1.0',
    langCode: navigator.language.slice(0, 2) || 'en',
  })
  client.setLogLevel('error' as never)
  return client
}

export function persistSession(client: TelegramClient) {
  localStorage.setItem(SESSION_KEY, (client.session as StringSession).save())
}

export const clearSession = () => localStorage.removeItem(SESSION_KEY)

const b64url = (buf: Uint8Array) =>
  btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export interface LoginHandlers {
  onQr?: (url: string) => void
  ask: (step: 'code' | 'password', hint?: string) => Promise<string>
  onError: (err: Error) => void
}

export async function loginWithQr(client: TelegramClient, creds: ApiCreds, h: LoginHandlers) {
  await client.signInUserWithQrCode(creds, {
    qrCode: async ({ token }) => h.onQr?.(`tg://login?token=${b64url(token)}`),
    password: (hint) => h.ask('password', hint),
    onError: async (err) => {
      h.onError(err)
      return false
    },
  })
  persistSession(client)
}

export async function loginWithPhone(client: TelegramClient, creds: ApiCreds, phone: string, h: LoginHandlers) {
  await client.signInUser(creds, {
    phoneNumber: phone,
    phoneCode: () => h.ask('code'),
    password: (hint) => h.ask('password', hint),
    onError: async (err) => {
      h.onError(err)
      // Wrong code or password: ask again. Anything else (bad number, flood) stops the flow.
      return !/(PHONE_CODE_INVALID|PASSWORD_HASH_INVALID|PHONE_CODE_EMPTY)/.test(String((err as { errorMessage?: string }).errorMessage ?? err.message))
    },
  })
  persistSession(client)
}

// ---------------------------------------------------------------------------

type Entity = Api.User | Api.Chat | Api.Channel | Api.ChatForbidden | Api.ChannelForbidden

const nameOf = (e: unknown): string => {
  if (e instanceof Api.User) {
    if (e.deleted) return 'Deleted account'
    return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.username || String(e.id)
  }
  if (e && typeof e === 'object' && 'title' in e) return String((e as { title: string }).title)
  return ''
}

function kindOf(e: Entity | undefined): ChatKind {
  if (e instanceof Api.User) return e.bot ? 'bot' : 'user'
  if (e instanceof Api.Channel) return e.broadcast ? 'channel' : 'group'
  return 'group'
}

function mediaOf(m: Api.Message): Media | undefined {
  const md = m.media
  if (!md) return undefined
  if (md instanceof Api.MessageMediaPhoto) return { kind: 'photo', hasThumb: true }
  if (md instanceof Api.MessageMediaDocument && md.document instanceof Api.Document) {
    const doc = md.document
    let kind: Media['kind'] = 'file'
    let name: string | undefined
    for (const a of doc.attributes) {
      if (a instanceof Api.DocumentAttributeSticker) kind = 'sticker'
      else if (a instanceof Api.DocumentAttributeAnimated) kind = 'gif'
      else if (a instanceof Api.DocumentAttributeVideo && kind === 'file') kind = 'video'
      else if (a instanceof Api.DocumentAttributeAudio) kind = a.voice ? 'voice' : 'audio'
      else if (a instanceof Api.DocumentAttributeFilename) name = a.fileName
    }
    return { kind, name, size: Number(doc.size), hasThumb: !!doc.thumbs?.length && kind !== 'sticker' }
  }
  if (md instanceof Api.MessageMediaWebPage) {
    const wp = md.webpage
    if (wp instanceof Api.WebPage) return { kind: 'link', url: wp.url, title: wp.title || wp.siteName }
    return undefined
  }
  if (md instanceof Api.MessageMediaPoll) return { kind: 'poll', title: md.poll.question.text }
  if (md instanceof Api.MessageMediaGeo || md instanceof Api.MessageMediaGeoLive || md instanceof Api.MessageMediaVenue)
    return { kind: 'geo' }
  if (md instanceof Api.MessageMediaContact) return { kind: 'contact', title: [md.firstName, md.lastName].join(' ') }
  return { kind: 'other' }
}

function serviceOf(a: Api.TypeMessageAction): { key: string; arg?: string } {
  if (a instanceof Api.MessageActionChatAddUser || a instanceof Api.MessageActionChatJoinedByLink || a instanceof Api.MessageActionChatJoinedByRequest)
    return { key: 'svc.joined' }
  if (a instanceof Api.MessageActionChatDeleteUser) return { key: 'svc.left' }
  if (a instanceof Api.MessageActionChatEditTitle) return { key: 'svc.title', arg: a.title }
  if (a instanceof Api.MessageActionPinMessage) return { key: 'svc.pinned' }
  if (a instanceof Api.MessageActionChatEditPhoto) return { key: 'svc.photo' }
  if (a instanceof Api.MessageActionChatCreate || a instanceof Api.MessageActionChannelCreate) return { key: 'svc.created' }
  if (a instanceof Api.MessageActionTopicCreate) return { key: 'svc.topic', arg: a.title }
  if (a instanceof Api.MessageActionPhoneCall) return { key: 'svc.call' }
  return { key: 'svc.other' }
}

function convert(m: Api.TypeMessage, chatId: string): Message | null {
  if (m instanceof Api.MessageEmpty) return null
  const sender = (m as unknown as { sender?: unknown }).sender
  const base = {
    id: m.id,
    chatId,
    date: m.date,
    out: !!m.out,
    senderId: m.fromId ? utils.getPeerId(m.fromId) : undefined,
    senderName: sender ? nameOf(sender) : undefined,
  }
  let topicId: number | undefined
  let replyToId: number | undefined
  const rt = m.replyTo
  if (rt instanceof Api.MessageReplyHeader) {
    if (rt.forumTopic) {
      topicId = rt.replyToTopId ?? rt.replyToMsgId
      if (rt.replyToTopId) replyToId = rt.replyToMsgId
    } else replyToId = rt.replyToMsgId
  }
  if (m instanceof Api.MessageService) return { ...base, text: '', topicId, service: serviceOf(m.action) }
  return {
    ...base,
    text: m.message || '',
    topicId,
    replyToId,
    edited: !!m.editDate && !m.editHide,
    forwardedFrom: m.fwdFrom ? m.fwdFrom.fromName || 'fwd' : undefined,
    media: mediaOf(m),
  }
}

const SELF_TITLE = 'Saved Messages'

export class LiveProvider implements Provider {
  readonly demo = false
  private entities = new Map<string, Entity>()
  private msgCache = new Map<string, Api.Message>()
  private listeners = new Set<(u: Update) => void>()
  private readLimit = limiter(3)
  private meId = ''

  constructor(private client: TelegramClient) {
    client.addEventHandler((ev: NewMessageEvent) => this.onNewMessage(ev), new NewMessage({}))
    client.addEventHandler((u: Api.TypeUpdate) => this.onRaw(u), new Raw({}))
  }

  private emit(u: Update) {
    this.listeners.forEach((l) => l(u))
  }

  private async onNewMessage(ev: NewMessageEvent) {
    const m = ev.message
    const chatId = m.chatId?.toString()
    if (!chatId) return
    try {
      await m.getSender()
    } catch {
      /* sender stays unknown */
    }
    this.msgCache.set(`${chatId}:${m.id}`, m)
    const msg = convert(m, chatId)
    if (!msg) return
    if (!this.entities.has(chatId)) {
      this.emit({ type: 'dialogsChanged' })
      return
    }
    this.emit({ type: 'message', message: msg })
  }

  private onRaw(u: Api.TypeUpdate) {
    if (u instanceof Api.UpdateReadHistoryInbox) {
      this.emit({ type: 'read', chatId: utils.getPeerId(u.peer), maxId: u.maxId, unread: u.stillUnreadCount })
    } else if (u instanceof Api.UpdateReadChannelInbox) {
      const chatId = utils.getPeerId(new Api.PeerChannel({ channelId: u.channelId }))
      this.emit({ type: 'read', chatId, maxId: u.maxId, unread: u.stillUnreadCount })
    } else if (u instanceof Api.UpdateFolderPeers || u instanceof Api.UpdateNotifySettings || u instanceof Api.UpdatePinnedDialogs) {
      this.emit({ type: 'dialogsChanged' })
    }
  }

  private async entity(chatId: string): Promise<Entity> {
    const known = this.entities.get(chatId)
    if (known) return known
    const e = (await this.client.getEntity(chatId)) as Entity
    this.entities.set(chatId, e)
    return e
  }

  async me(): Promise<Me> {
    const u = (await this.client.getMe()) as Api.User
    this.meId = u.id.toString()
    return { id: this.meId, name: nameOf(u), username: u.username }
  }

  async dialogs(): Promise<Chat[]> {
    const out: Chat[] = []
    const now = Date.now() / 1000
    for await (const d of this.client.iterDialogs({})) {
      const e = d.entity as Entity | undefined
      if (!e || !d.id) continue
      const id = d.id.toString()
      this.entities.set(id, e)
      const isSelf = e instanceof Api.User && e.self
      const ns = d.dialog.notifySettings
      const photo = (e as { photo?: { photoId?: { toString(): string } } }).photo
      if (d.message) this.msgCache.set(`${id}:${d.message.id}`, d.message)
      const last = d.message ? convert(d.message, id) : null
      out.push({
        id,
        kind: kindOf(e),
        title: isSelf ? SELF_TITLE : d.title || d.name || nameOf(e),
        username: (e as { username?: string }).username,
        forum: e instanceof Api.Channel && !!e.forum,
        canPost: !(e instanceof Api.Channel && e.broadcast && !e.creator && !e.adminRights?.postMessages),
        unread: d.unreadCount,
        mentions: d.unreadMentionsCount,
        muted: (ns?.muteUntil ?? 0) > now,
        archived: d.archived,
        pinned: d.pinned,
        readMaxId: d.dialog.readInboxMaxId,
        photoId: photo?.photoId?.toString(),
        last: last
          ? {
              id: last.id,
              text: last.text,
              mediaKind: last.media?.kind,
              serviceKey: last.service?.key,
              date: last.date,
              out: last.out,
              senderName: last.senderName,
            }
          : undefined,
      })
    }
    return out
  }

  async history(chatId: string, opts: { offsetId?: number; limit?: number; topicId?: number }): Promise<Message[]> {
    const e = await this.entity(chatId)
    const list = await this.client.getMessages(e, {
      limit: opts.limit ?? 50,
      offsetId: opts.offsetId ?? 0,
      ...(opts.topicId && opts.topicId !== 1 ? { replyTo: opts.topicId } : {}),
    })
    const out: Message[] = []
    for (const m of list) {
      this.msgCache.set(`${chatId}:${m.id}`, m)
      const c = convert(m, chatId)
      if (c) out.push(c)
    }
    return out.reverse()
  }

  async topics(chatId: string): Promise<Topic[]> {
    const e = await this.entity(chatId)
    const res = await this.client.invoke(
      new Api.channels.GetForumTopics({ channel: e as Api.Channel, offsetDate: 0, offsetId: 0, offsetTopic: 0, limit: 100 }),
    )
    return res.topics
      .filter((t): t is Api.ForumTopic => t instanceof Api.ForumTopic)
      .map((t) => ({ id: t.id, title: t.title, unread: t.unreadCount, iconColor: t.iconColor }))
  }

  async send(chatId: string, text: string, opts?: { replyTo?: number; topicId?: number }): Promise<Message> {
    const e = await this.entity(chatId)
    const replyTo = opts?.replyTo ?? (opts?.topicId && opts.topicId !== 1 ? opts.topicId : undefined)
    const m = await this.client.sendMessage(e, { message: text, replyTo })
    this.msgCache.set(`${chatId}:${m.id}`, m)
    return convert(m, chatId)!
  }

  async markRead(chatId: string, maxId?: number) {
    const e = await this.entity(chatId)
    await enqueue(() => this.client.markAsRead(e, maxId, { clearMentions: true }))
  }

  async setMuted(chatId: string, muted: boolean) {
    const peer = await this.client.getInputEntity(await this.entity(chatId))
    await enqueue(() =>
      this.client.invoke(
        new Api.account.UpdateNotifySettings({
          peer: new Api.InputNotifyPeer({ peer }),
          settings: new Api.InputPeerNotifySettings({ muteUntil: muted ? 2147483647 : 0 }),
        }),
      ),
    )
  }

  async setArchived(chatId: string, archived: boolean) {
    const peer = await this.client.getInputEntity(await this.entity(chatId))
    await enqueue(() =>
      this.client.invoke(new Api.folders.EditPeerFolders({ folderPeers: [new Api.InputFolderPeer({ peer, folderId: archived ? 1 : 0 })] })),
    )
  }

  async avatar(chat: Chat): Promise<string | null> {
    if (!chat.photoId) return null
    const key = `av:${chat.id}:${chat.photoId}`
    let bytes = (await idbGet(key).catch(() => undefined)) as Uint8Array | undefined
    if (!bytes) {
      const e = await this.entity(chat.id)
      const buf = await this.readLimit(() => this.client.downloadProfilePhoto(e, { isBig: false }))
      if (!buf || typeof buf === 'string' || !buf.length) return null
      bytes = new Uint8Array(buf)
      idbSet(key, bytes).catch(() => undefined)
    }
    return URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }))
  }

  private async rawMessage(chatId: string, id: number): Promise<Api.Message | undefined> {
    const k = `${chatId}:${id}`
    if (this.msgCache.has(k)) return this.msgCache.get(k)
    const [m] = await this.client.getMessages(await this.entity(chatId), { ids: id })
    if (m) this.msgCache.set(k, m)
    return m
  }

  async thumb(chatId: string, messageId: number): Promise<string | null> {
    const key = `th:${chatId}:${messageId}`
    let bytes = (await idbGet(key).catch(() => undefined)) as Uint8Array | undefined
    if (!bytes) {
      const m = await this.rawMessage(chatId, messageId)
      if (!m?.media) return null
      // Photos: largest "m"-ish size is index 1; documents only have small thumbs (index 0).
      const thumb = m.media instanceof Api.MessageMediaPhoto ? 1 : 0
      const buf = await this.readLimit(() => this.client.downloadMedia(m, { thumb }))
      if (!buf || typeof buf === 'string' || !buf.length) return null
      bytes = new Uint8Array(buf)
      idbSet(key, bytes).catch(() => undefined)
    }
    return URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }))
  }

  async download(chatId: string, messageId: number): Promise<Blob | null> {
    const m = await this.rawMessage(chatId, messageId)
    if (!m?.media) return null
    const buf = await this.client.downloadMedia(m, {})
    if (!buf || typeof buf === 'string') return null
    return new Blob([new Uint8Array(buf) as BlobPart])
  }

  async search(chatId: string, query: string): Promise<Message[]> {
    const e = await this.entity(chatId)
    const list = await this.client.getMessages(e, { search: query, limit: 50 })
    return list.map((m) => convert(m, chatId)).filter((m): m is Message => !!m)
  }

  onUpdate(cb: (u: Update) => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  async logout() {
    try {
      await this.client.invoke(new Api.auth.LogOut())
    } catch {
      /* already gone */
    }
    clearSession()
    await this.client.disconnect()
  }
}
