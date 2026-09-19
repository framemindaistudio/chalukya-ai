// Walks the judge tour at phone size: start from Home, step through, check each screen and the timer.
const { chromium } = require('playwright-core')
const [base, outDir] = process.argv.slice(2), sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await c.addInitScript(() => { try { localStorage.setItem('chalukya.lang', 'en') } catch {} })
  const p = await c.newPage()
  p.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 200)) })
  p.on('pageerror', (e) => console.log('page error:', e.message))
  const state = () => p.evaluate(() => {
    const d = document.querySelector('[role=dialog]')
    const r = d?.getBoundingClientRect()
    return { url: location.pathname + location.search.slice(0, 30), caption: d ? d.innerText.split('\n').slice(0, 2).join(' | ') : null,
      top: r ? Math.round(r.top) : null, bottom: r ? Math.round(r.bottom) : null, overflowX: document.documentElement.scrollWidth > innerWidth }
  })
  await p.goto(base + '/', { waitUntil: 'domcontentloaded' }); await sleep(3600)
  await p.click('text=Take the 90-second tour'); await sleep(900)
  for (let i = 0; i < 7; i++) {
    await sleep(i === 1 || i === 2 ? 2500 : 1500)
    const s = await state(); console.log(`step ${i + 1}`, JSON.stringify(s))
    await p.screenshot({ path: `${outDir}/tour-${i + 1}.png` })
    if (i < 6) await p.click('[role=dialog] >> text=Next')
  }
  await p.click('[role=dialog] >> text=Finish'); await sleep(800)
  console.log('after finish', JSON.stringify(await state()))

  // the timer advances on its own; pause holds it
  await p.goto(base + '/?tour=1', { waitUntil: 'domcontentloaded' }); await sleep(3200)
  console.log('autostart', JSON.stringify(await state()))
  await sleep(12500); console.log("after 12.5 s", JSON.stringify(await state()))
  await p.click("[role=dialog] >> text=Pause"); await sleep(13000)
  console.log('paused 13 s', JSON.stringify(await state()))
  await p.click('[role=dialog] >> text=Back'); await sleep(900)
  console.log('back', JSON.stringify(await state()))
  await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(3400)
  console.log('after reload', JSON.stringify(await state()))
  await p.click('[aria-label="End tour"]'); await sleep(500)
  console.log('ended', JSON.stringify(await state()))
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })
