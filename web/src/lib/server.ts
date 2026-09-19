/*
  Is the district/laptop server behind this origin? One probe per page load.
  'up'     → the FastAPI server answered (live alerts, translation, e5 intent, Grad-CAM…)
  'static' → a static host such as Vercel: its /api/health is a file saying {"static":true} (or a 404),
             so no server will ever appear and live features stop trying
  'down'   → network error: the laptop server may start later, so live features keep retrying
  Everything that matters runs on the phone either way.
*/
export type ServerState = 'up' | 'static' | 'down'

export const serverState: Promise<ServerState> = typeof window === 'undefined' ? Promise.resolve('down')
  : fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(2500) })
    .then(async (r): Promise<ServerState> => {
      if (r.status === 404) return 'static'
      if (!r.ok) return 'down'
      const j = await r.json().catch(() => null)
      return j?.static ? 'static' : j?.ok ? 'up' : 'down'
    })
    .catch(() => 'down' as ServerState)

export const isStaticHost = () => serverState.then((s) => s === 'static')
