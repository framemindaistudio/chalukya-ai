import { useRef, useState } from 'react'
import { Camera, CheckCircle2, ImagePlus, Loader2, ScanLine, Send, TriangleAlert } from 'lucide-react'
import { Card, Chip, DemoTag, Eyebrow, PageHead, V1Tag } from '../components/ui'
import { useLang } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { placeById } from '../lib/data'
import { publish } from '../lib/live'
import { getPosition } from '../lib/safety'
import { analyzeReview, ASPECT_LABEL } from '../lib/reviews'
import { checkStone, drawToCanvas, type StoneFinding } from '../lib/stone'

/*
  Report to the district (v1): a visitor photographs a crack, litter, a dry water point or a broken path.
  For a crack, the phone marks crack-like lines in the photo (lib/stone.ts, image processing, no model) and
  the note is read by the complaint-topic model. Everything lands on the command centre by site and topic.
*/
const T = {
  title: { en: 'Report to the district', kn: 'ಜಿಲ್ಲೆಗೆ ವರದಿ ಮಾಡಿ', hi: 'ज़िले को रिपोर्ट करें' },
  sub: { en: 'A crack, litter, a dry water point, a broken path: photograph it and the district tourism office sees it.', kn: 'ಬಿರುಕು, ಕಸ, ನೀರಿಲ್ಲದ ನಲ್ಲಿ, ಹಾಳಾದ ದಾರಿ: ಫೋಟೋ ತೆಗೆದರೆ ಜಿಲ್ಲಾ ಪ್ರವಾಸೋದ್ಯಮ ಕಚೇರಿಗೆ ತಲುಪುತ್ತದೆ.', hi: 'दरार, कचरा, सूखा पानी का नल, टूटा रास्ता: फ़ोटो लीजिए, ज़िला पर्यटन कार्यालय तक पहुँचती है।' },
  what: { en: 'What are you reporting?', kn: 'ಏನು ವರದಿ ಮಾಡುತ್ತಿದ್ದೀರಿ?', hi: 'आप क्या रिपोर्ट कर रहे हैं?' },
  where: { en: 'Where', kn: 'ಎಲ್ಲಿ', hi: 'कहाँ' },
  photo: { en: 'Photo', kn: 'ಫೋಟೋ', hi: 'फ़ोटो' },
  take: { en: 'Take photo', kn: 'ಫೋಟೋ ತೆಗೆಯಿರಿ', hi: 'फ़ोटो लें' },
  pick: { en: 'Choose photo', kn: 'ಫೋಟೋ ಆರಿಸಿ', hi: 'फ़ोटो चुनें' },
  scan: { en: 'Check the stone', kn: 'ಕಲ್ಲನ್ನು ಪರೀಕ್ಷಿಸಿ', hi: 'पत्थर जाँचें' },
  scanning: { en: 'Checking…', kn: 'ಪರಿಶೀಲನೆ…', hi: 'जाँच हो रही है…' },
  note: { en: 'Anything to add? (optional)', kn: 'ಇನ್ನೇನಾದರೂ? (ಐಚ್ಛಿಕ)', hi: 'कुछ और? (वैकल्पिक)' },
  send: { en: 'Send to the district', kn: 'ಜಿಲ್ಲೆಗೆ ಕಳುಹಿಸಿ', hi: 'ज़िले को भेजें' },
  sending: { en: 'Sending…', kn: 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…', hi: 'भेजा जा रहा है…' },
  sent: { en: 'Sent. Thank you.', kn: 'ಕಳುಹಿಸಲಾಗಿದೆ. ಧನ್ಯವಾದಗಳು.', hi: 'भेज दिया गया। धन्यवाद।' },
  sentSub: { en: 'It is on the district command centre now, with the site and the topic. Reports without signal are sent when the phone reconnects.', kn: 'ತಾಣ ಮತ್ತು ವಿಷಯದೊಂದಿಗೆ ಈಗ ಜಿಲ್ಲಾ ಕಮಾಂಡ್ ಸೆಂಟರ್‌ನಲ್ಲಿದೆ. ಸಿಗ್ನಲ್ ಇಲ್ಲದಿದ್ದರೆ ಫೋನ್ ಮರುಸಂಪರ್ಕವಾದಾಗ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.', hi: 'स्थल और विषय के साथ यह अब ज़िला कमांड सेंटर पर है। सिग्नल न हो तो फ़ोन जुड़ते ही भेज दी जाती है।' },
  found: { en: 'Crack-like marks found', kn: 'ಬಿರುಕಿನಂತಹ ಗುರುತುಗಳು', hi: 'दरार जैसे निशान' },
  longest: { en: 'longest mark', kn: 'ಉದ್ದದ ಗುರುತು', hi: 'सबसे लंबा निशान' },
  ofWidth: { en: 'of the photo width', kn: 'ಫೋಟೋ ಅಗಲದಷ್ಟು', hi: 'फ़ोटो की चौड़ाई का' },
  clear: { en: 'Nothing crack-like in this photo.', kn: 'ಈ ಫೋಟೋದಲ್ಲಿ ಬಿರುಕಿನಂತಹದ್ದು ಕಾಣಲಿಲ್ಲ.', hi: 'इस फ़ोटो में दरार जैसा कुछ नहीं मिला।' },
  watch: { en: 'Worth a look by the site staff.', kn: 'ತಾಣದ ಸಿಬ್ಬಂದಿ ಒಮ್ಮೆ ನೋಡುವುದು ಒಳಿತು.', hi: 'स्थल कर्मचारी एक बार देखें।' },
  check: { en: 'Please have ASI or the district inspect this.', kn: 'ASI ಅಥವಾ ಜಿಲ್ಲೆಯಿಂದ ಪರಿಶೀಲನೆ ಅಗತ್ಯ.', hi: 'ASI या ज़िला इसकी जाँच करे।' },
  how: { en: 'On the phone, with no network: the marks are found by comparing each spot with the stone around it. It suggests what to inspect; it does not decide that something is damage.', kn: 'ನೆಟ್‌ವರ್ಕ್ ಇಲ್ಲದೆ ಫೋನ್‌ನಲ್ಲೇ: ಪ್ರತಿ ಜಾಗವನ್ನು ಸುತ್ತಲಿನ ಕಲ್ಲಿನೊಂದಿಗೆ ಹೋಲಿಸಿ ಗುರುತಿಸುತ್ತದೆ. ಇದು ಪರಿಶೀಲನೆಗೆ ಸೂಚನೆ ಮಾತ್ರ, ಹಾನಿ ಎಂದು ತೀರ್ಮಾನಿಸುವುದಿಲ್ಲ.', hi: 'बिना नेटवर्क, फ़ोन पर ही: हर जगह की तुलना आसपास के पत्थर से करके निशान मिलते हैं। यह जाँच का सुझाव है, नुकसान का फ़ैसला नहीं।' },
  understood: { en: 'The AI understood', kn: 'AI ಅರ್ಥ ಮಾಡಿಕೊಂಡದ್ದು', hi: 'AI ने समझा' },
  next: { en: 'Report something else', kn: 'ಇನ್ನೊಂದು ವರದಿ ಮಾಡಿ', hi: 'कुछ और रिपोर्ट करें' },
  v2: { en: 'Version 2: a model trained on labelled monument photographs, and automatic litter and vegetation checks from site cameras.', kn: 'ಆವೃತ್ತಿ 2: ಗುರುತಿಸಲಾದ ಸ್ಮಾರಕ ಫೋಟೋಗಳ ಮೇಲೆ ತರಬೇತಾದ ಮಾದರಿ, ಮತ್ತು ತಾಣದ ಕ್ಯಾಮೆರಾಗಳಿಂದ ಕಸ ಹಾಗೂ ಹಸಿರು ಹೊದಿಕೆ ಪರಿಶೀಲನೆ.', hi: 'संस्करण 2: चिह्नित स्मारक फ़ोटो पर प्रशिक्षित मॉडल, और साइट कैमरों से कचरा तथा हरियाली की स्वतः जाँच।' },
}
const KINDS = [
  { id: 'crack', en: 'Crack or erosion', kn: 'ಬಿರುಕು / ಸವೆತ', hi: 'दरार / कटाव' },
  { id: 'litter', en: 'Litter', kn: 'ಕಸ', hi: 'कचरा' },
  { id: 'water', en: 'Water point', kn: 'ನೀರಿನ ನಲ್ಲಿ', hi: 'पानी का नल' },
  { id: 'toilet', en: 'Toilet', kn: 'ಶೌಚಾಲಯ', hi: 'शौचालय' },
  { id: 'path', en: 'Path or steps', kn: 'ದಾರಿ / ಮೆಟ್ಟಿಲು', hi: 'रास्ता / सीढ़ियाँ' },
  { id: 'vegetation', en: 'Vegetation', kn: 'ಗಿಡಗಂಟಿ', hi: 'वनस्पति' },
] as const
const SITES = ['badami_caves', 'bhutanatha', 'pattadakal', 'aihole', 'banashankari', 'mahakuta', 'kudalasangama']
const LEVEL_COLOR = { clear: '#1f8f4e', watch: '#b07a12', check: '#c0562f' } as const

export default function Report() {
  const { L, lang } = useLang()
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('crack')
  const [site, setSite] = useState(SITES[0])
  const [img, setImg] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'scan' | 'send' | null>(null)
  const [find, setFind] = useState<StoneFinding | null>(null)
  const [sent, setSent] = useState<{ aspects: string[] } | null>(null)
  const cam = useRef<HTMLInputElement>(null), gal = useRef<HTMLInputElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null), sentRef = useRef<HTMLDivElement>(null)
  useReveal(sentRef, sent)

  function onFile(f?: File) {
    if (!f) return
    setFind(null); setSent(null)
    const url = URL.createObjectURL(f)
    setImg(url)
    const im = new Image()
    im.onload = () => { if (canvas.current) drawToCanvas(im, canvas.current) }
    im.src = url
  }
  async function scan() {
    const ctx = canvas.current?.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    setBusy('scan')
    await new Promise((r) => setTimeout(r, 30))
    setFind(checkStone(ctx))
    setBusy(null)
  }
  async function send() {
    setBusy('send')
    const k = KINDS.find((x) => x.id === kind)!
    const [pos, review] = await Promise.all([getPosition(), note.trim() ? analyzeReview(note) : Promise.resolve(null)])
    const place = placeById[site]?.name.en ?? site
    publish({
      type: 'anomaly', severity: find?.level === 'check' ? 'warn' : 'info', source: 'tourist', place: site,
      lat: pos?.lat ?? placeById[site]?.lat, lng: pos?.lng ?? placeById[site]?.lng,
      title: `Visitor report · ${k.en} at ${place}`,
      detail: [note.trim(), find ? `${find.count} crack-like marks, longest ${find.longestPct}% of the photo width` : '', `language: ${lang}`].filter(Boolean).join(' · '),
      data: { kind, site, stone: find ?? undefined, aspects: review?.aspects ?? [] },
    })
    setSent({ aspects: review?.aspects ?? [] })
    setBusy(null)
  }

  return (
    <div>
      <PageHead title={L(T.title)} sub={L(T.sub)} />
      <div className="space-y-4 px-4">
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={gal} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

        <Card className="p-4">
          <div className="flex items-center justify-between gap-2"><Eyebrow>{L(T.what)}</Eyebrow><V1Tag /></div>
          <div className="mt-2 flex flex-wrap gap-2">
            {KINDS.map((k) => <Chip key={k.id} active={kind === k.id} onClick={() => { setKind(k.id); setFind(null) }}>{k[lang]}</Chip>)}
          </div>
          <div className="mt-4"><Eyebrow>{L(T.where)}</Eyebrow>
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {SITES.map((id) => <Chip key={id} active={site === id} onClick={() => setSite(id)}>{L(placeById[id].name).split(':')[0]}</Chip>)}
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3] w-full bg-night">
            <canvas ref={canvas} className={`h-full w-full object-contain ${img ? '' : 'hidden'}`} />
            {!img && <div className="grid h-full place-items-center text-[14px] text-white/60">{L(T.photo)}</div>}
            {busy === 'scan' && <div className="absolute inset-0 grid place-items-center bg-night/55 text-white"><span className="flex items-center gap-2 text-[15px] font-semibold"><Loader2 className="animate-spin" size={18} />{L(T.scanning)}</span></div>}
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <button onClick={() => cam.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-lake py-3 text-[15px] font-semibold text-white"><Camera size={18} />{L(T.take)}</button>
            <button onClick={() => gal.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-line py-3 text-[15px] font-semibold text-ink"><ImagePlus size={18} />{L(T.pick)}</button>
          </div>
          {kind === 'crack' && img && (
            <div className="border-t border-line p-3">
              <button onClick={scan} disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-[15px] font-semibold text-white disabled:opacity-60"><ScanLine size={18} />{L(T.scan)}</button>
              {find && (
                <div className="rise mt-3 rounded-xl bg-mist p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <b className="text-[15px]" style={{ color: LEVEL_COLOR[find.level] }}>{find.level === 'clear' ? L(T.clear) : find.level === 'watch' ? L(T.watch) : L(T.check)}</b>
                    <span className="num text-[12px] text-ink-3">{find.ms} ms</span>
                  </div>
                  {find.count > 0 && (
                    <p className="num mt-1 text-[14px] text-ink-2">{L(T.found)}: <b className="text-ink">{find.count}</b> · {L(T.longest)} <b className="text-ink">{find.longestPct}%</b> {L(T.ofWidth)}</p>
                  )}
                  <p className="mt-2 text-[12.5px] leading-snug text-ink-3">{L(T.how)}</p>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <Eyebrow>{L(T.note)}</Eyebrow>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="mt-2 w-full resize-none rounded-xl border border-line bg-paper p-3 text-[15px] outline-none focus:border-lake" />
          <button onClick={send} disabled={!!busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-sand py-3.5 text-[16px] font-semibold text-white disabled:opacity-60">
            {busy === 'send' ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}{busy === 'send' ? L(T.sending) : L(T.send)}
          </button>
        </Card>

        {sent && (
          <Card ref={sentRef} className="rise border border-lake/40 bg-lake-soft/50 p-4">
            <div className="flex items-center gap-2 text-lake"><CheckCircle2 size={20} /><b className="text-[16px]">{L(T.sent)}</b></div>
            <p className="mt-1 text-[14px] text-ink-2">{L(T.sentSub)}</p>
            {sent.aspects.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] font-semibold text-ink-3">{L(T.understood)}:</span>
                {sent.aspects.map((a) => <span key={a} className="rounded-full bg-paper px-2.5 py-0.5 text-[12.5px] font-medium ring-1 ring-line">{L(ASPECT_LABEL[a])}</span>)}
              </div>
            )}
            <button onClick={() => { setSent(null); setImg(null); setFind(null); setNote('') }} className="mt-3 rounded-full border border-lake px-4 py-2 text-[14px] font-semibold text-lake">{L(T.next)}</button>
          </Card>
        )}

        <Card className="flex gap-3 p-4">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-[#b07a12]" />
          <p className="text-[13px] leading-snug text-ink-2">{L(T.v2)} <DemoTag className="ml-1 align-middle" /></p>
        </Card>
      </div>
    </div>
  )
}
