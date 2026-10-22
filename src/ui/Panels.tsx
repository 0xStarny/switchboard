import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store/app'
import { SWATCHES, suggestWorkspaces, useOrg } from '../store/org'
import { useLang, useT, type Key } from '../lib/i18n'
import { useTheme, type Theme } from '../lib/theme'
import type { ChatKind } from '../tg/types'
import { Avatar, Lamp, Modal } from './bits'
import { Icon } from './Icon'

// ---------------------------------------------------------------- workspace editor

export function WorkspaceEditor({ id, onClose }: { id: string | 'new'; onClose: () => void }) {
  const t = useT()
  const org = useOrg()
  const chats = useApp((s) => s.chats)
  const setView = useApp((s) => s.setView)
  const ws = id === 'new' ? undefined : org.workspaces.find((w) => w.id === id)
  const [name, setName] = useState(ws?.name ?? '')
  const [color, setColor] = useState(ws?.color ?? SWATCHES[org.workspaces.length % SWATCHES.length])
  const [folder, setFolder] = useState('')
  const [ruleText, setRuleText] = useState('')
  const [ruleKind, setRuleKind] = useState<ChatKind | ''>('')
  const suggestions = useMemo(() => (id === 'new' ? suggestWorkspaces(Object.values(chats), org.workspaces) : []), [id, chats, org.workspaces])
  const rules = org.rules.filter((r) => r.workspaceId === id)

  const create = (n = name, ruleWord?: string) => {
    if (!n.trim()) return
    const newId = org.addWorkspace(n.trim(), color)
    if (ruleWord) useOrg.getState().addRule({ workspaceId: newId, titleIncludes: ruleWord })
    setView({ kind: 'ws', id: newId })
    onClose()
  }

  if (id === 'new') {
    return (
      <Modal title={t('nav.newWorkspace')} onClose={onClose}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <label className="field">
            <span className="field-label">{t('ws.name')}</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Halden, Clients, Perso…" />
          </label>
          <Swatches value={color} onChange={setColor} />
          <button className="btn primary" disabled={!name.trim()}>
            {t('ws.create')}
          </button>
        </form>
        {suggestions.length > 0 && (
          <div className="suggest">
            <p className="field-label">{t('ws.suggest')}</p>
            <div className="chips">
              {suggestions.map((s) => (
                <button key={s.word} className="chip" onClick={() => create(s.word, s.word)}>
                  {s.word} <span className="muted">{t('ws.suggestCount', { n: s.count })}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    )
  }

  if (!ws) return null
  const idx = org.workspaces.indexOf(ws)

  return (
    <Modal title={t('ws.edit')} onClose={onClose} wide>
      <div className="stack">
        <label className="field">
          <span className="field-label">{t('ws.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && org.updateWorkspace(ws.id, { name: name.trim() })} />
        </label>
        <Swatches
          value={ws.color}
          onChange={(c) => {
            setColor(c)
            org.updateWorkspace(ws.id, { color: c })
          }}
        />
        <div className="row-btns">
          <button className="btn sm" disabled={idx === 0} onClick={() => org.moveWorkspace(ws.id, -1)}>
            <Icon name="arrowUp" size={16} /> {t('ws.up')}
          </button>
          <button className="btn sm" disabled={idx === org.workspaces.length - 1} onClick={() => org.moveWorkspace(ws.id, 1)}>
            <Icon name="arrowDown" size={16} /> {t('ws.down')}
          </button>
        </div>

        <section>
          <h3 className="field-label">{t('ws.folders')}</h3>
          <ul className="edit-list">
            {ws.folders.map((f) => (
              <li key={f.id}>
                <Icon name="folder" size={16} />
                <input defaultValue={f.name} onBlur={(e) => e.target.value.trim() && org.renameFolder(ws.id, f.id, e.target.value.trim())} />
                <button className="icon-btn sm" onClick={() => org.removeFolder(ws.id, f.id)} aria-label={t('ws.delete')}>
                  <Icon name="trash" size={15} />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!folder.trim()) return
              org.addFolder(ws.id, folder.trim())
              setFolder('')
            }}
          >
            <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder={t('ws.folderName')} />
            <button className="btn sm" disabled={!folder.trim()}>
              <Icon name="plus" size={16} /> {t('ws.addFolder')}
            </button>
          </form>
        </section>

        <section>
          <h3 className="field-label">{t('ws.rules')}</h3>
          <p className="muted small">{t('ws.rulesHelp')}</p>
          <ul className="edit-list">
            {rules.map((r) => (
              <li key={r.id}>
                <Icon name="rule" size={16} />
                <span>
                  {r.titleIncludes && (
                    <>
                      {t('ws.ruleTitle')} <b>« {r.titleIncludes} »</b>
                    </>
                  )}
                  {r.titleIncludes && r.kinds?.length ? ', ' : ''}
                  {r.kinds?.map((k) => t(`kind.${k}` as Key)).join(', ')}
                </span>
                <button className="icon-btn sm" onClick={() => org.removeRule(r.id)} aria-label={t('ws.delete')}>
                  <Icon name="trash" size={15} />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!ruleText.trim() && !ruleKind) return
              org.addRule({ workspaceId: ws.id, titleIncludes: ruleText.trim() || undefined, kinds: ruleKind ? [ruleKind] : undefined })
              setRuleText('')
              setRuleKind('')
            }}
          >
            <input value={ruleText} onChange={(e) => setRuleText(e.target.value)} placeholder={t('ws.ruleTitle')} />
            <select value={ruleKind} onChange={(e) => setRuleKind(e.target.value as ChatKind | '')} aria-label={t('ws.ruleKinds')}>
              <option value="">{t('ws.ruleAny')}</option>
              {(['group', 'channel', 'user', 'bot'] as ChatKind[]).map((k) => (
                <option key={k} value={k}>
                  {t(`kind.${k}` as Key)}
                </option>
              ))}
            </select>
            <button className="btn sm" disabled={!ruleText.trim() && !ruleKind}>
              <Icon name="plus" size={16} /> {t('ws.addRule')}
            </button>
          </form>
        </section>

        <button
          className="btn danger"
          onClick={() => {
            if (!window.confirm(t('ws.deleteConfirm', { name: ws.name }))) return
            org.removeWorkspace(ws.id)
            setView({ kind: 'inbox' })
            onClose()
          }}
        >
          <Icon name="trash" size={16} /> {t('ws.delete')}
        </button>
      </div>
    </Modal>
  )
}

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const t = useT()
  return (
    <div className="field">
      <span className="field-label">{t('ws.color')}</span>
      <div className="swatches" role="radiogroup">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={c}
            className={value === c ? 'on' : ''}
            style={{ background: c }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- settings

type InstallEvent = Event & { prompt(): Promise<void> }
let deferredInstall: InstallEvent | null = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredInstall = e as InstallEvent
})

export function Settings({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { lang, setLang } = useLang()
  const { theme, setTheme } = useTheme()
  const me = useApp((s) => s.me)
  const provider = useApp((s) => s.provider)
  const stop = useApp((s) => s.stop)
  const toast = useApp((s) => s.toast)
  const org = useOrg()
  const file = useRef<HTMLInputElement>(null)
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const [canInstall, setCanInstall] = useState(!!deferredInstall)

  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault()
      deferredInstall = e as InstallEvent
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])

  const exportOrg = () => {
    const blob = new Blob([JSON.stringify(org.exportData(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `switchboard-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  return (
    <Modal title={t('settings.title')} onClose={onClose}>
      <div className="stack">
        <section className="settings-sec">
          <h3 className="field-label">{t('settings.account')}</h3>
          <p>
            <b>{me?.name}</b> {me?.username && <span className="muted">@{me.username}</span>}
          </p>
          <button
            className="btn sm"
            onClick={async () => {
              await stop()
              onClose()
              if (provider?.demo) location.hash = ''
              location.reload()
            }}
          >
            {provider?.demo ? t('settings.logoutDemo') : t('settings.logout')}
          </button>
        </section>

        <section className="settings-sec">
          <h3 className="field-label">{t('settings.install')}</h3>
          <p className="muted small">{t('settings.installHelp')}</p>
          {standalone ? (
            <p className="small">{t('settings.installed')}</p>
          ) : canInstall ? (
            <button
              className="btn primary sm"
              onClick={async () => {
                await deferredInstall?.prompt()
                deferredInstall = null
                setCanInstall(false)
              }}
            >
              <Icon name="install" size={16} /> {t('settings.install')}
            </button>
          ) : (
            <p className="small">{t('settings.installManual')}</p>
          )}
        </section>

        <section className="settings-sec two">
          <div className="field">
            <span className="field-label">{t('settings.theme')}</span>
            <div className="segmented">
              {(['auto', 'light', 'dark'] as Theme[]).map((x) => (
                <button key={x} className={theme === x ? 'on' : ''} onClick={() => setTheme(x)}>
                  {t(x === 'auto' ? 'settings.themeAuto' : x === 'light' ? 'settings.themeLight' : 'settings.themeDark')}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">{t('settings.lang')}</span>
            <div className="segmented">
              <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>
                Français
              </button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
                English
              </button>
            </div>
          </div>
        </section>

        <section className="settings-sec">
          <h3 className="field-label">{t('settings.tags')}</h3>
          {org.tags.length === 0 ? (
            <p className="muted small">{t('settings.noTags')}</p>
          ) : (
            <div className="chips">
              {org.tags.map((tg) => (
                <span key={tg.id} className="chip tag on" style={{ '--tag': tg.color } as React.CSSProperties}>
                  {tg.name}
                  <button className="chip-x" onClick={() => org.removeTag(tg.id)} aria-label={`${t('ws.delete')} ${tg.name}`}>
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="settings-sec">
          <h3 className="field-label">{t('settings.backup')}</h3>
          <p className="muted small">{t('settings.backupHelp')}</p>
          <div className="row-btns">
            <button className="btn sm" onClick={exportOrg}>
              <Icon name="download" size={16} /> {t('settings.export')}
            </button>
            <button className="btn sm" onClick={() => file.current?.click()}>
              {t('settings.import')}
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  org.importData(JSON.parse(await f.text()))
                  toast(t('settings.imported'))
                } catch (err) {
                  toast(String(err), 'error')
                }
              }}
            />
          </div>
        </section>
        <p className="muted small">{t('settings.about')}</p>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- command palette

export function Palette({ onClose }: { onClose: () => void }) {
  const t = useT()
  const chats = useApp((s) => s.chats)
  const openChat = useApp((s) => s.openChat)
  const setView = useApp((s) => s.setView)
  const workspaces = useOrg((s) => s.workspaces)
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)

  type Item = { key: string; label: string; run: () => void; node: React.ReactNode }
  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase()
    const ws: Item[] = workspaces
      .filter((w) => !s || w.name.toLowerCase().includes(s))
      .map((w) => ({
        key: `ws:${w.id}`,
        label: w.name,
        run: () => setView({ kind: 'ws', id: w.id }),
        node: (
          <>
            <span className="ws-dot" style={{ '--ws': w.color } as React.CSSProperties} /> {w.name}
          </>
        ),
      }))
    const cs: Item[] = Object.values(chats)
      .filter((c) => !s || c.title.toLowerCase().includes(s) || (c.username ?? '').toLowerCase().includes(s))
      .sort((a, b) => {
        if (s) {
          const ap = a.title.toLowerCase().startsWith(s) ? 0 : 1
          const bp = b.title.toLowerCase().startsWith(s) ? 0 : 1
          if (ap !== bp) return ap - bp
        }
        return (b.last?.date ?? 0) - (a.last?.date ?? 0)
      })
      .slice(0, 40)
      .map((c) => ({
        key: c.id,
        label: c.title,
        run: () => openChat(c.id),
        node: (
          <>
            <Avatar chat={c} size={28} /> <span className="ellipsis grow">{c.title}</span> <Lamp chat={c} />
          </>
        ),
      }))
    return [...ws, ...cs]
  }, [q, chats, workspaces, openChat, setView])

  useEffect(() => setI(0), [q])

  const go = (it?: Item) => {
    if (!it) return
    it.run()
    onClose()
  }

  return (
    <div className="scrim top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label={t('nav.search')}>
        <label className="search big">
          <Icon name="search" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('palette.ph')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') (e.preventDefault(), setI(Math.min(i + 1, items.length - 1)))
              if (e.key === 'ArrowUp') (e.preventDefault(), setI(Math.max(i - 1, 0)))
              if (e.key === 'Enter') go(items[i])
            }}
          />
        </label>
        <ul className="palette-list" role="listbox">
          {items.length === 0 && <li className="muted">{t('palette.empty')}</li>}
          {items.map((it, k) => (
            <li key={it.key} role="option" aria-selected={k === i} className={k === i ? 'on' : ''} onMouseEnter={() => setI(k)} onClick={() => go(it)}>
              {it.node}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
