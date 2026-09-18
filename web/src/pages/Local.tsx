import { useState } from 'react'
import { Link } from 'react-router'
import { BadgeCheck, CookingPot, Mountain, Scissors, Store, Users } from 'lucide-react'
import { Card, Chip, Eyebrow, PageHead } from '../components/ui'
import { useLang } from '../lib/i18n'
import { placeById } from '../lib/data'
import { publish } from '../lib/live'

const TX = {
  title: { en: 'Support local livelihoods', kn: 'ಸ್ಥಳೀಯ ಜೀವನೋಪಾಯಕ್ಕೆ ಬೆಂಬಲ', hi: 'स्थानीय आजीविका का साथ दें' },
  sub: { en: 'Tourism money that stays in Bagalkot: weavers, cooks, guides and small eateries.', kn: 'ಬಾಗಲಕೋಟೆಯಲ್ಲೇ ಉಳಿಯುವ ಪ್ರವಾಸೋದ್ಯಮದ ಹಣ: ನೇಕಾರರು, ಅಡುಗೆಯವರು, ಮಾರ್ಗದರ್ಶಿಗಳು, ಸಣ್ಣ ಖಾನಾವಳಿಗಳು.', hi: 'पर्यटन का पैसा जो बागलकोट में ही रहे: बुनकर, रसोइए, गाइड और छोटे भोजनालय।' },
  crafts: { en: 'Crafts of the district', kn: 'ಜಿಲ್ಲೆಯ ಕರಕುಶಲ', hi: 'ज़िले के हस्तशिल्प' }, exp: { en: 'Experiences the platform supports', kn: 'ವೇದಿಕೆ ಬೆಂಬಲಿಸುವ ಅನುಭವಗಳು', hi: 'प्लेटफ़ॉर्म पर मिलने वाले अनुभव' },
  expNote: { en: 'Local hosts list these through the portal below; each listing is verified by the district before it appears.', kn: 'ಸ್ಥಳೀಯರು ಕೆಳಗಿನ ಪೋರ್ಟಲ್ ಮೂಲಕ ಇವುಗಳನ್ನು ಸೇರಿಸುತ್ತಾರೆ; ಜಿಲ್ಲಾಡಳಿತ ಪರಿಶೀಲಿಸಿದ ನಂತರ ಪ್ರಕಟವಾಗುತ್ತದೆ.', hi: 'स्थानीय मेज़बान इन्हें नीचे के पोर्टल से जोड़ते हैं; ज़िला सत्यापन के बाद ही ये दिखते हैं।' },
  portal: { en: 'Local business portal', kn: 'ಸ್ಥಳೀಯ ವ್ಯಾಪಾರ ಪೋರ್ಟಲ್', hi: 'स्थानीय व्यापार पोर्टल' },
  portalSub: { en: 'Own a homestay, eatery, shop or guide service? Add it once; you keep prices and hours up to date yourself, and the AI recommends you to matching tourists.', kn: 'ಹೋಂಸ್ಟೇ, ಖಾನಾವಳಿ, ಅಂಗಡಿ ಅಥವಾ ಮಾರ್ಗದರ್ಶಿ ಸೇವೆ ಇದೆಯೇ? ಒಮ್ಮೆ ಸೇರಿಸಿ; ಬೆಲೆ ಮತ್ತು ಸಮಯವನ್ನು ನೀವೇ ನವೀಕರಿಸಿ, AI ಸೂಕ್ತ ಪ್ರವಾಸಿಗರಿಗೆ ನಿಮ್ಮನ್ನು ಸೂಚಿಸುತ್ತದೆ.', hi: 'होमस्टे, भोजनालय, दुकान या गाइड सेवा है? एक बार जोड़ें; दाम और समय खुद अपडेट करें, AI सही पर्यटकों को आपकी सिफ़ारिश करेगा।' },
  name: { en: 'Business name', kn: 'ವ್ಯಾಪಾರದ ಹೆಸರು', hi: 'व्यापार का नाम' }, phone: { en: 'Phone', kn: 'ಫೋನ್', hi: 'फ़ोन' }, town: { en: 'Town', kn: 'ಊರು', hi: 'शहर' },
  submit: { en: 'Submit for verification', kn: 'ಪರಿಶೀಲನೆಗೆ ಸಲ್ಲಿಸಿ', hi: 'सत्यापन के लिए भेजें' }, done: { en: 'Submitted. The district tourism office will verify and call you.', kn: 'ಸಲ್ಲಿಸಲಾಗಿದೆ. ಜಿಲ್ಲಾ ಪ್ರವಾಸೋದ್ಯಮ ಕಚೇರಿ ಪರಿಶೀಲಿಸಿ ಕರೆ ಮಾಡುತ್ತದೆ.', hi: 'भेज दिया। ज़िला पर्यटन कार्यालय सत्यापन कर आपको कॉल करेगा।' },
  guides: { en: 'Pravasi Mitra guides', kn: 'ಪ್ರವಾಸಿ ಮಿತ್ರ ಮಾರ್ಗದರ್ಶಿಗಳು', hi: 'प्रवासी मित्र गाइड' },
  guidesSub: { en: 'The district has placed Pravasi Mitra tourist helpers at the UNESCO site and major monuments. Look for them at the entrance, or ask the guide in this app.', kn: 'ಯುನೆಸ್ಕೋ ತಾಣ ಮತ್ತು ಪ್ರಮುಖ ಸ್ಮಾರಕಗಳಲ್ಲಿ ಜಿಲ್ಲಾಡಳಿತ ಪ್ರವಾಸಿ ಮಿತ್ರರನ್ನು ನೇಮಿಸಿದೆ. ಪ್ರವೇಶದ್ವಾರದಲ್ಲಿ ಅವರನ್ನು ಹುಡುಕಿ.', hi: 'ज़िले ने यूनेस्को स्थल और प्रमुख स्मारकों पर प्रवासी मित्र नियुक्त किए हैं। उन्हें प्रवेश द्वार पर खोजें।' },
}
const CRAFTS = [
  { id: 'ilkal', icon: Scissors, en: 'Ilkal sarees (GI)', kn: 'ಇಳಕಲ್ ಸೀರೆ (GI)', hi: 'इलकल साड़ी (GI)', d: { en: 'Handloom sarees with the red "tope teni" pallu; 3–7 days to weave one.', kn: 'ಕೆಂಪು "ತೋಪು ತೆನಿ" ಸೆರಗಿನ ಕೈಮಗ್ಗ ಸೀರೆ; ಒಂದನ್ನು ನೇಯಲು 3–7 ದಿನ.', hi: 'लाल "तोपे तेनी" पल्लू वाली हथकरघा साड़ी; एक बुनने में 3–7 दिन।' } },
  { id: 'guledgudda', icon: Scissors, en: 'Guledgudda khana (GI)', kn: 'ಗುಳೇದಗುಡ್ಡ ಖಣ (GI)', hi: 'गुलेदगुड्ड खण (GI)', d: { en: 'Richly patterned fabric traditionally used for blouses.', kn: 'ಸಾಂಪ್ರದಾಯಿಕವಾಗಿ ರವಿಕೆಗೆ ಬಳಸುವ ಸುಂದರ ವಿನ್ಯಾಸದ ಬಟ್ಟೆ.', hi: 'पारंपरिक रूप से ब्लाउज़ के लिए बना भरपूर डिज़ाइन वाला कपड़ा।' } },
  { id: 'amingad', icon: CookingPot, en: 'Amingad kardantu', kn: 'ಅಮೀನಗಡ ಕರದಂಟು', hi: 'अमीनगड करदंटु', d: { en: 'Dry-fruit and jaggery sweet, born as food for wrestlers.', kn: 'ಕುಸ್ತಿಪಟುಗಳ ಆಹಾರವಾಗಿ ಹುಟ್ಟಿದ ಒಣಹಣ್ಣು–ಬೆಲ್ಲದ ಸಿಹಿ.', hi: 'पहलवानों के भोजन के रूप में जन्मी सूखे मेवे और गुड़ की मिठाई।' } },
]
const EXPERIENCES = [
  { icon: CookingPot, en: 'Cook jolada rotti with a local family', kn: 'ಸ್ಥಳೀಯ ಕುಟುಂಬದೊಂದಿಗೆ ಜೋಳದ ರೊಟ್ಟಿ ತಯಾರಿಕೆ', hi: 'स्थानीय परिवार के साथ ज्वार रोटी बनाना' },
  { icon: Scissors, en: 'Watch an Ilkal saree being woven', kn: 'ಇಳಕಲ್ ಸೀರೆ ನೇಯ್ಗೆ ವೀಕ್ಷಣೆ', hi: 'इलकल साड़ी की बुनाई देखना' },
  { icon: Users, en: 'Dawn heritage walk with a Pravasi Mitra', kn: 'ಪ್ರವಾಸಿ ಮಿತ್ರರೊಂದಿಗೆ ಮುಂಜಾನೆ ಪರಂಪರೆ ನಡಿಗೆ', hi: 'प्रवासी मित्र के साथ सुबह की विरासत सैर' },
  { icon: Mountain, en: 'Intro to rock climbing with a certified instructor', kn: 'ಪ್ರಮಾಣಿತ ತರಬೇತುದಾರರೊಂದಿಗೆ ಬಂಡೆ ಹತ್ತುವ ಪರಿಚಯ', hi: 'प्रमाणित प्रशिक्षक के साथ रॉक क्लाइंबिंग परिचय' },
]
const KINDS = ['Homestay', 'Eatery', 'Craft shop', 'Guide', 'Transport']

