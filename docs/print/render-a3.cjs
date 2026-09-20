// Renders the A3 landscape desk sheet (420×297 mm) and reports how full each half is.
const { chromium } = require('playwright-core')
const [src, pdf, png] = process.argv.slice(2)
;(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  const p = await b.newPage({ viewport: { width: 1587, height: 1123 }, deviceScaleFactor: 2 })
  await p.goto('file:///' + src, { waitUntil: 'networkidle' })
  await p.evaluate(() => document.fonts.ready)
  console.log(JSON.stringify(await p.evaluate(() => {
    const out = { page: document.documentElement.scrollHeight, panels: [] }
    document.querySelectorAll('.panel').forEach((el) => {
      const last = [...el.children].filter((c) => c.getBoundingClientRect().height).pop()
      const r = el.getBoundingClientRect(), l = last.getBoundingClientRect()
      out.panels.push({ free: Math.round(r.bottom - l.bottom), wide: Math.round(el.scrollWidth - el.clientWidth) })
    })
    return out
  })))
  await p.pdf({ path: pdf, width: '420mm', height: '297mm', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1' })
  await p.screenshot({ path: png, fullPage: false })
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })
