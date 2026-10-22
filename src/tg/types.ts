export type ChatKind = 'user' | 'bot' | 'group' | 'channel'

export interface LastMessage {
  id: number
  text: string
  date: number // unix seconds
  out: boolean
  senderName?: string
  mediaKind?: MediaKind
  serviceKey?: string
}

export interface Chat {
  id: string
  kind: ChatKind
  title: string
  username?: string
  forum: boolean
  /** False for broadcast channels where you are not an admin. */
  canPost: boolean
  unread: number
  mentions: number
  muted: boolean
  archived: boolean
  pinned: boolean
  last?: LastMessage
  readMaxId?: number
  photoId?: string
}

export type MediaKind = 'photo' | 'video' | 'voice' | 'audio' | 'file' | 'sticker' | 'gif' | 'link' | 'poll' | 'geo' | 'contact' | 'other'

export interface Media {
  kind: MediaKind
  name?: string
  size?: number
  url?: string // link previews
  title?: string
  hasThumb?: boolean
}

export interface Message {
  id: number
  chatId: string
  date: number
  text: string
  out: boolean
  senderId?: string
  senderName?: string
  replyToId?: number
  topicId?: number
  forwardedFrom?: string
  media?: Media
  /** Service events (joins, pins, title changes) carry an i18n key instead of text. */
  service?: { key: string; arg?: string }
  edited?: boolean
}

export interface Topic {
  id: number
  title: string
  unread: number
  iconColor?: number
}

export interface Me {
  id: string
  name: string
  username?: string
}

export type Update =
  | { type: 'message'; message: Message; chatTitle?: string }
  | { type: 'read'; chatId: string; maxId: number; unread: number }
  | { type: 'dialogsChanged' }

/** Everything the UI needs from Telegram. Implemented by the live client and the demo. */
export interface Provider {
  readonly demo: boolean
  me(): Promise<Me>
  dialogs(): Promise<Chat[]>
  history(chatId: string, opts: { offsetId?: number; limit?: number; topicId?: number }): Promise<Message[]>
  topics(chatId: string): Promise<Topic[]>
  send(chatId: string, text: string, opts?: { replyTo?: number; topicId?: number }): Promise<Message>
  markRead(chatId: string, maxId?: number): Promise<void>
  setMuted(chatId: string, muted: boolean): Promise<void>
  setArchived(chatId: string, archived: boolean): Promise<void>
  avatar(chat: Chat): Promise<string | null>
  thumb(chatId: string, messageId: number): Promise<string | null>
  download(chatId: string, messageId: number): Promise<Blob | null>
  search(chatId: string, query: string): Promise<Message[]>
  onUpdate(cb: (u: Update) => void): () => void
  logout(): Promise<void>
}
