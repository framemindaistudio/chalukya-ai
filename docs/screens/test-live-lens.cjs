const { chromium } = require('playwright-core')
const [base, feed, out] = process.argv.slice(2), sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${feed}`] })
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera'] })
  await c.addInitScript(() => { try { localStorage.setItem('chalukya.lang', 'en') } catch {} })
  const p = await c.newPage()
  p.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 200)) })
  await p.goto(base + '/scan?mode=live', { waitUntil: 'domcontentloaded' })
  await sleep(700); await p.mouse.click(195, 760); await sleep(1500)
  await p.click('text=Start the live lens')
  for (let i = 0; i < 10; i++) {
    await sleep(1500)
    const t = await p.evaluate(() => { const card = document.querySelector('.lens-callout.inset-x-3'); const pill = [...document.querySelectorAll('span')].find((s) => /Point at|Hold steady/.test(s.textContent || '')); const ms = [...document.querySelectorAll('.num')].map((e) => e.textContent).find((x) => /ms/.test(x || '')); return (card ? 'CALLOUT: ' + card.innerText.replace(/\n/g, ' | ').slice(0, 160) : 'status: ' + (pill?.textContent || '?')) + ' · ' + ms })
    console.log(((i + 1) * 1.5).toFixed(1) + 's', t)
    if (t.startsWith('CALLOUT') && i >= 3) break
  }
  await p.screenshot({ path: out }); console.log('saved', out)
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })
