// Feature-by-feature screenshots for the deck (one feature, one slide). Runs against the LOCAL server so live
// alerts and translation work too. Usage: node shoot-v3.cjs <outDir> <base> <natarajaPhoto> [only,names]
const { chromium } = require('playwright-core')
const path = require('path')
const [OUT, BASE, NATARAJA, ONLY_ARG] = process.argv.slice(2)
const ONLY = ONLY_ARG ? ONLY_ARG.split(',') : null
const CLOCK = 't=2026-09-26T10:30'   // competition day, Saturday mid-morning: sites open, realistic crowds
const BRIEF = 'I am in Badami. I have 6 hours, ₹3,000 budget, two children, and I like history.'
const want = (n) => !ONLY || ONLY.includes(n)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const url = (u) => BASE + u + (u.includes('?') ? '&' : '?') + CLOCK

async function open(page, u, settle = 2400) {
  await page.goto(url(u), { waitUntil: 'domcontentloaded' })
  await sleep(700); await page.mouse.click(195, 420).catch(() => {}); await sleep(900)   // tap past the boot screen
  await sleep(settle)
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('saved', name) }
async function scrollToText(page, text, offset = 90) {
  const ok = await page.evaluate(([t, o]) => {
    const own = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')   // the element's own text, icons beside it allowed
    const el = [...document.querySelectorAll('body *')].find((e) => own(e).includes(t))
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - o)
    return !!el
  }, [text, offset])
  if (!ok) console.log('  (text not found:', text + ')')
  await sleep(800)
}
async function holdSos(page) {
  const b = await page.locator('button:has-text("SOS")').first().boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await sleep(2300); await page.mouse.up(); await sleep(2200)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  const phoneOpts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-IN',
    geolocation: { latitude: 15.9186, longitude: 75.6813 }, permissions: ['geolocation'] }
  const phone = await browser.newContext(phoneOpts)
  await phone.addInitScript(() => { try { if (!location.search.includes('lang=')) localStorage.setItem('chalukya.lang', 'en') } catch {} })
  const page = await phone.newPage()

  // the command centre opens first, so the phone's SOS arrives on it live
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: 'en-IN' })
  await desk.addInitScript(() => { try { localStorage.setItem('chalukya.lang', 'en') } catch {} })
  const cmd = await desk.newPage()
  if (want('command') || want('command_sos') || want('command_drill') || want('command_capacity') || want('command_resources') || want('command_insights') || want('command_cctv')) {
    await open(cmd, '/command', 4500)
    if (want('command')) await shot(cmd, 'command')
  }

  if (want('home') || want('home_map')) {
    await open(page, '/', 3600)
    if (want('home')) await shot(page, 'home')
    if (want('home_map')) { await page.evaluate(() => { const s = document.querySelector('[data-tour=circuit]'); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 70) }); await sleep(2800); await shot(page, 'home_map') }
  }
  if (want('tour')) {
    await page.goto(url('/?tour=1'), { waitUntil: 'domcontentloaded' }); await sleep(7000); await shot(page, 'tour')
    await page.click('[aria-label="End tour"]').catch(() => {})
  }
  if (want('ask_plan')) { await open(page, '/ask?q=' + encodeURIComponent(BRIEF), 4500); await scrollToText(page, 'Your 6-hour plan', 150); await shot(page, 'ask_plan') }
  if (want('ask_kn')) { await open(page, '/ask?lang=kn&q=' + encodeURIComponent('ಪಟ್ಟದಕಲ್ಲು ಈಗ ರಶ್ ಇದೆಯಾ?'), 4500); await shot(page, 'ask_kn') }
  if (want('plan') || want('plan_share')) {
    await open(page, '/plan?q=' + encodeURIComponent('2 days from Bagalkot with my parents, we like temples and sunsets, budget ₹8000'), 3500)
    if (want('plan')) await shot(page, 'plan')
    if (want('plan_share')) { await scrollToText(page, 'Route in Google Maps', 560); await shot(page, 'plan_share') }
  }
  if (want('scan')) {
    await open(page, '/scan', 2500)
    await page.setInputFiles('input[type=file]:not([capture])', NATARAJA)
    await page.waitForSelector('text=confidence', { timeout: 40000 }).catch(() => console.log('  no confidence text'))
    await sleep(2000); await page.evaluate(() => window.scrollBy(0, -170)); await sleep(700); await shot(page, 'scan')
  }
  if (want('board') || want('board_tx')) {
    await open(page, '/scan?mode=board', 2500)
    await page.click('button:has(img[src*="board_galaganatha"])')
    await page.waitForSelector('main .rise', { timeout: 120000 }).catch(() => console.log('  board: no result'))
    await sleep(2200); if (want('board')) await shot(page, 'board')
    if (want('board_tx')) {
      await page.click('main .rise button:has-text("Hindi")').catch(() => page.click('main .rise button:has-text("हिन्दी")'))
      for (let i = 0; i < 90; i++) { await sleep(1000); const busy = await page.$('main .rise .bg-mist .animate-spin, main .rise .animate-spin'); if (!busy && i > 3) break }
      await sleep(800); await scrollToText(page, 'NLLB-200', 700); await shot(page, 'board_tx')
    }
  }
  if (want('place') || want('place_crowd') || want('place_review')) {
    await open(page, '/place/pattadakal', 2800)
    if (want('place')) await shot(page, 'place')
    if (want('place_crowd')) { await scrollToText(page, 'Crowd today', 110); await shot(page, 'place_crowd') }
    if (want('place_review')) {
      await page.locator('textarea').last().scrollIntoViewIfNeeded()
      await page.click('[aria-label="4 stars"]').catch(() => {})
      await page.fill('textarea >> nth=-1', 'Beautiful temples, the guide was very good. But the toilets were dirty and there was no drinking water near the gate.')
      await page.click('text=Send review'); await sleep(2500); await shot(page, 'place_review')
    }
  }
  if (want('stay') || want('stay_open')) {
    await open(page, '/stay', 2600)
    if (want('stay')) await shot(page, 'stay')
    if (want('stay_open')) { await page.locator('main .card button[aria-expanded]').first().click(); await sleep(1800); await shot(page, 'stay_open') }
  }
  for (const [name, u] of [['food', '/food'], ['parking', '/parking'], ['safety', '/safety'], ['access', '/access'], ['local', '/local'], ['how', '/how']]) {
    if (!want(name)) continue
    await open(page, u, 2800); await shot(page, name)
  }
  if (want('sos_live') || want('command_sos')) {
    await open(page, '/safety', 2800); await holdSos(page)
    if (want('sos_live')) await shot(page, 'sos_live')
    if (want('command_sos')) { await sleep(1500); await cmd.evaluate(() => window.scrollTo(0, 0)); await sleep(600); await shot(cmd, 'command_sos') }
  }
  if (want('sos_offline')) {
    const off = await browser.newContext(phoneOpts)
    await off.addInitScript(() => { try { localStorage.setItem('chalukya.lang', 'en') } catch {} })
    const p2 = await off.newPage()
    await open(p2, '/safety', 2800); await off.setOffline(true); await sleep(1200)
    await holdSos(p2); await p2.evaluate(() => window.scrollTo(0, 0)); await sleep(900); await shot(p2, 'sos_offline')
    await off.close()
  }
  if (want('install')) {
    const ios = await browser.newContext({ ...phoneOpts, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' })
    await ios.addInitScript(() => { try { localStorage.setItem('chalukya.lang', 'en') } catch {} })
    const p3 = await ios.newPage()
    await open(p3, '/', 3600); await scrollToText(p3, 'Install Chalukya AI', 380); await shot(p3, 'install')
    await ios.close()
  }
  if (want('command_drill') || want('command_capacity') || want('command_resources') || want('command_insights') || want('command_cctv')) {
    if (want('command_drill')) {
      await scrollToText(cmd, 'Dasara rush 11 AM', 300); await cmd.click('text=Dasara rush 11 AM'); await sleep(3500)
      await cmd.evaluate(() => window.scrollTo(0, 0)); await sleep(800); await shot(cmd, 'command_drill')
    }
    if (want('command_capacity')) { await scrollToText(cmd, 'Sites now vs carrying capacity', 110); await shot(cmd, 'command_capacity') }
    if (want('command_resources')) { await scrollToText(cmd, 'Resource planning', 110); await shot(cmd, 'command_resources') }
    if (want('command_cctv')) { await scrollToText(cmd, 'CCTV people counter', 110); await sleep(1500); await shot(cmd, 'command_cctv') }
    if (want('command_insights')) { await scrollToText(cmd, 'What visitors say', 110); await shot(cmd, 'command_insights') }
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
