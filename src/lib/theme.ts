import { create } from 'zustand'

export type Theme = 'auto' | 'light' | 'dark'

const read = (): Theme => {
  try {
    const t = localStorage.getItem('sb.theme')
    if (t === 'light' || t === 'dark') return t
  } catch {
    /* ignore */
  }
  return 'auto'
}

const apply = (t: Theme) => {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', t)
}

export const useTheme = create<{ theme: Theme; setTheme(t: Theme): void }>((set) => {
  const theme = read()
  apply(theme)
  return {
    theme,
    setTheme(theme) {
      try {
        localStorage.setItem('sb.theme', theme)
      } catch {
        /* ignore */
      }
      apply(theme)
      set({ theme })
    },
  }
})
