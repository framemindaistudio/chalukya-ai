import * as ort from 'onnxruntime-web/wasm'

/*
  On-device sculpture recognition. The EfficientNet-B0 trained in ml/vision (transfer learning,
  photographer-held-out evaluation) is exported to ONNX and runs here with WebAssembly, so it
  works inside the caves with no network. Open-set rule: if the top probability or the margin
  over the runner-up is below the calibrated threshold, we say "not sure" and show candidates
  instead of guessing.
*/
ort.env.wasm.wasmPaths = { wasm: '/ort/ort-wasm-simd-threaded.wasm' }
ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2)

let session: ort.InferenceSession | null = null
let labels: string[] = []
let calib = { min_prob: 0.45, min_margin: 0.15 }
let loading: Promise<void> | null = null

export function loadVision(onProgress?: (msg: string) => void) {
  loading ??= (async () => {
    onProgress?.('model')
    const [l, c] = await Promise.all([
      fetch('/models/sculpture_labels.json').then((r) => r.json()),
      fetch('/models/sculpture_calibration.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
    labels = l; if (c) calib = { ...calib, ...c }
    session = await ort.InferenceSession.create('/models/sculpture.onnx', { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
  })()
  return loading
}

const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225], SIZE = 224

/** Resize shorter side to 256, centre-crop 224, normalise: the same transform used in testing. */
function toTensor(img: CanvasImageSource & { width: number; height: number }) {
  const s = 256 / Math.min(img.width, img.height)
  const w = Math.round(img.width * s), h = Math.round(img.height * s)
  const c = document.createElement('canvas'); c.width = SIZE; c.height = SIZE
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h)
  const d = g.getImageData(0, 0, SIZE, SIZE).data
  const f = new Float32Array(3 * SIZE * SIZE)
  for (let i = 0; i < SIZE * SIZE; i++) for (let ch = 0; ch < 3; ch++) f[ch * SIZE * SIZE + i] = (d[i * 4 + ch] / 255 - MEAN[ch]) / STD[ch]
  return new ort.Tensor('float32', f, [1, 3, SIZE, SIZE])
}

export type Prediction = { id: string; p: number }
export type VisionResult = { top: Prediction[]; confident: boolean; ms: number }

export async function classify(img: HTMLImageElement | HTMLCanvasElement | ImageBitmap): Promise<VisionResult> {
  await loadVision()
  const t0 = performance.now()
  const probs = async (src: typeof img) => (await session!.run({ image: toTensor(src as any) })).probs.data as Float32Array
  const a = await probs(img)
  // test-time augmentation: average with the mirrored image (as in evaluation)
  const m = document.createElement('canvas'); m.width = (img as any).width; m.height = (img as any).height
  const mg = m.getContext('2d')!; mg.translate(m.width, 0); mg.scale(-1, 1); mg.drawImage(img as any, 0, 0)
  const b = await probs(m)
  const p = Array.from(a, (x, i) => (x + b[i]) / 2)
  const top = p.map((v, i) => ({ id: labels[i], p: v })).sort((x, y) => y.p - x.p).slice(0, 3)
  const confident = top[0].p >= calib.min_prob && top[0].p - (top[1]?.p ?? 0) >= calib.min_margin
  return { top, confident, ms: Math.round(performance.now() - t0) }
}

/** One pass, no mirrored copy: fast enough for live camera frames (the lens smooths over time instead). */
export async function classifyFrame(src: HTMLCanvasElement): Promise<Float32Array> {
  await loadVision()
  return (await session!.run({ image: toTensor(src) })).probs.data as Float32Array
}
export const visionLabels = () => labels
export const visionCalibration = () => calib

export function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => res(im); im.onerror = rej; im.src = url
  })
}
