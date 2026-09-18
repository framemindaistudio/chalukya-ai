import { useMemo, useState } from 'react'
import { Cpu, Radio } from 'lucide-react'
import { Card, Chip, Eyebrow, Meter, PageHead } from '../components/ui'
import MapView from '../components/MapView'
import { useLang } from '../lib/i18n'
import { useNow } from '../lib/clock'
import { freeOnArrival, lotStatus, LOT_IDS, predictFree } from '../lib/parking'
import { METRICS } from '../lib/data'
import { mapsLink } from '../lib/geo'

const TX = {
  title: { en: 'Find parking before you arrive', kn: 'ತಲುಪುವ ಮೊದಲೇ ಪಾರ್ಕಿಂಗ್ ತಿಳಿಯಿರಿ', hi: 'पहुँचने से पहले पार्किंग जानिए' },
  sub: { en: 'Slot sensors report every 10 minutes; a trained model predicts what will be free when you get there.', kn: 'ಸ್ಲಾಟ್ ಸೆನ್ಸರ್‌ಗಳು ಪ್ರತಿ 10 ನಿಮಿಷಕ್ಕೆ ವರದಿ ಮಾಡುತ್ತವೆ; ನೀವು ತಲುಪುವಾಗ ಎಷ್ಟು ಖಾಲಿ ಇರುತ್ತದೆ ಎಂದು ತರಬೇತಿ ಪಡೆದ ಮಾದರಿ ಊಹಿಸುತ್ತದೆ.', hi: 'स्लॉट सेंसर हर 10 मिनट में रिपोर्ट करते हैं; प्रशिक्षित मॉडल बताता है कि आपके पहुँचने पर कितनी जगह खाली होगी।' },
  arrive: { en: 'I will arrive in', kn: 'ನಾನು ತಲುಪುವುದು', hi: 'मैं पहुँचूँगा' }, now: { en: 'now', kn: 'ಈಗ', hi: 'अभी' },
  onArrival: { en: 'free on arrival', kn: 'ತಲುಪಿದಾಗ ಖಾಲಿ', hi: 'पहुँचने पर खाली' }, full: { en: 'Likely full: consider the next lot or come later', kn: 'ಬಹುಶಃ ತುಂಬಿರುತ್ತದೆ: ಬೇರೆ ಪಾರ್ಕಿಂಗ್ ಅಥವಾ ತಡವಾಗಿ ಬನ್ನಿ', hi: 'शायद भरा होगा: दूसरी पार्किंग देखें या बाद में आएँ' },
  model: { en: 'Model accuracy (winter peak test)', kn: 'ಮಾದರಿ ನಿಖರತೆ (ಚಳಿಗಾಲದ ಪರೀಕ್ಷೆ)', hi: 'मॉडल सटीकता (सर्दियों का परीक्षण)' },
}

export default function Parking() {
  const { L, t } = useLang()
  const at = useNow(15_000)
  const [inMin, setIn] = useState(30)
  const lots = useMemo(() => LOT_IDS.map((id) => ({ ...lotStatus(id, at), onArrival: freeOnArrival(id, at, inMin), p120: predictFree(id, at, 120) })), [at, inMin])
  const m = METRICS.parking?.horizons

  return (
    <div>
      <PageHead title={L(TX.title)} sub={L(TX.sub)} />
      <div className="space-y-4 px-4">
        <Card className="p-4">
          <Eyebrow>{L(TX.arrive)}</Eyebrow>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">{[0, 30, 60, 90, 120].map((x) => <Chip key={x} active={inMin === x} onClick={() => setIn(x)}>{x === 0 ? L(TX.now) : `${x} ${t('min')}`}</Chip>)}</div>
        </Card>

        <MapView height={210} pins={lots.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, label: `${l.name}: ${l.onArrival}/${l.capacity} free`, color: l.onArrival / l.capacity < 0.1 ? '#8f2a17' : l.onArrival / l.capacity < 0.3 ? '#c0562f' : '#1f5e57', radius: 11 }))} />

        {lots.map((l) => {
          const ratio = l.onArrival / l.capacity
          const col = ratio < 0.1 ? '#8f2a17' : ratio < 0.3 ? '#c0562f' : '#1f5e57'
          return (
            <Card key={l.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[16px] font-semibold">{l.name}</div>
                  <div className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3"><Radio size={12} className="text-lake" />{L(TX.now)}: <b className="num text-ink">{l.free}</b>/{l.capacity} {t('free')}</div>
                </div>
                <div className="text-right">
                  <div className="num text-[30px] font-bold leading-none" style={{ color: col }}>{l.onArrival}</div>
                  <div className="text-[11px] text-ink-3">{inMin ? L(TX.onArrival) : t('slotsFree')}</div>
                </div>
              </div>
              <div className="mt-3"><Meter value={l.capacity - l.onArrival} max={l.capacity} color={col} /></div>
              {ratio < 0.1 && <p className="mt-2 text-[13px] font-medium text-sand">{L(TX.full)}</p>}
              <a href={mapsLink(l.lat, l.lng)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[13.5px] font-semibold text-lake">Directions →</a>
            </Card>
          )
        })}

        {m && (
          <Card className="p-4">
            <div className="flex items-center gap-2"><Cpu size={17} className="text-lake" /><Eyebrow>{L(TX.model)}</Eyebrow></div>
            <table className="num mt-2 w-full text-[13.5px]">
              <thead><tr className="text-left text-ink-3"><th className="font-medium">Ahead</th><th className="font-medium">Model error</th><th className="font-medium">“Stays same” error</th></tr></thead>
              <tbody>{Object.entries(m).map(([h, v]: [string, any]) => <tr key={h} className="border-t border-line"><td className="py-1.5">{h}</td><td><b className="text-lake">±{v.mae_slots_model}</b> slots</td><td>±{v.mae_slots_persistence}</td></tr>)}</tbody>
            </table>
            <p className="mt-2 text-[12px] text-ink-3">LightGBM on simulated 10-minute sensor data; the phone runs a compact 120-tree version. Plug in real ESP32 sensors and the same pipeline retrains.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
