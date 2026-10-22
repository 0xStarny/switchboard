import { translate, type Lang } from './i18n'
import type { LastMessage } from '../tg/types'

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

/** Chat list timestamps: time today, weekday this week, short date beyond. */
export function shortTime(unix: number, lang: Lang) {
  const d = new Date(unix * 1000)
  const now = new Date()
  if (sameDay(d, now)) return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
  const days = (now.getTime() - d.getTime()) / 86400000
  if (days < 6) return d.toLocaleDateString(lang, { weekday: 'short' })
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: '2-digit' } : {}) })
}

export const clock = (unix: number, lang: Lang) => new Date(unix * 1000).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })

export function dayLabel(unix: number, lang: Lang) {
  const d = new Date(unix * 1000)
  const now = new Date()
  if (sameDay(d, now)) return translate(lang, 'chat.today')
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (sameDay(d, y)) return translate(lang, 'chat.yesterday')
  return d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
}

export function whenLabel(ms: number, lang: Lang) {
  const d = new Date(ms)
  return d.toLocaleString(lang, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

export function bytes(n?: number) {
  if (!n) return ''
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}`
}

export function preview(last: LastMessage | undefined, lang: Lang) {
  if (!last) return ''
  if (last.serviceKey) return translate(lang, last.serviceKey as never, { arg: '' }).replace(/[«“]\s*[»”]/, '').trim()
  const media = last.mediaKind && last.mediaKind !== 'link' ? translate(lang, `media.${last.mediaKind}` as never) : ''
  const text = last.text.replace(/\s+/g, ' ').trim()
  return [media, text].filter(Boolean).join(' · ')
}

export function initials(title: string) {
  const parts = title.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Stable hue per chat so the same group always gets the same avatar colour. */
export function hueOf(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 360
}

export function snoozeTargets(): { key: 'snooze.1h' | 'snooze.tonight' | 'snooze.tomorrow' | 'snooze.week'; at: number }[] {
  const now = new Date()
  const tonight = new Date(now)
  tonight.setHours(19, 0, 0, 0)
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  const monday = new Date(now)
  monday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7))
  monday.setHours(9, 0, 0, 0)
  const out: { key: 'snooze.1h' | 'snooze.tonight' | 'snooze.tomorrow' | 'snooze.week'; at: number }[] = [
    { key: 'snooze.1h', at: now.getTime() + 3600000 },
  ]
  if (tonight.getTime() > now.getTime() + 1800000) out.push({ key: 'snooze.tonight', at: tonight.getTime() })
  out.push({ key: 'snooze.tomorrow', at: tomorrow.getTime() }, { key: 'snooze.week', at: monday.getTime() })
  return out
}

export type WhenKey = 'when.tomorrow' | 'when.3d' | 'when.1w' | 'when.2w'

/** Follow-up horizons: days ahead at 9:00, the moment people usually act on reminders. */
export function laterTargets(): { key: WhenKey; at: number }[] {
  const at = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(9, 0, 0, 0)
    return d.getTime()
  }
  return [
    { key: 'when.tomorrow', at: at(1) },
    { key: 'when.3d', at: at(3) },
    { key: 'when.1w', at: at(7) },
    { key: 'when.2w', at: at(14) },
  ]
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(ms: number) {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

export function dateLabel(ms: number, lang: Lang) {
  return new Date(ms).toLocaleString(lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
