import type { Message } from '../tg/types'
import { tNow } from '../lib/i18n'
import { useApp } from './app'
import { useOrg } from './org'

// Follow-ups ("send this in 3 days unless they answer") and "only if no reply" reminders.
// Telegram holds the scheduled message; Switchboard withdraws it when it sees a reply.
// That check runs on every incoming message while the app is open, and once at startup
// for anything that happened while it was closed.

// Telegram dates are whole seconds; allow for that rounding so a reply in the same second counts.
const after = (unixSec: number, createdAt: number) => unixSec * 1000 >= createdAt - 1000

const replied = (createdAt: number, msgs: { out: boolean; date: number; service?: unknown }[]) =>
  msgs.some((m) => !m.out && !m.service && after(m.date, createdAt))

async function withdraw(chatId: string, reason: 'followup' | 'reminder') {
  const app = useApp.getState()
  const org = useOrg.getState()
  const title = app.chats[chatId]?.title ?? ''
  if (reason === 'followup') {
    const ids = org.followups.filter((f) => f.chatId === chatId).map((f) => f.scheduledId)
    if (!ids.length) return
    try {
      await app.cancelScheduled(chatId, ids)
      app.toast(tNow('fu.cancelled', { name: title }))
    } catch (e) {
      app.toast(String((e as Error).message ?? e), 'error')
    }
  } else {
    const rs = org.reminders.filter((r) => r.chatId === chatId && r.ifNoReply)
    if (!rs.length) return
    rs.forEach((r) => org.removeReminder(r.id))
    app.toast(tNow('rem.replied', { name: title }))
  }
}

export function onIncoming(m: Message) {
  if (m.service) return
  const org = useOrg.getState()
  if (org.followups.some((f) => f.chatId === m.chatId && after(m.date, f.createdAt))) withdraw(m.chatId, 'followup')
  if (org.reminders.some((r) => r.chatId === m.chatId && r.ifNoReply && after(m.date, r.createdAt))) withdraw(m.chatId, 'reminder')
}

export async function reconcileFollowups() {
  const app = useApp.getState()
  const org = useOrg.getState()
  const p = app.provider
  if (!p) return
  const chatIds = new Set([...org.followups.map((f) => f.chatId), ...org.reminders.filter((r) => r.ifNoReply).map((r) => r.chatId)])
  for (const chatId of chatIds) {
    if (!app.chats[chatId]) continue
    try {
      if (org.followups.some((f) => f.chatId === chatId)) await app.loadScheduled(chatId)
      const recent = await p.history(chatId, { limit: 30 })
      const o = useOrg.getState()
      const fu = o.followups.filter((f) => f.chatId === chatId)
      if (fu.length && replied(Math.min(...fu.map((f) => f.createdAt)), recent)) await withdraw(chatId, 'followup')
      const rs = o.reminders.filter((r) => r.chatId === chatId && r.ifNoReply)
      if (rs.length && replied(Math.min(...rs.map((r) => r.createdAt)), recent)) await withdraw(chatId, 'reminder')
    } catch {
      /* chat gone or offline: try again next time */
    }
  }
}
