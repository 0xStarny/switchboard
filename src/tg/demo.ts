import type { Chat, ChatKind, Me, Message, Provider, ScheduledMessage, Topic, Update } from './types'

// A believable account for someone who lives in Telegram for work: partner
// groups, communities, news channels, a few DMs. All names are invented.

const now = () => Math.floor(Date.now() / 1000)

interface Seed {
  title: string
  kind: ChatKind
  unread?: number
  mentions?: number
  muted?: boolean
  archived?: boolean
  pinned?: boolean
  forum?: boolean
  username?: string
  lines: [string, string][] // [sender, text]
}

const S: Seed[] = [
  { title: 'Nadia Okafor', kind: 'user', unread: 2, pinned: true, lines: [['Nadia', 'Did you see the term sheet I sent?'], ['Nadia', 'Need your comments before Thursday 3pm if possible']] },
  { title: 'Halden x Northwind', kind: 'group', unread: 14, mentions: 1, pinned: true, lines: [['Tom', 'Integration is live on testnet'], ['Priya', 'Docs updated, link in pinned'], ['Tom', '@you can you confirm the launch date for the co-marketing post?']] },
  { title: 'Lumen Labs core', kind: 'group', unread: 6, forum: true, lines: [['Marc', 'Pushed the new pricing page'], ['Ines', 'QA pass done, two small issues'], ['Marc', 'Fixed, redeploying']] },
  { title: 'Kestrel Capital', kind: 'user', unread: 1, lines: [['Ravi', 'Happy to jump on a call next week. Tuesday works?']] },
  { title: 'Brightwater partners', kind: 'group', unread: 37, lines: [['Alex', 'Weekly numbers are in the sheet'], ['Sam', 'TVL up 12% week on week'], ['Alex', 'Next sync moved to Friday']] },
  { title: 'Atlas Research', kind: 'channel', unread: 9, muted: true, lines: [['Atlas', 'Weekly report: stablecoin flows and where the yield went']] },
  { title: 'Founders Circle', kind: 'group', unread: 128, muted: true, lines: [['Leo', 'Anyone going to the Singapore side event?'], ['Mia', 'Yes, landing Monday'], ['Leo', 'Let us do dinner']] },
  { title: 'Orbit DAO governance', kind: 'group', unread: 54, muted: true, lines: [['Bot', 'Proposal #41 is now open for voting'], ['Kai', 'Voted for, rationale in forum']] },
  { title: 'Julien Mercier', kind: 'user', lines: [['me', 'Sent you the deck'], ['Julien', 'Thanks, reading tonight']] },
  { title: 'Saved Messages', kind: 'user', pinned: true, lines: [['me', 'Ideas: monthly recap thread, partner spotlight']] },
  { title: 'Northwind marketing', kind: 'group', unread: 3, lines: [['Elena', 'Draft thread for the launch in the doc'], ['Elena', 'Feedback by EOD please']] },
  { title: 'Delta Exchange listings', kind: 'group', unread: 0, lines: [['Omar', 'Listing confirmed for the 14th']] },
  { title: 'DeFi Daily', kind: 'channel', unread: 23, muted: true, lines: [['DeFi Daily', 'Morning brief: rates, unlocks and the week ahead']] },
  { title: 'Chain Alerts', kind: 'bot', unread: 5, lines: [['Chain Alerts', 'Large transfer detected: 2.4M USDC to a new wallet']] },
  { title: 'Sofia Lindqvist', kind: 'user', unread: 0, lines: [['Sofia', 'Perfect, see you there']] },
  { title: 'Lumen x Halden audit', kind: 'group', unread: 2, mentions: 1, lines: [['Auditor', 'Two medium findings, report attached'], ['Auditor', '@you please assign someone to review']] },
  { title: 'Riverbank OTC', kind: 'group', unread: 0, lines: [['Desk', 'Quote expired, ping for a refresh']] },
  { title: 'Polar Ventures', kind: 'user', unread: 1, lines: [['Hana', 'Can we get a data room link?']] },
  { title: 'Crypto Jobs Board', kind: 'channel', unread: 61, muted: true, archived: true, lines: [['Jobs', 'New: Head of BD, remote']] },
  { title: 'Old hackathon team', kind: 'group', unread: 0, muted: true, archived: true, lines: [['Ben', 'gg everyone']] },
  { title: 'Validator ops', kind: 'group', unread: 4, lines: [['Ops', 'Node 3 back in sync'], ['Ops', 'Upgrade window tonight 22:00 UTC']] },
  { title: 'Event planning: Lisbon', kind: 'group', unread: 11, lines: [['Clara', 'Venue shortlist in the doc'], ['Clara', 'Vote by Wednesday']] },
  { title: 'Market makers', kind: 'group', unread: 7, muted: true, lines: [['MM', 'Spreads tightened after the update']] },
  { title: 'Design reviews', kind: 'group', unread: 0, lines: [['Ines', 'New logo options uploaded']] },
  { title: 'Ambassadors', kind: 'group', unread: 212, muted: true, lines: [['Mod', 'Reminder: no shilling in this group']] },
  { title: 'Legal: Halden', kind: 'group', unread: 1, lines: [['Counsel', 'Updated terms attached, redline on page 4']] },
  { title: 'Grants committee', kind: 'group', unread: 0, lines: [['Rae', 'Round 3 applications close Friday']] },
  { title: 'Wallet support', kind: 'bot', unread: 0, lines: [['Support', 'Ticket #8812 resolved']] },
  { title: 'Ethan Cole', kind: 'user', unread: 0, lines: [['Ethan', 'Sounds good']] },
  { title: 'L2 builders', kind: 'group', unread: 89, muted: true, lines: [['Dev', 'New SDK release is out']] },
]

