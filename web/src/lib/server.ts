/*
  Is the district/laptop server behind this origin? One probe per page load.
  'up'     → the FastAPI server answered (live alerts, translation, e5 intent, Grad-CAM…)
  'static' → a static host such as Vercel answered 404: no server will ever appear, so stop trying
  'down'   → network error: the laptop server may start later, so live features keep retrying
  Everything that matters runs on the phone either way.
*/
export type ServerState = 'up' | 'static' | 'down'

export const serverState: Promise<ServerState> = typeof window === 'undefined' ? Promise.resolve('down')
  : fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(2500) })
    .then((r) => (r.ok ? 'up' : r.status === 404 ? 'static' : 'down') as ServerState)
    .catch(() => 'down' as ServerState)

export const isStaticHost = () => serverState.then((s) => s === 'static')
