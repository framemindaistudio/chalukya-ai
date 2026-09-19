// After each action, is its result on screen at phone size? (below the sticky header, above the tab bar)
const { chromium } = require('playwright-core')
const [base, photo] = process.argv.slice(2), sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, geolocation: { latitude: 15.9186, longitude: 75.6813 }, permissions: ['geolocation'] })
  await c.addInitScript(() => { try { localStorage.setItem('chalukya.lang', 'en'); localStorage.setItem('chalukya.installDismissed', '1') } catch {} })
  const p = await c.newPage()
  p.on('pageerror', (e) => console.log('  page error:', e.message))
  const open = async (path) => { await p.goto(base + path, { waitUntil: 'domcontentloaded' }); await sleep(3300) }
  const seen = (sel, label) => p.evaluate(([sel, label]) => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : null
    if (!el) return `${label}: NOT RENDERED`
    const r = el.getBoundingClientRect(), top = document.querySelector('header').getBoundingClientRect().bottom
    const nav = document.querySelector('nav[aria-label="Main"]')?.getBoundingClientRect().top ?? innerHeight
    const ok = r.top >= top - 2 && r.top < nav - 60
    return `${ok ? 'PASS' : 'FAIL'} ${label}: top ${Math.round(r.top)} (visible band ${Math.round(top)}–${Math.round(nav)}), scrollY ${Math.round(scrollY)}`
  }, [sel, label])

  await open('/plan')
  await p.fill('textarea', 'I am in Badami. I have 6 hours, ₹3,000 budget, two children, and I like history.')
  await p.click('text=Plan it'); await sleep(1800)
  console.log(await seen('[data-tour=day]', 'Plan · describe → Plan it'))
  console.log('  understood line above the plan:', await p.evaluate(() => !!document.querySelector('[data-tour=day]')?.parentElement?.firstElementChild?.textContent?.includes('Understood')))

  await open('/plan')
  await p.click('text=Build my plan'); await sleep(1800)
  console.log(await seen('[data-tour=day]', 'Plan · form → Build my plan'))

  await open('/scan')
  await p.setInputFiles('input[type=file]:not([capture])', photo); await sleep(9000)
  console.log(await seen('main .rise', 'Scan · photo → identification'))
  console.log('  result:', await p.evaluate(() => document.querySelector('main .rise h2')?.textContent || document.querySelector('main .rise')?.textContent?.slice(0, 60)))

  await open('/scan?mode=board')
  await p.click('button:has(img[src*="board_galaganatha"])')
  for (let i = 0; i < 30 && !(await p.$('main .rise')); i++) await sleep(1000)
  await sleep(900)
  console.log(await seen('main .rise', 'Board · sample → reading'))
  await p.click('main .rise button:has-text("Hindi")').catch(() => p.click('main .rise button:has-text("हिन्दी")'))
  await sleep(1500)
  console.log(await seen('main .rise .bg-mist, main .rise .animate-spin', 'Board · translate → translation'))

  await open('/place/badami_caves')
  await p.locator('textarea').scrollIntoViewIfNeeded(); await p.fill('textarea', 'The caves were amazing but the toilets were dirty and there was no drinking water.')
  await p.click('text=Send review'); await sleep(1500)
  console.log(await seen('.card > .rise.bg-mist', 'Place · Send review → analysis'))

  await open('/local')
  await p.locator('form input').first().scrollIntoViewIfNeeded(); await p.fill('form input >> nth=0', 'Test Rotti Mane')
  await p.click('text=Submit for verification'); await sleep(1200)
  console.log(await seen('main p.rounded-xl.bg-lake-soft\\/60', 'Local · Submit → confirmation'))

  await open('/stay')
  const cards = p.locator('main .card button[aria-expanded]'); await cards.nth(3).scrollIntoViewIfNeeded()
  await p.evaluate(() => window.scrollBy(0, 250)); await sleep(300)
  await cards.nth(3).click(); await sleep(1200)
  console.log(await p.evaluate(() => { const el = document.querySelectorAll('main .card button[aria-expanded]')[3].parentElement, r = el.getBoundingClientRect(), nav = document.querySelector('nav[aria-label="Main"]').getBoundingClientRect().top
    return `${r.bottom <= nav + 2 || r.top <= 70 ? 'PASS' : 'FAIL'} Stay · open 4th hotel: card ${Math.round(r.top)}–${Math.round(r.bottom)}, tab bar at ${Math.round(nav)}` }))

  await open('/safety')
  const sos = await p.locator('button:has-text("SOS")').first().boundingBox()
  await p.mouse.move(sos.x + sos.width / 2, sos.y + sos.height / 2); await p.mouse.down(); await sleep(2300); await p.mouse.up(); await sleep(1500)
  console.log(await p.evaluate(() => { const el = document.querySelector('main .rise.bg-sos, main .rise.bg-lake'); if (!el) return 'SOS card NOT RENDERED'; const r = el.getBoundingClientRect(), nav = document.querySelector('nav[aria-label="Main"]').getBoundingClientRect().top
    return `${r.bottom <= nav + 2 ? 'PASS' : 'FAIL'} Safety · hold SOS → status card ${Math.round(r.top)}–${Math.round(r.bottom)}, tab bar at ${Math.round(nav)}` }))
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })
