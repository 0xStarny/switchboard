import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../store/app'
import type { Chat } from '../tg/types'
import { hueOf, initials } from '../lib/format'
import { Icon } from './Icon'

const avatarCache = new Map<string, Promise<string | null>>()

export function Avatar({ chat, size = 40 }: { chat: Chat; size?: number }) {
  const provider = useApp((s) => s.provider)
  const [url, setUrl] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!provider || !chat.photoId || !ref.current) return
    let alive = true
    const key = `${chat.id}:${chat.photoId}`
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      if (!avatarCache.has(key)) avatarCache.set(key, provider.avatar(chat).catch(() => null))
      avatarCache.get(key)!.then((u) => alive && setUrl(u))
    })
    io.observe(ref.current)
    return () => {
      alive = false
      io.disconnect()
    }
  }, [provider, chat.id, chat.photoId])

  const hue = hueOf(chat.id)
  return (
    <div
      ref={ref}
      className={`avatar avatar-${chat.kind}`}
      style={{ width: size, height: size, ['--h' as string]: hue, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {url ? <img src={url} alt="" /> : <span>{initials(chat.title)}</span>}
    </div>
  )
}

export const kindIcon = (k: Chat['kind']) => ({ user: 'user', bot: 'bot', group: 'group', channel: 'channel' })[k]

/** The unread "lamp": lit amber when something waits for you, unlit when the chat is muted. */
export function Lamp({ chat }: { chat: Chat }) {
  if (!chat.unread && !chat.mentions) return null
  const lit = !chat.muted || chat.mentions > 0
  return (
    <span className={`lamp ${lit ? 'lit' : ''}`} aria-label={`${chat.unread} unread`}>
      {chat.mentions > 0 && <Icon name="at" size={12} />}
      {chat.unread > 999 ? '999+' : chat.unread || ''}
    </span>
  )
}

/** Small anchored menu. Closes on outside click or Escape. */
export function Popover({
  anchor,
  onClose,
  children,
  align = 'start',
}: {
  anchor: HTMLElement | null
  onClose: () => void
  children: ReactNode
  align?: 'start' | 'end'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 })

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return
    const r = anchor.getBoundingClientRect()
    const m = ref.current.getBoundingClientRect()
    let top = r.bottom + 6
    if (top + m.height > window.innerHeight - 8) top = Math.max(8, r.top - m.height - 6)
    let left = align === 'end' ? r.right - m.width : r.left
    left = Math.min(Math.max(8, left), window.innerWidth - m.width - 8)
    setPos({ top, left })
  }, [anchor, align])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchor, onClose])

  return (
    <div ref={ref} className="popover" style={{ top: pos.top, left: pos.left }} role="menu">
      {children}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone ?? ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
