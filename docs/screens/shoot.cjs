// Screenshots of the LIVE app for the deck and the desk sheet. Usage: node shoot.cjs <outDir> [only,names]
const { chromium } = require('playwright-core')
const path = require('path')
const OUT = process.argv[2]
const ONLY = process.argv[3] ? process.argv[3].split(',') : null
const BASE = 'https://chalukya-ai.vercel.app'
const CLOCK = 't=2026-09-24T10:30'   // competition day, mid-morning: sites open, realistic crowds
const MENTOR = 'I am in Badami. I have 6 hours, ₹3,000 budget, two children, and I like history.'
const NATARAJA = process.env.NATARAJA

const want = (n) => !ONLY || ONLY.includes(n)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function open(page, url, { skipBoot = true, settle = 2200 } = {}) {
  await page.goto(BASE + url + (url.includes('?') ? '&' : '?') + CLOCK, { waitUntil: 'domcontentloaded' })
  if (skipBoot) { await sleep(700); await page.mouse.click(195, 760).catch(() => {}); await sleep(900) }
  await sleep(settle)
}
async function shot(page, name, opts = {}) {
  await page.screenshot({ path: path.join(OUT, name + '.png'), ...opts })
  console.log('saved', name)
}
async function scrollToText(page, text, offset = 90) {
  await page.evaluate(([t, o]) => {
    const el = [...document.querySelectorAll('main *, section *, body *')].find((e) => e.children.length === 0 && e.textContent && e.textContent.includes(t))
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - o)
  }, [text, offset])
  await sleep(700)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-IN',
    geolocation: { latitude: 15.9488, longitude: 75.8164 }, permissions: ['geolocation'],
  })
  await phone.addInitScript(() => { try { if (!location.search.includes('lang=')) localStorage.setItem('chalukya.lang', 'en') } catch {} })
  const page = await phone.newPage()

  if (want('boot') || want('home') || want('home_map')) {
    await open(page, '/', { skipBoot: false, settle: 0 })
    await sleep(1350); if (want('boot')) await shot(page, 'boot')
    await sleep(4800); if (want('home')) await shot(page, 'home')
    if (want('home_map')) {
      await page.evaluate(() => { const s = document.querySelector('section[aria-label]'); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 70) })
      await sleep(2600); await shot(page, 'home_map')
    }
  }
  if (want('ask_plan')) {
    await open(page, '/ask?q=' + encodeURIComponent(MENTOR), { settle: 4500 })
    await scrollToText(page, 'Your 6-hour plan', 150); await shot(page, 'ask_plan')
  }
  if (want('plan')) {
    await open(page, '/plan?q=' + encodeURIComponent('2 days from Bagalkot with my parents, we like temples and food, budget ₹8000'), { settle: 5000 })
    await shot(page, 'plan')
    await page.evaluate(() => window.scrollBy(0, 700)); await sleep(900); await shot(page, 'plan_2')
  }
  if (want('scan_sculpture') && NATARAJA) {
    await open(page, '/scan', { settle: 3500 })
    const inputs = await page.$$('input[type=file]')
    await inputs[inputs.length - 1].setInputFiles(NATARAJA)
    await page.waitForSelector('text=confidence', { timeout: 30000 }).catch(() => console.log('no confidence text'))
    await sleep(1200); await scrollToText(page, 'confidence', 330); await shot(page, 'scan_sculpture')
  }
  if (want('scan_board')) {
    await open(page, '/scan?mode=board', { settle: 2500 })
    await page.click('[aria-label="Sample board: galaganatha"]')
    await page.waitForSelector('text=This board is about', { timeout: 120000 }).catch(() => console.log('board: no result'))
    await sleep(1000); await scrollToText(page, 'This board is about', 380); await shot(page, 'scan_board')
  }
  for (const [name, url, scroll] of [['stay', '/stay', 0], ['food', '/food', 0], ['parking', '/parking', 0], ['safety', '/safety', 0],
    ['local', '/local', 0], ['access', '/access', 0], ['how', '/how', 0], ['place', '/place/pattadakal', 0]]) {
    if (!want(name)) continue
    await open(page, url, { settle: 2600 })
    if (scroll) { await page.evaluate((y) => window.scrollBy(0, y), scroll); await sleep(700) }
    await shot(page, name)
  }
  if (want('place_review')) {
    await open(page, '/place/pattadakal', { settle: 2600 })
    await scrollToText(page, 'Rate your visit', 260); await shot(page, 'place_review')
  }
  if (want('home_kn')) {
    await open(page, '/?lang=kn', { settle: 4200 }); await shot(page, 'home_kn')
  }
  if (want('command') || want('command_insights')) {
    const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: 'en-IN' })
    await desk.addInitScript(() => { try { localStorage.setItem('chalukya.lang', 'en') } catch {} })
    const d = await desk.newPage()
    await open(d, '/command', { settle: 4500 })
    if (want('command')) await shot(d, 'command')
    if (want('command_insights')) { await scrollToText(d, 'What visitors say', 120); await sleep(800); await shot(d, 'command_insights') }
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
