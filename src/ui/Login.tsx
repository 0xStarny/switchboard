import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { TelegramClient } from 'telegram'
import { credsFromBuild, forgetCreds, getCreds, hasOwnCreds, loginWithPhone, loginWithQr, makeClient, saveCreds, type ApiCreds } from '../tg/live'
import { isEphemeral, setEphemeral } from '../lib/storage'
import { explainError, useLang, useT } from '../lib/i18n'
import { Icon } from './Icon'

type Step = 'qr' | 'phone' | 'code' | 'password' | 'done'

const REPO = import.meta.env.VITE_REPO_URL as string | undefined

export function Wordmark() {
  return (
    <div className="wordmark">
      <span className="wordmark-lamps" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} style={{ animationDelay: `${180 + i * 140}ms` }} />
        ))}
      </span>
      <span className="wordmark-text">Switchboard</span>
    </div>
  )
}

export function Login({ onDone, onDemo }: { onDone: (c: TelegramClient) => void; onDemo: () => void }) {
  const t = useT()
  const { lang, setLang } = useLang()
  const [creds, setCreds] = useState<ApiCreds | null>(getCreds())
  const [step, setStep] = useState<Step>('qr')
  const [qr, setQr] = useState('')
  const [hint, setHint] = useState<string | undefined>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [value, setValue] = useState('')
  const [ephemeral, setEph] = useState(isEphemeral())
  const [ownKey, setOwnKey] = useState(false)
  const clientRef = useRef<TelegramClient | null>(null)
  const answer = useRef<((v: string) => void) | null>(null)
  const generation = useRef(0)

  const ask = (s: 'code' | 'password', h?: string) =>
    new Promise<string>((resolve) => {
      setBusy(false)
      setValue('')
      setHint(h)
      setStep(s)
      answer.current = resolve
    })

  const fresh = async () => {
    const gen = ++generation.current
    const old = clientRef.current
    clientRef.current = null
    old?.disconnect().catch(() => undefined)
    const c = makeClient(creds!)
    await c.connect()
    if (gen !== generation.current) {
      c.disconnect().catch(() => undefined)
      return null
    }
    clientRef.current = c
    return c
  }

  const startQr = async () => {
    setStep('qr')
    setQr('')
    setError('')
    const gen = generation.current + 1
    try {
      const c = await fresh()
      if (!c) return
      await loginWithQr(c, creds!, {
        onQr: async (url) => {
          if (gen !== generation.current) return
          setQr(await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }))
        },
        ask,
        onError: (e) => gen === generation.current && setError(explainError(e)),
      })
      if (gen !== generation.current) return
      setStep('done')
      onDone(c)
    } catch (e) {
      if (gen === generation.current) setError(explainError(e))
    }
  }

  const startPhone = async (phone: string) => {
    setBusy(true)
    setError('')
    const gen = generation.current + 1
    try {
      const c = await fresh()
      if (!c) return
      await loginWithPhone(c, creds!, phone.replace(/[^\d+]/g, ''), {
        ask,
        onError: (e) => gen === generation.current && (setError(explainError(e)), setBusy(false)),
      })
      if (gen !== generation.current) return
      setStep('done')
      onDone(c)
    } catch (e) {
      if (gen === generation.current) {
        setError(explainError(e))
        setBusy(false)
        setStep('phone')
      }
    }
  }

  useEffect(() => {
    if (creds) startQr()
    return () => {
      generation.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creds])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    if (step === 'phone') return startPhone(value)
    setBusy(true)
    setError('')
    answer.current?.(value.trim())
  }

  return (
    <main className="login">
      <section className="login-intro">
        <Wordmark />
        <p className="login-tagline">{t('app.tagline')}</p>
        <ul className="login-points">
          <li>
            <Icon name="stack" /> {lang === 'fr' ? 'Espaces de travail illimités, avec dossiers et règles automatiques' : 'Unlimited workspaces, with folders and automatic rules'}
          </li>
          <li>
            <Icon name="inbox" /> {lang === 'fr' ? 'Une seule liste de ce qui vous attend, rangée par espace' : 'One list of what is waiting for you, sorted by workspace'}
          </li>
          <li>
            <Icon name="checks" /> {lang === 'fr' ? 'Actions groupées : lire, couper, archiver, déplacer 40 groupes d’un coup' : 'Bulk actions: read, mute, archive or move 40 groups at once'}
          </li>
        </ul>
        <div className="login-privacy">
          <p className="privacy-strong">{t('login.privacy')}</p>
          <p>{t('login.privacyLocal')}</p>
        </div>
        <p className="login-meta">
          {t('app.unofficial')}{' '}
          {REPO && (
            <a href={REPO} target="_blank" rel="noreferrer">
              {t('login.source')}
            </a>
          )}
          <span className="lang-switch">
            <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>
              FR
            </button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
              EN
            </button>
          </span>
        </p>
      </section>

      <section className="login-card" aria-live="polite">
        <label className="check ephemeral">
          <input
            type="checkbox"
            checked={ephemeral}
            onChange={(e) => {
              // Applies to what gets saved from now on, so set it before signing in.
              setEphemeral(e.target.checked)
              setEph(e.target.checked)
            }}
          />
          <span>
            {t('login.ephemeral')}
            <small>{t('login.ephemeralHelp')}</small>
          </span>
        </label>
        {!creds || ownKey ? (
          <CredsForm
            needed={!creds}
            onSave={(c) => {
              generation.current++
              saveCreds(c)
              setOwnKey(false)
              setCreds(c)
            }}
            onCancel={creds ? () => setOwnKey(false) : undefined}
          />
        ) : (
          <>
            <h1>{t('login.title')}</h1>
            {step === 'qr' && (
              <>
                <div className="qr" aria-label="QR code">
                  {qr ? <div dangerouslySetInnerHTML={{ __html: qr }} /> : <span className="muted">{t('login.qrLoading')}</span>}
                </div>
                <p className="muted">{t('login.qrSteps')}</p>
                <button className="link-btn" onClick={() => (generation.current++, setError(''), setValue(''), setStep('phone'))}>
                  {t('login.usePhone')}
                </button>
              </>
            )}
            {(step === 'phone' || step === 'code' || step === 'password') && (
              <form onSubmit={submit} className="login-form">
                <label>
                  <span>{step === 'phone' ? t('login.phone') : step === 'code' ? t('login.code') : t('login.password')}</span>
                  <input
                    autoFocus
                    key={step}
                    type={step === 'password' ? 'password' : step === 'phone' ? 'tel' : 'text'}
                    inputMode={step === 'code' ? 'numeric' : undefined}
                    autoComplete={step === 'password' ? 'current-password' : step === 'code' ? 'one-time-code' : 'tel'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={step === 'phone' ? '+33 6 12 34 56 78' : ''}
                  />
                  {step === 'phone' && <small>{t('login.phoneHint')}</small>}
                  {step === 'password' && hint && <small>{t('login.passwordHint', { hint })}</small>}
                </label>
                <button className="btn primary" disabled={busy || !value.trim()}>
                  {step === 'phone' ? t('login.sendCode') : t('login.continue')}
                </button>
                {step !== 'password' && (
                  <button type="button" className="link-btn" onClick={startQr}>
                    {t('login.useQr')}
                  </button>
                )}
              </form>
            )}
            {step === 'done' && <p className="muted">{t('login.loading')}</p>}
            {error && <p className="error">{error}</p>}
            {!error && (
              <button className="link-btn sm own-key" onClick={() => setOwnKey(true)}>
                {t('login.ownKey')}
              </button>
            )}
            {error && (hasOwnCreds() || !credsFromBuild()) && (
              <button
                className="link-btn sm"
                onClick={() => {
                  generation.current++
                  forgetCreds()
                  setError('')
                  setCreds(null)
                }}
              >
                {t('login.changeKey')}
              </button>
            )}
          </>
        )}
        <button className="btn ghost demo-btn" onClick={onDemo}>
          {t('login.demo')}
        </button>
      </section>
    </main>
  )
}

