// Telegram rate-limits bursts of write requests (FLOOD_WAIT). Every bulk action goes
// through this queue: one request at a time, a short gap between them, and an
// automatic pause when Telegram asks us to wait.

const GAP_MS = 350
let chain: Promise<unknown> = Promise.resolve()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function floodSeconds(err: unknown): number | null {
  const e = err as { seconds?: number; errorMessage?: string }
  if (typeof e?.seconds === 'number' && /FLOOD/.test(e.errorMessage ?? '')) return e.seconds
  return null
}

export function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      try {
        const out = await task()
        await sleep(GAP_MS)
        return out
      } catch (err) {
        const wait = floodSeconds(err)
        if (wait === null || attempt >= 2 || wait > 120) throw err
        await sleep((wait + 1) * 1000)
      }
    }
  }
  const p = chain.then(run, run)
  chain = p.catch(() => undefined)
  return p
}

/** Small concurrency limiter for reads (avatars, thumbnails). */
export function limiter(max: number) {
  let active = 0
  const waiting: (() => void)[] = []
  return async function <T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((r) => waiting.push(r))
    active++
    try {
      return await task()
    } finally {
      active--
      waiting.shift()?.()
    }
  }
}
