// "Keep nothing on this computer": the Telegram session and your sorting live in
// sessionStorage instead of localStorage, so closing the tab erases them, and the
// avatar/thumbnail cache is skipped.

const FLAG = 'sb.ephemeral'

const safe = (s: () => Storage): Storage | null => {
  try {
    return s()
  } catch {
    return null
  }
}

export function isEphemeral() {
  return safe(() => sessionStorage)?.getItem(FLAG) === '1'
}

export function setEphemeral(on: boolean) {
  const ss = safe(() => sessionStorage)
  if (on) ss?.setItem(FLAG, '1')
  else ss?.removeItem(FLAG)
}

/** Where account data goes for this tab. */
export function accountStore(): Storage | null {
  return isEphemeral() ? safe(() => sessionStorage) : safe(() => localStorage)
}