export default function Local() {
  const { L, lang } = useLang()
  const [kind, setKind] = useState('Homestay')
  const [form, setForm] = useState({ name: '', phone: '', town: 'Badami' })
  const [done, setDone] = useState(false)
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    publish({ type: 'anomaly', severity: 'info', source: 'tourist', title: `New local listing to verify: ${form.name} (${kind}, ${form.town})`, detail: form.phone ? `phone ${form.phone}` : undefined })
    fetch('/api/business', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, kind }) }).catch(() => {})
    setDone(true)
  }
  return (
    <div>
      <PageHead title={L(TX.title)} sub={L(TX.sub)} />
      <div className="space-y-4 px-4">
        <section>
          <Eyebrow className="mb-2">{L(TX.crafts)}</Eyebrow>
          <div className="space-y-2.5">{CRAFTS.map((c) => (
            <Link key={c.id} to={`/place/${c.id}`} className="card flex gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lamp-soft text-[#8a6412]"><c.icon size={19} /></span>
              <div><div className="text-[15.5px] font-semibold">{c[lang]}</div><div className="text-[13.5px] text-ink-2">{c.d[lang]}</div><div className="mt-0.5 text-[12px] text-ink-3">{placeById[c.id]?.town}</div></div>
            </Link>
          ))}</div>
        </section>

        <Card className="p-4">
          <div className="flex items-center gap-2"><BadgeCheck size={18} className="text-lake" /><div className="text-[15.5px] font-semibold">{L(TX.guides)}</div></div>
          <p className="mt-1 text-[14px] text-ink-2">{L(TX.guidesSub)}</p>
        </Card>

        <Card className="p-4">
          <Eyebrow>{L(TX.exp)}</Eyebrow>
          <ul className="mt-2 space-y-2.5">{EXPERIENCES.map((x, i) => <li key={i} className="flex items-center gap-3 text-[14.5px]"><x.icon size={18} className="text-lake" />{x[lang]}</li>)}</ul>
          <p className="mt-2 text-[12px] text-ink-3">{L(TX.expNote)}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2"><Store size={18} className="text-lake" /><div className="text-[16px] font-semibold">{L(TX.portal)}</div></div>
          <p className="mt-1 text-[13.5px] text-ink-2">{L(TX.portalSub)}</p>
          {done ? <p className="mt-3 rounded-xl bg-lake-soft/60 p-3 text-[14px] text-lake">{L(TX.done)}</p> : (
            <form onSubmit={submit} className="mt-3 space-y-3">
              <div className="no-scrollbar flex gap-2 overflow-x-auto">{KINDS.map((k) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{k}</Chip>)}</div>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={L(TX.name)} className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-[15px] outline-none focus:border-lake" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={L(TX.phone)} inputMode="tel" className="h-11 rounded-xl border border-line bg-paper px-3 text-[15px] outline-none focus:border-lake" />
                <select value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} aria-label={L(TX.town)} className="h-11 rounded-xl border border-line bg-paper px-3 text-[15px]">
                  {['Badami', 'Pattadakal', 'Aihole', 'Bagalkot', 'Ilkal', 'Guledgudda', 'Hungund', 'Kudalasangama'].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <button className="w-full rounded-xl bg-lake py-3 text-[15px] font-semibold text-white">{L(TX.submit)}</button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
