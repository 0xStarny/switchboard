import { useEffect, useState } from 'react'
import type { TelegramClient } from 'telegram'
import { useApp } from './store/app'
import { getCreds, hasSession, clearSession, makeClient, LiveProvider } from './tg/live'
import { DemoProvider } from './tg/demo'
import { explainError, useT } from './lib/i18n'
import { Login, Wordmark } from './ui/Login'
import { Shell } from './ui/Shell'

type Phase = 'boot' | 'login' | 'loading' | 'ready' | 'error'

export function App() {
  const t = useT()
  const start = useApp((s) => s.start)
  const [phase, setPhase] = useState<Phase>('boot')
  const [error, setError] = useState('')

  const run = async (make: () => Promise<LiveProvider | DemoProvider>) => {
    setPhase('loading')
    try {
      await start(await make())
      setPhase('ready')
    } catch (e) {
      if ((e as { silent?: boolean }).silent) return
      setError(explainError(e))
      setPhase('error')
    }
  }

  const startDemo = () => {
    if (location.hash !== '#demo') history.replaceState(null, '', '#demo')
    run(async () => new DemoProvider())
  }

  const startLive = (client: TelegramClient) => run(async () => new LiveProvider(client))

  useEffect(() => {
    if (location.hash === '#demo') return startDemo()
    const creds = getCreds()
    if (!creds || !hasSession()) return setPhase('login')
    run(async () => {
      const client = makeClient(creds)
      await client.connect()
      if (!(await client.checkAuthorization())) {
        clearSession()
        await client.disconnect()
        setPhase('login')
        throw Object.assign(new Error('signed out'), { silent: true })
      }
      return new LiveProvider(client)
    }).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (phase === 'ready') return <Shell />
  if (phase === 'login') return <Login onDone={startLive} onDemo={startDemo} />
  return (
    <main className="boot">
      <Wordmark />
      {phase === 'error' ? (
        <>
          <p className="error">{error}</p>
          <div className="row-btns">
            <button className="btn primary" onClick={() => location.reload()}>
              {t('login.retry')}
            </button>
            <button
              className="btn"
              onClick={() => {
                clearSession()
                location.hash = ''
                location.reload()
              }}
            >
              {t('settings.logout')}
            </button>
          </div>
        </>
      ) : (
        <p className="muted">{phase === 'loading' ? t('login.loading') : t('login.connecting')}</p>
      )}
    </main>
  )
}