function CredsForm({ onSave, onCancel, needed }: { onSave: (c: ApiCreds) => void; onCancel?: () => void; needed: boolean }) {
  const t = useT()
  const [id, setId] = useState('')
  const [hash, setHash] = useState('')
  return (
    <form
      className="login-form"
      onSubmit={(e) => {
        e.preventDefault()
        // Pasted keys sometimes carry invisible characters.
        const apiHash = hash.replace(/[^a-f0-9]/gi, '')
        const apiId = Number(id.replace(/\D/g, ''))
        if (apiId && apiHash.length >= 16) onSave({ apiId, apiHash })
      }}
    >
      <h1>{needed ? t('login.creds') : t('login.ownKey')}</h1>
      <p className="muted">{needed ? t('login.credsHelp') : t('login.ownKeyIntro')}</p>
      <ol className="key-steps">
        <li>
          {t('login.step1')}{' '}
          <a href="https://my.telegram.org/apps" target="_blank" rel="noreferrer">
            my.telegram.org
          </a>
        </li>
        <li>{t('login.step2')}</li>
        <li>{t('login.step3')}</li>
        <li>{t('login.step4')}</li>
      </ol>
      <label>
        <span>{t('login.apiId')}</span>
        <input value={id} onChange={(e) => setId(e.target.value)} inputMode="numeric" autoComplete="off" />
      </label>
      <label>
        <span>{t('login.apiHash')}</span>
        <input value={hash} onChange={(e) => setHash(e.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <p className="muted small">{t('login.keyWarning')}</p>
      <button className="btn primary">{t('login.saveCreds')}</button>
      {onCancel && (
        <button type="button" className="link-btn" onClick={onCancel}>
          {t('chat.cancel')}
        </button>
      )}
    </form>
  )
}
