import { Link } from 'react-router'
import { Accessibility, BedDouble, Footprints, Route, Sun, TreePine } from 'lucide-react'
import { Card, Eyebrow, PageHead } from '../components/ui'
import PlaceImage from '../components/PlaceImage'
import { useLang } from '../lib/i18n'
import { PLACES, STAYS } from '../lib/data'
import { pretty } from '../lib/recommend'

/*
  Accessibility guide: which places suit wheelchair users, elders and families with small children,
  built from the knowledge base's visit attributes (steps, wheelchair access, shade), plus stays that
  list wheelchair access. The planner uses the same attributes to build step-free itineraries.
*/
const TX = {
  title: { en: 'Accessible Bagalkot', kn: 'ಎಲ್ಲರಿಗೂ ಸುಗಮ ಬಾಗಲಕೋಟೆ', hi: 'सबके लिए सुगम बागलकोट' },
  sub: { en: 'Step-free and elder-friendly places, shade, and a planner that avoids stairs.', kn: 'ಮೆಟ್ಟಿಲು ಇಲ್ಲದ, ಹಿರಿಯರಿಗೆ ಸುಲಭವಾದ ಸ್ಥಳಗಳು, ನೆರಳು, ಮತ್ತು ಮೆಟ್ಟಿಲು ತಪ್ಪಿಸುವ ಯೋಜಕ.', hi: 'बिना सीढ़ी वाली और बुज़ुर्गों के लिए आसान जगहें, छाया, और सीढ़ियाँ टालने वाला प्लानर।' },
  easy: { en: 'Easy for wheelchairs and elders', kn: 'ಗಾಲಿಕುರ್ಚಿ ಮತ್ತು ಹಿರಿಯರಿಗೆ ಸುಲಭ', hi: 'व्हीलचेयर और बुज़ुर्गों के लिए आसान' },
  partial: { en: 'Partly accessible: plan rest breaks', kn: 'ಭಾಗಶಃ ಸುಗಮ: ವಿಶ್ರಾಂತಿ ಯೋಜಿಸಿ', hi: 'आंशिक रूप से सुगम: आराम की योजना बनाएँ' },
  hard: { en: 'Many steps: view from below or skip', kn: 'ಅನೇಕ ಮೆಟ್ಟಿಲು: ಕೆಳಗಿನಿಂದ ನೋಡಿ', hi: 'कई सीढ़ियाँ: नीचे से देखें' },
  plan: { en: 'Build a step-free day plan', kn: 'ಮೆಟ್ಟಿಲು ಇಲ್ಲದ ದಿನದ ಯೋಜನೆ', hi: 'बिना सीढ़ी वाली दिन की योजना' },
  stays: { en: 'Stays listing wheelchair access', kn: 'ಗಾಲಿಕುರ್ಚಿ ಸೌಲಭ್ಯವಿರುವ ವಸತಿ', hi: 'व्हीलचेयर सुविधा वाले ठहराव' },
  note: { en: 'Access details come from the knowledge base and should be verified on site; stay amenities are demo data.', kn: 'ಈ ಮಾಹಿತಿಯನ್ನು ಸ್ಥಳದಲ್ಲಿ ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ; ವಸತಿ ಸೌಲಭ್ಯಗಳು ಡೆಮೊ ಡೇಟಾ.', hi: 'जानकारी मौके पर जाँच लें; ठहराव की सुविधाएँ डेमो डेटा हैं।' },
}

export default function Access() {
  const { L, lang } = useLang()
  const groups = [
    { key: 'easy', items: PLACES.filter((p) => !p.visit.stairs && p.visit.wheelchair === 'yes') },
    { key: 'partial', items: PLACES.filter((p) => p.visit.wheelchair === 'partial') },
    { key: 'hard', items: PLACES.filter((p) => p.visit.wheelchair === 'no') },
  ] as const
  const stays = STAYS.filter((s) => s.amenities.includes('wheelchair'))
  const q = lang === 'kn' ? 'ಅಜ್ಜಿ ಜೊತೆಗಿದ್ದಾರೆ, ಗಾಲಿಕುರ್ಚಿ, 6 ಗಂಟೆ ಇದೆ, ದೇವಾಲಯ ನೋಡಬೇಕು' : lang === 'hi' ? 'दादी साथ हैं, व्हीलचेयर, 6 घंटे हैं, मंदिर देखने हैं' : 'We have a wheelchair user, 6 hours, and want to see temples'
  return (
    <div>
      <PageHead title={L(TX.title)} sub={L(TX.sub)} />
      <div className="space-y-4 px-4">
        <Link to={`/plan?q=${encodeURIComponent(q)}`} className="card flex items-center gap-3 bg-[linear-gradient(145deg,#1f5e57,#2b776e)] p-4 text-white">
          <Route size={22} /><span className="flex-1 text-[15.5px] font-bold">{L(TX.plan)}</span><Accessibility size={20} className="text-white/70" />
        </Link>
        {groups.map((g) => (
          <section key={g.key}>
            <Eyebrow className="mb-2">{L(TX[g.key])} · {g.items.length}</Eyebrow>
            <div className="space-y-2.5">
              {g.items.map((p) => (
                <Link key={p.id} to={`/place/${p.id}`} className="card flex overflow-hidden">
                  <PlaceImage id={p.id} className="h-auto w-24 shrink-0" />
                  <div className="flex-1 p-3">
                    <div className="text-[15px] font-bold leading-tight">{L(p.name)}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px]">
                      <span className="inline-flex items-center gap-1 rounded-md bg-mist px-1.5 py-0.5"><Footprints size={12} />{p.visit.stairs ? 'steps' : 'step-free'}</span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-mist px-1.5 py-0.5"><Accessibility size={12} />{p.visit.wheelchair}</span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-mist px-1.5 py-0.5">{p.visit.shade === 'high' ? <TreePine size={12} /> : <Sun size={12} />}shade: {p.visit.shade}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
        <Card className="p-4">
          <Eyebrow>{L(TX.stays)}</Eyebrow>
          <ul className="mt-2 divide-y divide-line">{stays.map((s) => <li key={s.id} className="flex items-center gap-2 py-2 text-[14px]"><BedDouble size={15} className="text-lake" /><span className="flex-1 font-medium">{s.name}</span><span className="text-[12px] text-ink-3">{s.amenities.filter((a) => a === 'lift' || a === 'wheelchair').map(pretty).join(', ')}</span></li>)}</ul>
        </Card>
        <p className="px-1 pb-2 text-[11.5px] text-ink-3">{L(TX.note)}</p>
      </div>
    </div>
  )
}