const TOPICS: Topic[] = [
  { id: 1, title: 'General', unread: 2 },
  { id: 101, title: 'Product', unread: 3 },
  { id: 102, title: 'Design', unread: 1 },
  { id: 103, title: 'Releases', unread: 0 },
]

const chatId = (i: number, kind: ChatKind) => (kind === 'user' || kind === 'bot' ? String(9100 + i) : String(-1009100 - i))

export class DemoProvider implements Provider {
  readonly demo = true
  private chats: Chat[]
  private messages = new Map<string, Message[]>()
  private listeners = new Set<(u: Update) => void>()
  private timer?: number
  private queue = new Map<string, ScheduledMessage[]>()
  private seq = 50000

  constructor() {
    const t = now()
    this.chats = S.map((s, i) => {
      const id = chatId(i, s.kind)
      const msgs = this.buildHistory(id, s, t - i * 1700)
      this.messages.set(id, msgs)
      const last = msgs[msgs.length - 1]
      return {
        id,
        kind: s.kind,
        title: s.title,
        username: s.username,
        forum: !!s.forum,
        canPost: s.kind !== 'channel',
        unread: s.unread ?? 0,
        mentions: s.mentions ?? 0,
        muted: !!s.muted,
        archived: !!s.archived,
        pinned: !!s.pinned,
        readMaxId: last.id - (s.unread ?? 0),
        last: { id: last.id, text: last.text, date: last.date, out: last.out, senderName: last.senderName },
      }
    })
    this.timer = window.setInterval(() => this.tick(), 22000)
  }

  private buildHistory(id: string, s: Seed, end: number): Message[] {
    const filler = [
      ['Alex', 'Morning all'],
      ['me', 'Thanks, on it'],
      ['Sam', 'Agenda for the call is in the doc'],
      ['me', 'Can we push to 4pm?'],
      ['Alex', 'Works for me'],
      ['Sam', 'Shared the recording'],
    ]
    const lines = [...filler, ...s.lines]
    return lines.map(([who, text], k) => {
      const out = who === 'me'
      return {
        id: 1000 + k,
        chatId: id,
        date: end - (lines.length - k) * 600,
        text,
        out,
        senderName: out ? 'You' : s.kind === 'user' ? s.title : who,
        topicId: s.forum ? TOPICS[k % TOPICS.length].id : undefined,
      }
    })
  }

