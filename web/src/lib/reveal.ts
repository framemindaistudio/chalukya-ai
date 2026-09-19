import { useEffect, type RefObject } from 'react'

/*
  After a tap produces a result further down the page, bring it into view: smoothly, clear of the sticky
  header and the bottom tab bar, and moving as little as possible (a short result is shown whole with what
  is above it, a tall one from its top). Nothing moves if the result is already on screen. It waits for the
  result to render, since lazy pages and plans can take a moment.
*/
export function reveal(target: () => Element | null | undefined, tries = 25) {
  const tick = (n: number) => {
    const el = target()
    if (!el || !el.getBoundingClientRect().height) { if (n < tries) setTimeout(() => tick(n + 1), 80); return }
    const r = el.getBoundingClientRect()
    const top = (document.querySelector('header')?.getBoundingClientRect().bottom ?? 0) + 12
    const nav = document.querySelector('nav[aria-label="Main"]')?.getBoundingClientRect().top ?? innerHeight
    const bottom = Math.min(nav, innerHeight) - 12
    let dy = 0
    if (r.top < top) dy = r.top - top
    else if (r.bottom > bottom) dy = Math.min(r.bottom - bottom, r.top - top)
    if (Math.abs(dy) < 8) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollBy({ top: dy, behavior: reduced ? 'auto' : 'smooth' })
  }
  setTimeout(() => tick(0), 60)
}

/** Reveal `ref` whenever `key` changes to something truthy (a new result, a new plan, a new answer). */
export function useReveal(ref: RefObject<Element | null>, key: unknown) {
  useEffect(() => { if (key) reveal(() => ref.current) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
