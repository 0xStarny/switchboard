import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/schibsted-grotesk'
import './styles.css'
import './lib/theme'
import { App } from './App'
import { useLang } from './lib/i18n'

document.documentElement.lang = useLang.getState().lang

// Dev-only handle for poking at state from the console.
if (import.meta.env.DEV) {
  Promise.all([import('./store/app'), import('./store/org')]).then(([a, o]) => {
    Object.assign(window, { __sb: { app: a.useApp, org: o.useOrg } })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
