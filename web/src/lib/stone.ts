/*
  Stone check (v1): finds crack-like and erosion-like marks in a photo of a monument surface, on the phone.

  This is classical image processing, not a trained model: a crack is darker than the stone around it, so we
  compare every pixel with its local average (a dark-ridge filter), keep the long thin runs, and draw them for
  a human to judge. It flags candidates for the district and ASI to inspect; it never decides that something is
  damage. A model trained on labelled monument photographs is version 2.
*/
export type StoneFinding = { count: number; longestPct: number; coveragePct: number; level: 'clear' | 'watch' | 'check'; ms: number }

const MAX_W = 720
const RADIUS = 7        // how far around a pixel "local stone colour" is measured
const MIN_PIXELS = 40   // ignore specks
const MIN_LONG = 3      // a crack is long and thin: bounding box at least 3× longer than wide

/** Scales the photo into `canvas` and returns its greyscale pixels. */
export function drawToCanvas(img: HTMLImageElement, canvas: HTMLCanvasElement) {
  const w = Math.min(MAX_W, img.naturalWidth || img.width)
  const h = Math.round(((img.naturalHeight || img.height) * w) / (img.naturalWidth || img.width))
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  return ctx
}

function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    let sum = 0
    for (let x = -r; x <= r; x++) sum += src[y * w + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / (2 * r + 1)
      sum += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.min(w - 1, Math.max(0, x - r))]
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / (2 * r + 1)
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.min(h - 1, Math.max(0, y - r)) * w + x]
    }
  }
  return out
}

/** Marks crack-like runs on the canvas in amber and reports what it found. */
export function checkStone(ctx: CanvasRenderingContext2D): StoneFinding {
  const t0 = performance.now()
  const { width: w, height: h } = ctx.canvas
  const img = ctx.getImageData(0, 0, w, h), px = img.data
  const grey = new Float32Array(w * h)
  for (let i = 0, p = 0; i < px.length; i += 4, p++) grey[p] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]

  const smooth = boxBlur(grey, w, h, 1)
  const local = boxBlur(smooth, w, h, RADIUS)
  const ridge = new Float32Array(w * h)
  let sum = 0, n = 0
  for (let p = 0; p < ridge.length; p++) {
    const v = local[p] - smooth[p]          // darker than its surroundings
    ridge[p] = v > 0 ? v : 0
    if (v > 0) { sum += v; n++ }
  }
  const mean = n ? sum / n : 0
  let varSum = 0
  for (let p = 0; p < ridge.length; p++) if (ridge[p] > 0) varSum += (ridge[p] - mean) ** 2
  const sd = n ? Math.sqrt(varSum / n) : 0
  const thr = Math.max(7, mean + 2.2 * sd)

  const mask = new Uint8Array(w * h)
  for (let p = 0; p < mask.length; p++) if (ridge[p] > thr) mask[p] = 1

  // keep the long thin groups; they are what a crack or a mortar loss looks like
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h)
  const keep = new Uint8Array(w * h)
  let count = 0, longest = 0, kept = 0
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p] || seen[p]) continue
    let top = 0, size = 0
    stack[top++] = p; seen[p] = 1
    let x0 = p % w, x1 = x0, y0 = (p / w) | 0, y1 = y0
    const group: number[] = []
    while (top) {
      const q = stack[--top], qx = q % w, qy = (q / w) | 0
      group.push(q); size++
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx
      if (qy < y0) y0 = qy; if (qy > y1) y1 = qy
      if (qx > 0 && mask[q - 1] && !seen[q - 1]) { seen[q - 1] = 1; stack[top++] = q - 1 }
      if (qx < w - 1 && mask[q + 1] && !seen[q + 1]) { seen[q + 1] = 1; stack[top++] = q + 1 }
      if (qy > 0 && mask[q - w] && !seen[q - w]) { seen[q - w] = 1; stack[top++] = q - w }
      if (qy < h - 1 && mask[q + w] && !seen[q + w]) { seen[q + w] = 1; stack[top++] = q + w }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1
    const long = Math.max(bw, bh), thin = Math.max(1, Math.min(bw, bh))
    if (size < MIN_PIXELS || long / thin < MIN_LONG) continue
    count++; kept += size
    if (long > longest) longest = long
    for (const q of group) keep[q] = 1
  }

  for (let p = 0, i = 0; p < keep.length; p++, i += 4) {
    if (!keep[p]) continue
    px[i] = 243; px[i + 1] = 197; px[i + 2] = 107; px[i + 3] = 255   // the app's gold
  }
  ctx.putImageData(img, 0, 0)

  const longestPct = Math.round((longest / w) * 1000) / 10
  const coveragePct = Math.round((kept / (w * h)) * 1000) / 10
  const level: StoneFinding['level'] = count === 0 ? 'clear' : count >= 3 || longestPct >= 25 ? 'check' : 'watch'
  return { count, longestPct, coveragePct, level, ms: Math.round(performance.now() - t0) }
}
