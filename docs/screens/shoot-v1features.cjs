// The version-1 modules added for the competition's remaining problem statements.
// Usage: node shoot-v1features.cjs <outDir> <base> <crackPhoto>
const { chromium } = require('playwright-core')
const path = require('path')
const [OUT, BASE, PHOTO] = process.argv.slice(2)
const CLOCK = 't=2026-09-25T10:30'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const url = (u) => BASE + u + (u.includes('?') ? '&' : '?') + CLOCK

async function open(page, u, settle = 2400) {
  await page.goto(url(u), { waitUntil: 'domcontentloaded' })
  await sleep(700); await page.mouse.click(195, 420).catch(() => {}); await sleep(900); await sleep(settle)
}
const shot = async (p, n) => { await p.screenshot({ path: path.join(OUT, n + '.png') }); console.log('saved', n) }
async function scrollToText(page, text, offset = 90) {
  const ok = await page.evaluate(([t, o]) => {
    const own = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')
    const el = [...document.querySelectorAll('body *')].find((e) => own(e).includes(t))
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - o)
    return !!el
  }, [text, offset])
  if (!ok) console.log('  (not found:', text + ')')
  await sleep(700)
}

;(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  const phone = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-IN',
    geolocation: { latitude: 15.9186, longitude: 75.6813 }, permissions: ['geolocation'] })
  await phone.addInitScript(() => { try { localStorage.setItem('chalukya.lang', 'en') } catch {} })
  const p = await phone.newPage()
  p.on('pageerror', (e) => console.log('page error:', e.message))

  // 07 + 18 · report a crack or litter to the district
  await open(p, '/report', 2200)
  await p.setInputFiles('input[type=file]:not([capture])', PHOTO); await sleep(1500)
  await p.click('text=Check the stone'); await sleep(2500)
  console.log('stone check:', await p.evaluate(() => document.querySelector('.rise.mt-3.rounded-xl')?.innerText.replace(/\n/g, ' | ').slice(0, 150)))
  await scrollToText(p, 'What are you reporting?', 150); await shot(p, 'report_stone')
  await p.selectOption('select', { index: 0 }).catch(() => {})
  await p.click('text=Litter').catch(() => {})
  await p.fill('textarea', 'Plastic bottles left near the steps and the bin is full.')
  await p.click('text=Send to the district'); await sleep(2500)
  await scrollToText(p, 'Sent. Thank you.', 240); await shot(p, 'report_sent')

  // 19 · green stays, declared by owners in the portal
  await open(p, '/stay', 2400)
  await p.click('.card button:has-text("Green stays only")'); await sleep(1400)
  await scrollToText(p, 'No stay has declared yet', 320); await shot(p, 'stay_green')

  // 08 + 12 · crafts ordered by distance from where you will be
  await open(p, '/local', 2400)
  await p.click('text=Pattadakal').catch(() => {}); await sleep(1200); await shot(p, 'local_near')

  // 13 · safer hours for solo, elderly and family visits
  await open(p, '/safety', 2600)
  await scrollToText(p, 'Safer hours today', 210); await shot(p, 'safety_hours')

  // 11 · translate anything with the district server
  await open(p, '/scan?mode=board', 2600)
  await scrollToText(p, 'Translate anything', 200)
  await p.fill('textarea', 'The temple closes at six in the evening. Drinking water is near the gate.')
  await p.click('.card >> text=हिन्दी').catch(async () => { await p.click('text=हिन्दी') })
  for (let i = 0; i < 60; i++) { await sleep(1000); const busy = await p.$('.animate-spin'); if (!busy && i > 2) break }
  await sleep(600); await scrollToText(p, 'Translate anything', 200); await shot(p, 'translate_any')

  // 20 + 15 · carrying capacity and waste rounds in the command centre
  const desk = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: 'en-IN' })
  await desk.addInitScript(() => { try { localStorage.setItem('chalukya.lang', 'en') } catch {} })
  const d = await desk.newPage()
  await open(d, '/command', 4200)
  await scrollToText(d, 'Carrying capacity', 100); await sleep(800); await shot(d, 'command_capacity_v1')
  console.log('capacity rows:', await d.evaluate(() => document.querySelectorAll('table')[0]?.rows.length))
  await scrollToText(d, 'Resource planning', 100); await shot(d, 'command_waste_rounds')
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })
