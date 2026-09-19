import { useEffect, useRef, useState } from 'react'
import { AlarmClock, CheckCircle2, Hospital, Loader2, MessageSquareText, Phone, Share2, Siren, ThermometerSun, TriangleAlert, WifiOff } from 'lucide-react'
import { Card, Chip, Eyebrow, PageHead } from '../components/ui'
import { useLang } from '../lib/i18n'
import { publish, onAlert, onDelivery, type Delivery } from '../lib/live'
import { getPosition, zoneAt, ZONES } from '../lib/safety'
import { HOSPITALS, placeById } from '../lib/data'
import { haversineKm, fmtKm, mapsLink } from '../lib/geo'
import { heatAdvice, useWeather } from '../lib/weather'

const TX = {
  title: { en: 'Safety', kn: 'ಸುರಕ್ಷತೆ', hi: 'सुरक्षा' },
  sub: { en: 'Hold the button for two seconds. Your location goes to the district control room.', kn: 'ಬಟನ್ ಅನ್ನು ಎರಡು ಸೆಕೆಂಡ್ ಒತ್ತಿ ಹಿಡಿಯಿರಿ. ನಿಮ್ಮ ಸ್ಥಳ ಜಿಲ್ಲಾ ನಿಯಂತ್ರಣ ಕೊಠಡಿಗೆ ತಲುಪುತ್ತದೆ.', hi: 'बटन को दो सेकंड दबाए रखें। आपकी लोकेशन ज़िला कंट्रोल रूम तक जाती है।' },
  hold: { en: 'Hold for SOS', kn: 'SOS ಗಾಗಿ ಒತ್ತಿ ಹಿಡಿಯಿರಿ', hi: 'SOS के लिए दबाए रखें' },
  sent: { en: 'Help is being alerted', kn: 'ಸಹಾಯಕ್ಕೆ ಮಾಹಿತಿ ಕಳುಹಿಸಲಾಗಿದೆ', hi: 'मदद को सूचित किया जा रहा है' },
  sentSub: { en: 'Stay where you are if it is safe. Keep your phone on.', kn: 'ಸುರಕ್ಷಿತವಾಗಿದ್ದರೆ ಇದ್ದಲ್ಲೇ ಇರಿ. ಫೋನ್ ಆನ್ ಇರಲಿ.', hi: 'सुरक्षित हो तो वहीं रहें। फ़ोन चालू रखें।' },
  acked: { en: 'Control room has seen your alert and is responding.', kn: 'ನಿಯಂತ್ರಣ ಕೊಠಡಿ ನಿಮ್ಮ ಸಂದೇಶ ನೋಡಿ ಸ್ಪಂದಿಸುತ್ತಿದೆ.', hi: 'कंट्रोल रूम ने आपका अलर्ट देख लिया है और मदद भेज रहा है।' },
  cancel: { en: 'I am safe, cancel', kn: 'ನಾನು ಸುರಕ್ಷಿತ, ರದ್ದುಮಾಡಿ', hi: 'मैं सुरक्षित हूँ, रद्द करें' },
  where: { en: 'I am near', kn: 'ನಾನು ಇಲ್ಲಿ ಹತ್ತಿರ ಇದ್ದೇನೆ', hi: 'मैं यहाँ के पास हूँ' },
  checkin: { en: 'Solo or late visit? Set a check-in', kn: 'ಒಬ್ಬರೇ ಅಥವಾ ತಡವಾಗಿ ಭೇಟಿ? ಚೆಕ್-ಇನ್ ಹೊಂದಿಸಿ', hi: 'अकेले या देर से घूम रहे हैं? चेक-इन सेट करें' },
  checkinSub: { en: 'If you do not tap "I am OK" in time, the control room is alerted automatically.', kn: 'ಸಮಯಕ್ಕೆ "ನಾನು ಸರಿಯಾಗಿದ್ದೇನೆ" ಒತ್ತದಿದ್ದರೆ, ನಿಯಂತ್ರಣ ಕೊಠಡಿಗೆ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಎಚ್ಚರಿಕೆ ಹೋಗುತ್ತದೆ.', hi: 'समय पर "मैं ठीक हूँ" न दबाने पर कंट्रोल रूम को अपने आप अलर्ट जाता है।' },
  ok: { en: 'I am OK', kn: 'ನಾನು ಸರಿಯಾಗಿದ್ದೇನೆ', hi: 'मैं ठीक हूँ' },
  zones: { en: 'Take care at these spots', kn: 'ಈ ಸ್ಥಳಗಳಲ್ಲಿ ಎಚ್ಚರ', hi: 'इन जगहों पर सावधान रहें' },
  youAreIn: { en: 'You are in a caution zone', kn: 'ನೀವು ಎಚ್ಚರಿಕೆಯ ವಲಯದಲ್ಲಿದ್ದೀರಿ', hi: 'आप सावधानी क्षेत्र में हैं' },
  share: { en: 'Share my live trip', kn: 'ನನ್ನ ಪ್ರವಾಸ ಹಂಚಿಕೊಳ್ಳಿ', hi: 'मेरी यात्रा साझा करें' },
  hospital: { en: 'Nearest public hospitals', kn: 'ಹತ್ತಿರದ ಸರ್ಕಾರಿ ಆಸ್ಪತ್ರೆಗಳು', hi: 'निकटतम सरकारी अस्पताल' },
  sending: { en: 'Sending to the control room…', kn: 'ನಿಯಂತ್ರಣ ಕೊಠಡಿಗೆ ಕಳುಹಿಸುತ್ತಿದೆ…', hi: 'कंट्रोल रूम को भेजा जा रहा है…' },
  queuedT: { en: 'No signal: your SOS is saved', kn: 'ಸಿಗ್ನಲ್ ಇಲ್ಲ: ನಿಮ್ಮ SOS ಉಳಿಸಲಾಗಿದೆ', hi: 'सिग्नल नहीं: आपका SOS सेव है' },
  queued: { en: 'It reaches the control room as soon as the phone reconnects. Call or text now; both work without internet.', kn: 'ಫೋನ್ ಮತ್ತೆ ಸಂಪರ್ಕಗೊಂಡ ತಕ್ಷಣ ನಿಯಂತ್ರಣ ಕೊಠಡಿಗೆ ತಲುಪುತ್ತದೆ. ಈಗಲೇ ಕರೆ ಅಥವಾ SMS ಮಾಡಿ; ಎರಡೂ ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದೆ ಕೆಲಸ ಮಾಡುತ್ತವೆ.', hi: 'फ़ोन दोबारा जुड़ते ही यह कंट्रोल रूम पहुँच जाएगा। अभी कॉल या SMS करें; दोनों बिना इंटरनेट के चलते हैं।' },
  deviceT: { en: 'Call 112 now', kn: 'ಈಗಲೇ 112 ಗೆ ಕರೆ ಮಾಡಿ', hi: 'अभी 112 पर कॉल करें' },
  device: { en: 'This link is not connected to a district control room. Call 112, and text your location to someone you trust.', kn: 'ಈ ಲಿಂಕ್ ಜಿಲ್ಲಾ ನಿಯಂತ್ರಣ ಕೊಠಡಿಗೆ ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ. 112 ಗೆ ಕರೆ ಮಾಡಿ, ನಂಬಿಕೆಯ ವ್ಯಕ್ತಿಗೆ ನಿಮ್ಮ ಸ್ಥಳ SMS ಮಾಡಿ.', hi: 'यह लिंक ज़िला कंट्रोल रूम से जुड़ा नहीं है। 112 पर कॉल करें, और किसी भरोसेमंद व्यक्ति को अपनी लोकेशन SMS करें।' },
  call112: { en: 'Call 112', kn: '112 ಗೆ ಕರೆ', hi: '112 पर कॉल' },
  textLoc: { en: 'Text my location', kn: 'ಸ್ಥಳ SMS ಮಾಡಿ', hi: 'लोकेशन SMS करें' },
  contact: { en: 'Emergency contact for the SOS text', kn: 'SOS ಸಂದೇಶಕ್ಕೆ ತುರ್ತು ಸಂಪರ್ಕ', hi: 'SOS संदेश के लिए आपातकालीन संपर्क' },
  contactSub: { en: 'Saved only on this phone. The SOS text goes to this number.', kn: 'ಈ ಫೋನ್‌ನಲ್ಲಿ ಮಾತ್ರ ಉಳಿಯುತ್ತದೆ. SOS ಸಂದೇಶ ಈ ಸಂಖ್ಯೆಗೆ ಹೋಗುತ್ತದೆ.', hi: 'सिर्फ़ इसी फ़ोन पर सेव होता है। SOS संदेश इसी नंबर पर जाएगा।' },
  save: { en: 'Save', kn: 'ಉಳಿಸಿ', hi: 'सेव करें' },
  saved: { en: 'Saved', kn: 'ಉಳಿಸಲಾಗಿದೆ', hi: 'सेव हो गया' },
  offline: { en: 'You are offline. SOS still works: call 112 and text your location; the alert reaches the control room when the signal returns.', kn: 'ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ. SOS ಕೆಲಸ ಮಾಡುತ್ತದೆ: 112 ಗೆ ಕರೆ ಮಾಡಿ, ಸ್ಥಳ SMS ಮಾಡಿ; ಸಿಗ್ನಲ್ ಬಂದಾಗ ಎಚ್ಚರಿಕೆ ನಿಯಂತ್ರಣ ಕೊಠಡಿಗೆ ತಲುಪುತ್ತದೆ.', hi: 'आप ऑफ़लाइन हैं। SOS फिर भी काम करता है: 112 पर कॉल करें, लोकेशन SMS करें; सिग्नल लौटते ही अलर्ट कंट्रोल रूम पहुँचेगा।' },
}
const CONTACT_KEY = 'chalukya.sosContact'
const readContact = () => { try { return localStorage.getItem(CONTACT_KEY) || '' } catch { return '' } }
const SITES = ['badami_caves', 'bhutanatha', 'pattadakal', 'aihole', 'banashankari', 'mahakuta', 'kudalasangama']

export default function Safety() {
  const { L, lang } = useLang()
  const w = useWeather()
  const [near, setNear] = useState('badami_caves')
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [holding, setHolding] = useState(0)
  const [sos, setSos] = useState<{ id: string; acked: boolean } | null>(null)
  const [timer, setTimer] = useState<{ until: number; mins: number } | null>(null)
  const [left, setLeft] = useState(0)
  const holdRef = useRef<number | null>(null)
  // every alert's delivery, by id: the report can arrive before this screen re-renders with the new SOS
  const [deliveries, setDeliveries] = useState<Record<string, Delivery>>({})
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [contact, setContact] = useState(readContact)
  const [contactSaved, setContactSaved] = useState(false)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  useEffect(() => onDelivery((id, d) => setDeliveries((m) => ({ ...m, [id]: d }))), [])
  const delivery: Delivery | null = sos ? deliveries[sos.id] ?? null : null

  // asked on open, not on the first press: a permission prompt mid-hold could cancel the SOS
  useEffect(() => { getPosition().then((p) => p && setGps(p)) }, [])
  useEffect(() => onAlert((a) => { if (sos && a.id === sos.id && a.ack) setSos({ ...sos, acked: true }) }), [sos])
  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => {
      const l = Math.round((timer.until - Date.now()) / 1000); setLeft(l)
      if (l <= 0) { clearInterval(id); raise('checkin'); setTimer(null) }
    }, 1000)
    return () => clearInterval(id)
  }, [timer]) // eslint-disable-line react-hooks/exhaustive-deps

  const ref = gps ?? placeById[near]
  const zone = gps ? zoneAt(gps.lat, gps.lng) : null
  const hospitals = [...HOSPITALS].sort((a, b) => haversineKm(ref, a) - haversineKm(ref, b)).slice(0, 2)
  const adv = w ? heatAdvice(w.feelsC) : null

  function raise(type: 'sos' | 'checkin') {
    const pos = gps ?? { lat: placeById[near].lat, lng: placeById[near].lng }
    const a = publish({
      type, severity: 'critical', source: 'tourist', lat: pos.lat, lng: pos.lng, place: near,
      title: type === 'sos' ? `SOS near ${placeById[near].name.en}` : `Missed check-in near ${placeById[near].name.en}`,
      detail: `${gps ? 'GPS' : 'Selected place'} · language: ${lang}${w ? ` · feels ${w.feelsC}°C` : ''}`,
    })
    if (type === 'sos') setSos({ id: a.id, acked: false })
  }
  function smsHref() {
    const pos = gps ?? { lat: placeById[near].lat, lng: placeById[near].lng }
    const body = `SOS! I need help near ${placeById[near].name.en.split(':')[0]}. My location: https://maps.google.com/?q=${pos.lat.toFixed(5)},${pos.lng.toFixed(5)} (sent from Chalukya AI)`
    const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'
    return `sms:${contact.replace(/[^\d+]/g, '')}${sep}body=${encodeURIComponent(body)}`
  }
  function startHold() {
    const t0 = Date.now()
    holdRef.current = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 1800); setHolding(p)
      if (p >= 1) { stopHold(); navigator.vibrate?.(200); raise('sos') }
    }, 40)
  }
  function stopHold() { if (holdRef.current) clearInterval(holdRef.current); holdRef.current = null; setHolding(0) }

  return (
    <div>
      <PageHead title={L(TX.title)} sub={L(TX.sub)} />
      <div className="space-y-4 px-4">
        {!online && (
          <Card className="flex gap-3 border border-lamp/50 bg-lamp-soft p-4"><WifiOff className="shrink-0 text-[#8a6412]" /><p className="text-[14px] text-ink">{L(TX.offline)}</p></Card>
        )}
        {zone && (
          <Card className="flex gap-3 border border-sand/40 bg-sand-soft p-4 text-sand"><TriangleAlert className="shrink-0" /><div><b>{L(TX.youAreIn)}</b><p className="text-[14px] text-ink">{zone[lang]}</p></div></Card>
        )}

        {!sos ? (
          <Card className="p-5 text-center">
            <button onPointerDown={startHold} onPointerUp={stopHold} onPointerLeave={stopHold} onContextMenu={(e) => e.preventDefault()}
              className="relative mx-auto grid h-44 w-44 select-none place-items-center rounded-full bg-sos text-white shadow-[0_14px_40px_-12px_rgba(215,38,61,0.9)] active:scale-[0.98]">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={4} /><circle cx="50" cy="50" r="47" fill="none" stroke="#fff" strokeWidth={4} strokeDasharray={`${holding * 295} 300`} strokeLinecap="round" /></svg>
              <span className="flex flex-col items-center"><Siren size={40} /><span className="mt-1 text-[26px] font-black tracking-wider">SOS</span><span className="text-[12px] text-white/85">{L(TX.hold)}</span></span>
            </button>
            <div className="mt-4 text-left">
              <Eyebrow>{L(TX.where)} {gps && <span className="ml-1 normal-case text-lake">· GPS on</span>}</Eyebrow>
              <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">{SITES.map((id) => <Chip key={id} active={near === id} onClick={() => setNear(id)}>{L(placeById[id].name).split(':')[0]}</Chip>)}</div>
            </div>
          </Card>
        ) : (
          <Card className={`rise p-5 ${sos.acked ? 'bg-lake text-white' : 'bg-sos text-white'}`}>
            <div className="flex items-center gap-3">
              {sos.acked ? <CheckCircle2 size={34} /> : delivery === null ? <Loader2 size={30} className="animate-spin" /> : <Siren size={34} className="animate-pulse" />}
              <div className="text-[20px] font-bold leading-tight">{sos.acked ? L(TX.acked) : delivery === 'server' ? L(TX.sent) : delivery === 'queued' ? L(TX.queuedT) : delivery === 'device' ? L(TX.deviceT) : L(TX.sending)}</div>
            </div>
            <p className="mt-2 text-[14.5px] text-white/90">{delivery === 'queued' && !sos.acked ? L(TX.queued) : delivery === 'device' && !sos.acked ? L(TX.device) : L(TX.sentSub)}</p>
            {!sos.acked && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a href="tel:112" className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-[15px] font-bold text-sos"><Phone size={17} />{L(TX.call112)}</a>
                <a href={smsHref()} className="flex items-center justify-center gap-2 rounded-xl bg-white/20 py-3 text-[15px] font-bold text-white"><MessageSquareText size={17} />{L(TX.textLoc)}</a>
              </div>
            )}
            <button onClick={() => { publish({ id: sos.id, type: 'sos', severity: 'info', source: 'tourist', title: 'SOS cancelled by tourist', ack: true } as any); setSos(null) }} className="mt-3 rounded-full bg-white/20 px-4 py-2 text-[14px] font-semibold">{L(TX.cancel)}</button>
          </Card>
        )}

        <Card className="p-4">
          <div className="text-[14.5px] font-semibold">{L(TX.contact)}</div>
          <p className="mt-0.5 text-[12.5px] text-ink-3">{L(TX.contactSub)}</p>
          <form className="mt-2.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); try { localStorage.setItem(CONTACT_KEY, contact.trim()) } catch { /* storage off */ } setContactSaved(true); setTimeout(() => setContactSaved(false), 2000) }}>
            <input type="tel" inputMode="tel" autoComplete="tel" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+91 98xxxxxxxx" aria-label={L(TX.contact)}
              className="num min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2.5 text-[15px] outline-none focus:border-lake" />
            <button className="rounded-xl bg-lake px-4 text-[14px] font-semibold text-white">{contactSaved ? L(TX.saved) : L(TX.save)}</button>
          </form>
        </Card>

        <div className="grid grid-cols-4 gap-2">
          {[['112', 'Emergency'], ['108', 'Ambulance'], ['1091', 'Women'], ['1363', 'Tourist']].map(([n, l]) => (
            <a key={n} href={`tel:${n}`} className="card flex flex-col items-center py-3"><Phone size={16} className="text-sos" /><b className="num mt-1 text-[19px]">{n}</b><span className="text-[11px] text-ink-3">{l}</span></a>
          ))}
        </div>
        <a href="tel:+918354235709" className="card flex items-center gap-3 px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lake-soft"><Phone size={16} className="text-lake" /></span>
          <span className="min-w-0 flex-1">
            <b className="block text-[14.5px]">{lang === 'kn' ? 'ಜಿಲ್ಲಾ ಪ್ರವಾಸೋದ್ಯಮ ಕಚೇರಿ' : lang === 'hi' ? 'ज़िला पर्यटन कार्यालय' : 'District Tourism Office'}</b>
            <span className="block truncate text-[12px] text-ink-3">{lang === 'kn' ? 'ಜಿಲ್ಲಾಧಿಕಾರಿಗಳ ಕಚೇರಿ, ನವನಗರ, ಬಾಗಲಕೋಟೆ' : lang === 'hi' ? 'ज़िलाधिकारी कार्यालय, नवनगर, बागलकोट' : 'DC Office, Navanagar, Bagalkote'}</span>
          </span>
          <b className="num text-[14.5px] text-lake">08354 235709</b>
        </a>

        {adv && (
          <Card className={`flex gap-3 p-4 ${adv.level === 'hot' || adv.level === 'extreme' ? 'bg-sand-soft' : ''}`}>
            <ThermometerSun className={adv.level === 'hot' || adv.level === 'extreme' ? 'text-sand' : 'text-lake'} />
            <div><div className="num text-[15px] font-bold">{w!.tempC}°C · feels {w!.feelsC}°C {!w!.live && <span className="font-normal text-ink-3">(typical)</span>}</div><p className="text-[14px] text-ink-2">{adv[lang]}</p></div>
          </Card>
        )}

        <Card className="p-4">
          <div className="flex items-center gap-2"><AlarmClock size={18} className="text-lake" /><div className="text-[15.5px] font-semibold">{L(TX.checkin)}</div></div>
          <p className="mt-1 text-[13.5px] text-ink-2">{L(TX.checkinSub)}</p>
          {!timer ? (
            <div className="mt-3 flex flex-wrap gap-2">{[1, 30, 60, 90].map((m) => <Chip key={m} onClick={() => setTimer({ until: Date.now() + m * 60_000, mins: m })}>{m === 1 ? '1 min (demo)' : `${m} min`}</Chip>)}</div>
          ) : (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-lake-soft/60 px-3 py-2">
              <span className="num text-[22px] font-bold text-lake">{Math.floor(Math.max(0, left) / 60)}:{String(Math.max(0, left) % 60).padStart(2, '0')}</span>
              <button onClick={() => setTimer(null)} className="rounded-full bg-lake px-4 py-2 text-[14px] font-semibold text-white">{L(TX.ok)}</button>
            </div>
          )}
          <button onClick={() => { const p = gps ?? placeById[near]; const text = `I'm visiting ${placeById[near].name.en}. My location: ${mapsLink(p.lat, p.lng)}`; if (navigator.share) navigator.share({ title: 'My trip', text }).catch(() => {}); else navigator.clipboard?.writeText(text) }}
            className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-lake"><Share2 size={15} />{L(TX.share)}</button>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2"><Hospital size={18} className="text-sos" /><Eyebrow>{L(TX.hospital)}</Eyebrow></div>
          <ul className="mt-2 divide-y divide-line">{hospitals.map((h) => (
            <li key={h.name} className="flex items-center justify-between py-2 text-[14.5px]"><span>{h.name}</span><a className="num font-semibold text-lake" href={mapsLink(h.lat, h.lng)} target="_blank" rel="noreferrer">{fmtKm(haversineKm(ref, h) * 1.3)} →</a></li>
          ))}</ul>
          <p className="mt-1 text-[11.5px] text-ink-3">From OpenStreetMap.</p>
        </Card>

        <Card className="p-4">
          <Eyebrow>{L(TX.zones)}</Eyebrow>
          <ul className="mt-2 space-y-2">{ZONES.map((z) => <li key={z.id} className="flex gap-2 text-[14px]"><TriangleAlert size={16} className="mt-0.5 shrink-0 text-sand" />{z[lang]}</li>)}</ul>
          <p className="mt-2 text-[11.5px] text-ink-3">Zones are approximate for this prototype; the app warns you automatically when GPS shows you inside one.</p>
        </Card>
      </div>
    </div>
  )
}
