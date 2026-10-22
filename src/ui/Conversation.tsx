import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store/app'
import { bytes, clock, dayLabel } from '../lib/format'
import { explainError, useLang, useT, type Key } from '../lib/i18n'
import type { Chat, Message } from '../tg/types'
import { Avatar, kindIcon } from './bits'
import { Icon } from './Icon'

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <a key={i} href={p} target="_blank" rel="noreferrer noopener">
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}

export function tgLink(chat: Chat) {
  return chat.username ? `https://t.me/${chat.username}` : null
}

export function Conversation() {
  const t = useT()
  const chatId = useApp((s) => s.openChatId)
  const chat = useApp((s) => (s.openChatId ? s.chats[s.openChatId] : undefined))
  const messages = useApp((s) => (s.openChatId ? s.messages[s.openChatId] : undefined))
  const topics = useApp((s) => (s.openChatId ? s.topics[s.openChatId] : undefined))
  const topicId = useApp((s) => s.topicId)
  const setTopic = useApp((s) => s.setTopic)
  const openChat = useApp((s) => s.openChat)
  const toggleDetails = useApp((s) => s.toggleDetails)
  const detailsOpen = useApp((s) => s.detailsOpen)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    setReplyTo(null)
    setSearching(false)
  }, [chatId])

  if (!chat || !chatId) {
    return (
      <section className="convo empty-convo">
        <div className="empty-board" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <h2>{t('chat.pick')}</h2>
        <p className="muted">{t('chat.pickHint')}</p>
      </section>
    )
  }

  const subtitle = [t(`kind.${chat.kind}` as Key), chat.username ? `@${chat.username}` : ''].filter(Boolean).join(', ')
  const shown = topicId && messages ? messages.filter((m) => (m.topicId ?? 1) === topicId) : messages

  return (
    <section className="convo">
      <header className="convo-head">
        <button className="icon-btn back" onClick={() => openChat(undefined)} aria-label={t('chat.back')}>
          <Icon name="back" />
        </button>
        <Avatar chat={chat} size={36} />
        <div className="convo-title">
          <h2 className="ellipsis">
            {chat.kind !== 'user' && <Icon name={kindIcon(chat.kind)} size={15} className="row-kind" />}
            {chat.title}
          </h2>
          <p className="muted ellipsis">{subtitle}</p>
        </div>
        {chat.forum && topics && (
          <select className="topic-select" value={topicId ?? ''} onChange={(e) => setTopic(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">{t('chat.allTopics')}</option>
            {topics.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {tp.title}
                {tp.unread ? ` (${tp.unread})` : ''}
              </option>
            ))}
          </select>
        )}
        <button className={`icon-btn ${searching ? 'on' : ''}`} onClick={() => setSearching(!searching)} aria-label={t('chat.searchIn')} title={t('chat.searchIn')}>
          <Icon name="search" />
        </button>
        <button className={`icon-btn ${detailsOpen ? 'on' : ''}`} onClick={() => toggleDetails()} aria-label={t('chat.details')} title={t('chat.details')}>
          <Icon name="info" />
        </button>
      </header>
      {searching && <ChatSearch chatId={chatId} onClose={() => setSearching(false)} />}
      <MessageList chat={chat} messages={shown} topics={!topicId ? topics : undefined} onReply={chat.canPost ? setReplyTo : undefined} />
      {chat.canPost ? (
        <Composer key={chatId} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
      ) : (
        <p className="readonly muted">{t('chat.readonly')}</p>
      )}
    </section>
  )
}