  private emit(u: Update) {
    this.listeners.forEach((l) => l(u))
  }

  private tick() {
    const candidates = this.chats.filter((c) => !c.archived && c.kind !== 'channel')
    const c = candidates[Math.floor(Math.random() * candidates.length)]
    const list = this.messages.get(c.id)!
    const samples = ['Quick update: shipped', 'Any news on this?', 'Sharing the latest numbers', 'Can someone review?', 'Call in 10']
    const msg: Message = {
      id: list[list.length - 1].id + 1,
      chatId: c.id,
      date: now(),
      text: samples[Math.floor(Math.random() * samples.length)],
      out: false,
      senderName: c.kind === 'user' ? c.title : 'Alex',
    }
    list.push(msg)
    this.emit({ type: 'message', message: msg })
  }

  async me(): Promise<Me> {
    return { id: '1', name: 'Demo account', username: 'demo' }
  }
  async dialogs() {
    return this.chats.map((c) => ({ ...c }))
  }
  async history(chatId: string, opts: { offsetId?: number; limit?: number; topicId?: number }) {
    let list = this.messages.get(chatId) ?? []
    if (opts.topicId) list = list.filter((m) => (m.topicId ?? 1) === opts.topicId)
    if (opts.offsetId) return []
    return list.slice(-(opts.limit ?? 50))
  }
  async topics() {
    return TOPICS.map((t) => ({ ...t }))
  }
  async send(chatId: string, text: string, opts?: { replyTo?: number; topicId?: number }) {
    const list = this.messages.get(chatId)!
    const msg: Message = {
      id: list[list.length - 1].id + 1,
      chatId,
      date: now(),
      text,
      out: true,
      senderName: 'You',
      replyToId: opts?.replyTo,
      topicId: opts?.topicId,
    }
    list.push(msg)
    return msg
  }
  async markRead(chatId: string) {
    const c = this.chats.find((x) => x.id === chatId)
    if (c) {
      c.unread = 0
      c.mentions = 0
    }
  }
  async setMuted(chatId: string, muted: boolean) {
    const c = this.chats.find((x) => x.id === chatId)
    if (c) c.muted = muted
  }
  async setArchived(chatId: string, archived: boolean) {
    const c = this.chats.find((x) => x.id === chatId)
    if (c) c.archived = archived
  }
  async avatar() {
    return null
  }
  async thumb() {
    return null
  }
  async download() {
    return null
  }
  async search(chatId: string, query: string) {
    const q = query.toLowerCase()
    return (this.messages.get(chatId) ?? []).filter((m) => m.text.toLowerCase().includes(q))
  }
  async scheduled(chatId: string) {
    return [...(this.queue.get(chatId) ?? [])]
  }
  async schedule(chatId: string, text: string, at: number) {
    const m: ScheduledMessage = { id: ++this.seq, chatId, date: Math.floor(at / 1000), text }
    this.queue.set(chatId, [...(this.queue.get(chatId) ?? []), m].sort((a, b) => a.date - b.date))
    // Like Telegram, deliver it on time (only while the demo tab is open).
    const delay = at - Date.now()
    if (delay < 2 ** 31 - 1) window.setTimeout(() => this.deliver(chatId, m.id), Math.max(0, delay))
    return m
  }
  private async deliver(chatId: string, id: number) {
    const m = (this.queue.get(chatId) ?? []).find((x) => x.id === id)
    if (!m) return
    await this.cancelScheduled(chatId, [id])
    const msg = await this.send(chatId, m.text)
    this.emit({ type: 'message', message: msg })
  }
  async cancelScheduled(chatId: string, ids: number[]) {
    this.queue.set(chatId, (this.queue.get(chatId) ?? []).filter((m) => !ids.includes(m.id)))
    this.emit({ type: 'scheduledChanged', chatId })
  }
  async sendScheduledNow(chatId: string, ids: number[]) {
    for (const id of ids) await this.deliver(chatId, id)
  }
  onUpdate(cb: (u: Update) => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  async logout() {
    window.clearInterval(this.timer)
  }
}
