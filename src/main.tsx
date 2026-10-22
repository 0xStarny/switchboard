import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/schibsted-grotesk'
import './styles.css'
import './lib/theme'
import { App } from './App'
import { useLang } from './lib/i18n'

document.documentElement.lang = useLang.getState().lang

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