function MessageList({
  chat,
  messages,
  topics,
  onReply,
}: {
  chat: Chat
  messages?: Message[]
  topics?: { id: number; title: string }[]
  onReply?: (m: Message) => void
}) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const loadOlder = useApp((s) => s.loadOlder)
  const hasMore = useApp((s) => s.hasMore[chat.id] !== false)
  const ref = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const prevHeight = useRef(0)
  const loading = useRef(false)
  const firstId = messages?.[0]?.id

  const byId = useMemo(() => new Map((messages ?? []).map((m) => [m.id, m])), [messages])
  const topicName = useMemo(() => new Map((topics ?? []).map((tp) => [tp.id, tp.title])), [topics])

  // Keep the view pinned to the bottom for new messages, and steady when older ones load above.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (prevHeight.current && loading.current) {
      el.scrollTop += el.scrollHeight - prevHeight.current
      loading.current = false
    } else if (stick.current) el.scrollTop = el.scrollHeight
    prevHeight.current = el.scrollHeight
  }, [messages])

  useEffect(() => {
    stick.current = true
    prevHeight.current = 0
  }, [chat.id])

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (el.scrollTop < 300 && hasMore && !loading.current && firstId) {
      loading.current = true
      prevHeight.current = el.scrollHeight
      loadOlder(chat.id).catch(() => (loading.current = false))
    }
  }

  if (!messages) return <div className="messages loading" aria-busy="true" />

  let lastDay = ''
  return (
    <div className="messages" ref={ref} onScroll={onScroll} role="log" aria-live="polite">
      {hasMore && messages.length >= 50 && (
        <button className="link-btn older" onClick={() => ((loading.current = true), (prevHeight.current = ref.current?.scrollHeight ?? 0), loadOlder(chat.id))}>
          {t('chat.loadOlder')}
        </button>
      )}
      {messages.map((m, i) => {
        const day = new Date(m.date * 1000).toDateString()
        const showDay = day !== lastDay
        lastDay = day
        const prev = messages[i - 1]
        const grouped = !showDay && prev && !prev.service && !m.service && prev.senderId === m.senderId && prev.out === m.out && m.date - prev.date < 300
        return (
          <Fragment key={m.id}>
            {showDay && (
              <div className="day">
                <span>{dayLabel(m.date, lang)}</span>
              </div>
            )}
            {m.service ? (
              <p className="service">
                {m.senderName && <b>{m.senderName} </b>}
                {t(m.service.key as Key, { arg: m.service.arg ?? '' })}
              </p>
            ) : (
              <Bubble
                m={m}
                chat={chat}
                grouped={!!grouped}
                reply={m.replyToId ? byId.get(m.replyToId) : undefined}
                topic={m.topicId && topics ? topicName.get(m.topicId) : undefined}
                onReply={onReply}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function Bubble({
  m,
  chat,
  grouped,
  reply,
  topic,
  onReply,
}: {
  m: Message
  chat: Chat
  grouped: boolean
  reply?: Message
  topic?: string
  onReply?: (m: Message) => void
}) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const showName = !m.out && !grouped && chat.kind === 'group'
  return (
    <div className={`msg ${m.out ? 'out' : 'in'} ${grouped ? 'grouped' : ''}`}>
      <div className="bubble">
        {showName && <p className="msg-name" style={{ '--h': hueFromName(m.senderName ?? '') } as React.CSSProperties}>{m.senderName}</p>}
        {topic && <p className="msg-topic"># {topic}</p>}
        {m.forwardedFrom && (
          <p className="msg-fwd">{m.forwardedFrom === 'fwd' ? t('chat.forwardedAnon') : t('chat.forwarded', { name: m.forwardedFrom })}</p>
        )}
        {m.replyToId && (
          <blockquote className="msg-reply">
            <b>{reply ? (reply.out ? t('chat.you') : reply.senderName) : '…'}</b>
            <span className="ellipsis">{reply ? reply.text || (reply.media ? t(`media.${reply.media.kind}` as Key) : '') : ''}</span>
          </blockquote>
        )}
        {m.media && <MediaBlock m={m} />}
        {m.text && (
          <p className="msg-text">
            <Linkified text={m.text} />
          </p>
        )}
        <span className="msg-time">
          {m.edited && <em>{t('chat.edited')} </em>}
          {clock(m.date, lang)}
        </span>
      </div>
      {onReply && (
        <button className="icon-btn sm msg-action" onClick={() => onReply(m)} aria-label={t('chat.reply')} title={t('chat.reply')}>
          <Icon name="reply" size={15} />
        </button>
      )}
    </div>
  )
}

function hueFromName(n: string) {
  let h = 0
  for (const c of n) h = (h * 17 + c.charCodeAt(0)) % 360
  return h
}

const thumbCache = new Map<string, Promise<string | null>>()

function MediaBlock({ m }: { m: Message }) {
  const t = useT()
  const provider = useApp((s) => s.provider)
  const toast = useApp((s) => s.toast)
  const [thumb, setThumb] = useState<string | null>(null)
  const media = m.media!

  useEffect(() => {
    if (!provider || !media.hasThumb) return
    let alive = true
    const key = `${m.chatId}:${m.id}`
    if (!thumbCache.has(key)) thumbCache.set(key, provider.thumb(m.chatId, m.id).catch(() => null))
    thumbCache.get(key)!.then((u) => alive && setThumb(u))
    return () => {
      alive = false
    }
  }, [provider, m.chatId, m.id, media.hasThumb])

  const download = async () => {
    try {
      const blob = await provider?.download(m.chatId, m.id)
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = media.name || `${media.kind}-${m.id}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } catch (e) {
      toast(explainError(e), 'error')
    }
  }

  if (media.kind === 'link') {
    if (!media.title) return null
    return (
      <a className="link-card" href={media.url} target="_blank" rel="noreferrer noopener">
        <b>{media.title}</b>
        <span className="ellipsis">{media.url}</span>
      </a>
    )
  }
  if ((media.kind === 'photo' || media.kind === 'video' || media.kind === 'gif') && thumb) {
    return (
      <button className="media-thumb" onClick={download} title={t('chat.download')}>
        <img src={thumb} alt={t(`media.${media.kind}` as Key)} />
        {media.kind !== 'photo' && <span className="media-badge">{t(`media.${media.kind}` as Key)}</span>}
      </button>
    )
  }
  return (
    <div className="media-card">
      <Icon name={media.kind === 'file' || media.kind === 'audio' || media.kind === 'voice' ? 'download' : 'note'} size={18} />
      <div className="media-info">
        <b className="ellipsis">{media.name || media.title || t(`media.${media.kind}` as Key)}</b>
        <span className="muted">{[t(`media.${media.kind}` as Key), bytes(media.size)].filter(Boolean).join(', ')}</span>
      </div>
      {['file', 'audio', 'voice', 'video', 'photo', 'gif'].includes(media.kind) && (
        <button className="icon-btn sm" onClick={download} aria-label={t('chat.download')} title={t('chat.download')}>
          <Icon name="download" size={16} />
        </button>
      )}
    </div>
  )
}

function Composer({ replyTo, onCancelReply }: { replyTo: Message | null; onCancelReply: () => void }) {
  const t = useT()
  const send = useApp((s) => s.send)
  const toast = useApp((s) => s.toast)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
    el.style.overflowY = el.scrollHeight > 180 ? 'auto' : 'hidden'
  }, [text])

  useEffect(() => {
    if (replyTo) ref.current?.focus()
  }, [replyTo])

  const submit = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      await send(body, replyTo?.id)
      setText('')
      onCancelReply()
    } catch (e) {
      toast(explainError(e), 'error')
    } finally {
      setBusy(false)
      ref.current?.focus()
    }
  }

  return (
    <div className="composer">
      {replyTo && (
        <div className="composer-reply">
          <Icon name="reply" size={15} />
          <span className="ellipsis">
            <b>{t('chat.replyTo', { name: replyTo.out ? t('chat.you') : replyTo.senderName ?? '' })}</b> {replyTo.text}
          </span>
          <button className="icon-btn sm" onClick={onCancelReply} aria-label={t('chat.cancel')}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      <div className="composer-row">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={t('chat.write')}
          aria-label={t('chat.write')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
            if (e.key === 'Escape' && replyTo) onCancelReply()
          }}
        />
        <button className="btn primary send" onClick={submit} disabled={!text.trim() || busy} aria-label={t('chat.send')}>
          <Icon name="send" size={18} />
        </button>
      </div>
    </div>
  )
}

function ChatSearch({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const provider = useApp((s) => s.provider)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Message[] | null>(null)

  useEffect(() => {
    if (!q.trim() || !provider) return setResults(null)
    const id = setTimeout(() => {
      provider.search(chatId, q.trim()).then(setResults).catch(() => setResults([]))
    }, 350)
    return () => clearTimeout(id)
  }, [q, chatId, provider])

  return (
    <div className="chat-search">
      <label className="search">
        <Icon name="search" size={16} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('chat.searchIn')} onKeyDown={(e) => e.key === 'Escape' && onClose()} />
      </label>
      {results && (
        <ul className="search-results">
          {results.length === 0 && <li className="muted">{t('chat.noResults')}</li>}
          {results.map((m) => (
            <li key={m.id}>
              <span className="muted">
                {dayLabel(m.date, lang)}, {clock(m.date, lang)}
                {m.senderName ? `, ${m.out ? t('chat.you') : m.senderName}` : ''}
              </span>
              <p>{m.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
