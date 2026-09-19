import { FAQS, HOSPITALS, LOT_FOR_SITE, FORECAST_SITE, PLACES, placeById, road, sculptureById, type Faq } from './data'
import { classify, detectLang } from './intent'
import { search } from './retrieval'
import { bestHours, crowdNow, upcomingEvents, type Level } from './crowd'
import { freeOnArrival, lotStatus } from './parking'
import { rankEateries, rankStays, type Ranked } from './recommend'
import { getWeather, heatAdvice } from './weather'
import { haversineKm } from './geo'
import { now } from './clock'
import { track } from './live'
import type { Eatery, Stay } from './data'
import { parseTrip } from './tripParse'
import { plan as buildPlan, type DayPlan } from './itinerary'
import type { Lang } from './i18n'

/*
  The guide is a tool-using assistant with a fixed, verifiable toolset:
    understand (intent + entities) → call the right tool (forecast model, parking model,
    recommender, route table, knowledge base) → compose the reply in the user's language.
  Nothing is free-generated, so every sentence traces back to a model output or a curated source.
*/
export type Card =
  | { type: 'place'; id: string }
  | { type: 'sculpture'; id: string }
  | { type: 'crowd'; site: string }
  | { type: 'parking'; lots: string[] }
  | { type: 'stays'; items: Ranked<Stay>[] }
  | { type: 'food'; items: Ranked<Eatery>[] }
  | { type: 'route'; to: string; km: number; min: number }
  | { type: 'emergency' }
  | { type: 'events'; events: { d: string; tag: string }[] }
  | { type: 'link'; to: string; label: { en: string; kn: string; hi: string } }
  | { type: 'plan'; day: DayPlan; query: string; understood: { key: string; value: string }[] }
export type Answer = { text: string; lang: Lang; intent: string; confidence: number; cards: Card[]; sources: string[]; suggestions: string[] }

const tr = (lang: Lang, en: string, kn: string, hi: string) => (lang === 'kn' ? kn : lang === 'hi' ? hi : en)
const n = (x: number) => x.toLocaleString('en-IN')
const nm = (id: string, lang: Lang) => placeById[id]?.name[lang] ?? placeById[id]?.name.en ?? id
export function clockWord(mins: number, lang: Lang) {
  const h = Math.floor(mins / 60) % 24, m = Math.round(mins % 60), h12 = ((h + 11) % 12) + 1, mm = String(m).padStart(2, '0')
  if (lang === 'kn') return `${h < 12 ? 'ಬೆಳಿಗ್ಗೆ' : h < 16 ? 'ಮಧ್ಯಾಹ್ನ' : 'ಸಂಜೆ'} ${h12}:${mm}`
  if (lang === 'hi') return `${h < 12 ? 'सुबह' : h < 16 ? 'दोपहर' : 'शाम'} ${h12}:${mm}`
  return `${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`
}
export function timeWord(h: number, lang: Lang) {
  const h12 = ((h + 11) % 12) + 1
  if (lang === 'kn') return `${h < 12 ? 'ಬೆಳಿಗ್ಗೆ' : h < 16 ? 'ಮಧ್ಯಾಹ್ನ' : 'ಸಂಜೆ'} ${h12}`
  if (lang === 'hi') return `${h < 12 ? 'सुबह' : h < 16 ? 'दोपहर' : 'शाम'} ${h12} बजे`
  return `${h12} ${h < 12 ? 'AM' : 'PM'}`
}
const LEVEL_WORD: Record<Level, [string, string, string]> = {
  low: ['quiet', 'ಶಾಂತ', 'शांत'], moderate: ['moderately busy', 'ಮಧ್ಯಮ ಜನಸಂದಣಿ', 'मध्यम भीड़'],
  busy: ['busy', 'ಜನಸಂದಣಿ ಹೆಚ್ಚು', 'व्यस्त'], packed: ['packed', 'ತುಂಬಿ ತುಳುಕುತ್ತಿದೆ', 'बहुत भीड़'],
}
const lvl = (l: Level, lang: Lang) => LEVEL_WORD[l][lang === 'en' ? 0 : lang === 'kn' ? 1 : 2]

function parseBudget(q: string) {
  const m = q.replace(/,/g, '').match(/(?:₹|rs\.?|inr|under|below|within|less than|ಒಳಗೆ|ಕಡಿಮೆ|से कम|तक)?\s*(\d{3,5})/i)
  return m ? Number(m[1]) : null
}
const VEG = /(pure veg|vegetarian|\bveg\b|ಸಸ್ಯಾಹಾರ|शाकाहारी|शुद्ध शाकाहारी)/i
const NONVEG = /(non[- ]?veg|chicken|mutton|fish|egg|savji|ಮಾಂಸ|ಚಿಕನ್|मांसाहारी|नॉन वेज|चिकन|मटन)/i
const AMEN: [RegExp, string][] = [[/(parking|ಪಾರ್ಕಿಂಗ್|पार्किंग)/i, 'parking'], [/(\bac\b|a\/c|air ?condition|ಎಸಿ|एसी)/i, 'ac'], [/(wifi|wi-fi|ವೈಫೈ|वाईफाई)/i, 'wifi'], [/(family|ಕುಟುಂಬ|परिवार)/i, 'family_rooms'], [/(wheelchair|ಗಾಲಿಕುರ್ಚಿ|व्हीलचेयर)/i, 'wheelchair']]

function faq(id: string): Faq | undefined { return FAQS.find((f) => f.id === id) }

export async function ask(question: string, uiLang: Lang): Promise<Answer> {
  const lang: Lang = detectLang(question) ?? uiLang
  const r = await classify(question)
  const place = r.places[0] === 'badami' ? 'badami_caves' : r.places[0]
  const cards: Card[] = []
  const sources: string[] = []
  const at = now()
  let intent = r.intent
  if (r.confidence < 0.28) intent = 'fallback'
  // A trip description ("I have 6 hours…", "2 days", "plan…") always goes to the planner tool
  if (/\d+\s*(hours?|hrs?|ghante|gante|days?)\b/i.test(question) || /(ಗಂಟೆ|घंटे|घंटा|ದಿನಗಳು|ದಿನದ|दिन का|दिनों)/.test(question) || /\b(itinerary|plan (my|a|our))\b/i.test(question)) intent = 'itinerary'
  // Questions for the Tourism Department itself, or about reaching the district from a major city, are
  // answered from the District Administration's own published details (ಪ್ರವಾಸೋದ್ಯಮ = tourism, not ಪ್ರವಾಸ = trip)
  else if (/(tourism (office|department|dept)|tourist (office|information cent)|contact (the )?(tourism|district)|ಪ್ರವಾಸೋದ್ಯಮ|पर्यटन (कार्यालय|विभाग|दफ़्तर))/i.test(question)) intent = 'official_office'
  else if (/(bengaluru|bangalore|hubballi|hubli|vijayapura|bijapur|belagavi|belgaum|ಬೆಂಗಳೂರು|ಹುಬ್ಬಳ್ಳಿ|ವಿಜಯಪುರ|ಬೆಳಗಾವಿ|बेंगलुरु|बैंगलोर|हुबली|हुब्बल्ली|विजयपुर|बेलगावी|बेलगाम)/i.test(question)) intent = 'official_reach'
  let text = ''

  switch (intent) {
    case 'greeting':
      text = tr(lang,
        'Namaskara! I am your guide to Badami, Pattadakal, Aihole and the rest of Bagalkot district. Ask me about history, crowds, parking, food, stays or safety, or scan a sculpture with your camera.',
        'ನಮಸ್ಕಾರ! ನಾನು ಬಾದಾಮಿ, ಪಟ್ಟದಕಲ್ಲು, ಐಹೊಳೆ ಮತ್ತು ಬಾಗಲಕೋಟೆ ಜಿಲ್ಲೆಯ ನಿಮ್ಮ ಮಾರ್ಗದರ್ಶಿ. ಇತಿಹಾಸ, ಜನಸಂದಣಿ, ಪಾರ್ಕಿಂಗ್, ಊಟ, ವಸತಿ ಅಥವಾ ಸುರಕ್ಷತೆಯ ಬಗ್ಗೆ ಕೇಳಿ, ಅಥವಾ ಕ್ಯಾಮೆರಾದಿಂದ ಶಿಲ್ಪವನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.',
        'नमस्ते! मैं बादामी, पट्टदकल, ऐहोल और पूरे बागलकोट ज़िले के लिए आपका गाइड हूँ। इतिहास, भीड़, पार्किंग, खाना, ठहरना या सुरक्षा के बारे में पूछिए, या कैमरे से मूर्ति स्कैन कीजिए।')
      break

    case 'about_place': {
      const id = place && placeById[place] ? place : search(question, { lang, kind: 'place', k: 1 })[0]?.doc.ref
      if (!id) { intent = 'fallback'; break }
      const p = placeById[id === 'badami' ? 'badami_caves' : id] ?? placeById.badami_caves
      text = `${p.summary[lang] ?? p.summary.en}${p.facts[0] ? ' ' + (p.facts[0][lang] ?? p.facts[0].en) : ''}`
      cards.push({ type: 'place', id: p.id }); sources.push(p.src ?? 'kb', ...p.facts.slice(0, 1).map((f) => f.src ?? 'kb'))
      break
    }

    case 'sculpture': {
      const hit = search(question, { lang, kind: 'sculpture', k: 1 })[0]
      if (!hit) { intent = 'fallback'; break }
      const s = sculptureById[hit.doc.ref]
      text = `${s.name[lang] ?? s.name.en}: ${s.text[lang] ?? s.text.en}`
      cards.push({ type: 'sculpture', id: s.id }, { type: 'link', to: '/scan', label: { en: 'Scan it with your camera', kn: 'ಕ್ಯಾಮೆರಾದಿಂದ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ', hi: 'कैमरे से स्कैन करें' } })
      sources.push('kb')
      break
    }

    case 'best_time_crowd': {
      const site = FORECAST_SITE[place ?? ''] ?? 'badami_caves'
      // word boundaries matter: "Pattadakal" ends in "kal", which is Hindi for tomorrow
      const tomorrow = /\b(tomorrow|naale|kal)\b/i.test(question) || /(ನಾಳೆ|(^|\s)कल(\s|$|\?|।))/.test(question)
      const sunday = /\bsunday\b/i.test(question) || /(ಭಾನುವಾರ|रविवार)/.test(question)
      const day = new Date(at); if (tomorrow) day.setDate(day.getDate() + 1)
      if (sunday) day.setDate(day.getDate() + ((7 - day.getDay()) % 7))
      const b = bestHours(site, day, !tomorrow && !sunday && day.getDate() === at.getDate() ? Math.max(6, at.getHours()) : 6)
      const c = !tomorrow && !sunday ? crowdNow(site, at) : null
      if (!b) { text = tr(lang, 'I do not have a forecast for that date yet.', 'ಆ ದಿನಾಂಕಕ್ಕೆ ಮುನ್ಸೂಚನೆ ಇನ್ನೂ ಇಲ್ಲ.', 'उस तारीख का पूर्वानुमान अभी उपलब्ध नहीं है।'); break }
      const nowPart = c ? tr(lang, `Right now about ${n(c.present)} people are at ${nm(site, lang)}: ${lvl(c.level, lang)}. `, `ಈಗ ${nm(site, lang)} ನಲ್ಲಿ ಸುಮಾರು ${n(c.present)} ಜನರಿದ್ದಾರೆ: ${lvl(c.level, lang)}. `, `अभी ${nm(site, lang)} में लगभग ${n(c.present)} लोग हैं: ${lvl(c.level, lang)}। `) : ''
      const dayWord = tomorrow ? tr(lang, 'Tomorrow', 'ನಾಳೆ', 'कल') : sunday ? tr(lang, 'On Sunday', 'ಭಾನುವಾರ', 'रविवार को') : tr(lang, 'Today', 'ಇಂದು', 'आज')
      const tag = b.day.tag ? tr(lang, ` (${b.day.tag})`, ` (${b.day.tag})`, ` (${b.day.tag})`) : ''
      text = nowPart + tr(lang,
        `${dayWord}${tag} the model expects about ${n(b.day.p50)} visitors (likely range ${n(b.day.p10)}–${n(b.day.p90)}). Quietest around ${timeWord(b.quiet.h, lang)}; busiest around ${timeWord(b.busy.h, lang)}.`,
        `${dayWord}${tag} ಸುಮಾರು ${n(b.day.p50)} ಪ್ರವಾಸಿಗರನ್ನು ಮಾದರಿ ನಿರೀಕ್ಷಿಸುತ್ತದೆ (ಸಂಭಾವ್ಯ ${n(b.day.p10)}–${n(b.day.p90)}). ಅತ್ಯಂತ ಶಾಂತ ಸಮಯ ${timeWord(b.quiet.h, lang)}; ಹೆಚ್ಚು ಜನ ${timeWord(b.busy.h, lang)}.`,
        `${dayWord}${tag} मॉडल के अनुसार लगभग ${n(b.day.p50)} पर्यटक आएँगे (संभावित ${n(b.day.p10)}–${n(b.day.p90)})। सबसे शांत समय ${timeWord(b.quiet.h, lang)}; सबसे ज़्यादा भीड़ ${timeWord(b.busy.h, lang)}।`)
      cards.push({ type: 'crowd', site }); sources.push('forecast')
      break
    }

    case 'parking': {
      const site = FORECAST_SITE[place ?? ''] ?? 'badami_caves'
      const lots = LOT_FOR_SITE[site] ?? LOT_FOR_SITE.badami_caves
      const s = lotStatus(lots[0], at)
      const inHr = freeOnArrival(lots[0], at, 60)
      text = tr(lang,
        `${s.name}: ${s.free} of ${s.capacity} slots free now (live sensors). In an hour the model expects about ${inHr} free.`,
        `${s.name}: ಈಗ ${s.capacity} ರಲ್ಲಿ ${s.free} ಸ್ಥಳ ಖಾಲಿ (ಲೈವ್ ಸೆನ್ಸರ್). ಒಂದು ಗಂಟೆಯಲ್ಲಿ ಸುಮಾರು ${inHr} ಖಾಲಿ ಇರುತ್ತವೆ ಎಂದು ಮಾದರಿ ಅಂದಾಜಿಸುತ್ತದೆ.`,
        `${s.name}: अभी ${s.capacity} में से ${s.free} जगह खाली (लाइव सेंसर)। एक घंटे में लगभग ${inHr} खाली रहने का अनुमान है।`)
      cards.push({ type: 'parking', lots }); sources.push('iot', 'parking-model')
      break
    }

    case 'food': {
      const veg = VEG.test(question) && !NONVEG.test(question.replace(/non[- ]?veg/i, '')) ? 'veg' : NONVEG.test(question) ? 'nonveg' : 'any'
      const budget = parseBudget(question) ?? 400
      const items = rankEateries({ budget2: budget, places: place ? [place] : ['badami_caves'], diet: veg, cuisines: /(rotti|ರೊಟ್ಟಿ|रोटी|north karnataka|ಉತ್ತರ ಕರ್ನಾಟಕ)/i.test(question) ? ['North Karnataka meals'] : [], priority: 'balanced', localSpecial: /(rotti|ರೊಟ್ಟಿ|रोटी|local)/i.test(question) }).slice(0, 3)
      text = tr(lang,
        `Here are ${items.length} good options${place ? ` near ${nm(place, lang)}` : ''}${veg === 'veg' ? ', vegetarian' : ''}. Try a North Karnataka meal with jolada rotti if you can.`,
        `${place ? `${nm(place, lang)} ಹತ್ತಿರ ` : ''}${veg === 'veg' ? 'ಸಸ್ಯಾಹಾರಿ ' : ''}${items.length} ಉತ್ತಮ ಆಯ್ಕೆಗಳು ಇಲ್ಲಿವೆ. ಸಾಧ್ಯವಾದರೆ ಜೋಳದ ರೊಟ್ಟಿಯ ಉತ್ತರ ಕರ್ನಾಟಕ ಊಟ ಸವಿಯಿರಿ.`,
        `${place ? `${nm(place, lang)} के पास ` : ''}${veg === 'veg' ? 'शाकाहारी ' : ''}${items.length} अच्छे विकल्प ये हैं। हो सके तो ज्वार की रोटी वाला उत्तर कर्नाटक भोजन ज़रूर आज़माएँ।`)
      if (items[0] && items[0].km > 8) text += tr(lang,
        ` Few eateries are listed near ${place ? nm(place, lang) : 'here'} yet; local owners can add theirs through the Local Business Portal.`,
        ` ${place ? nm(place, lang) : 'ಇಲ್ಲಿ'} ಹತ್ತಿರ ಇನ್ನೂ ಕೆಲವೇ ಖಾನಾವಳಿಗಳು ಪಟ್ಟಿಯಲ್ಲಿವೆ; ಸ್ಥಳೀಯ ಮಾಲೀಕರು ಸ್ಥಳೀಯ ವ್ಯಾಪಾರ ಪೋರ್ಟಲ್ ಮೂಲಕ ಸೇರಿಸಬಹುದು.`,
        ` ${place ? nm(place, lang) : 'यहाँ'} के पास अभी कम भोजनालय सूचीबद्ध हैं; स्थानीय मालिक लोकल बिज़नेस पोर्टल से अपना जोड़ सकते हैं।`)
      cards.push({ type: 'food', items }, { type: 'link', to: '/food', label: { en: 'Refine food search', kn: 'ಊಟದ ಹುಡುಕಾಟ ಬದಲಿಸಿ', hi: 'खाने की खोज बदलें' } }); sources.push('osm', 'recommender')
      break
    }

    case 'stay': {
      const budget = parseBudget(question) ?? 2500
      const amenities = AMEN.filter(([re]) => re.test(question)).map(([, a]) => a)
      const items = rankStays({ budget, places: place ? [place] : ['badami_caves'], amenities, priority: 'balanced' }).slice(0, 3)
      text = tr(lang,
        `Top stays for a budget of ₹${n(budget)}/night${place ? ` near ${nm(place, lang)}` : ''}. Tap one to see why it was picked.`,
        `ರಾತ್ರಿಗೆ ₹${n(budget)} ಬಜೆಟ್‌ಗೆ ${place ? `${nm(place, lang)} ಹತ್ತಿರ ` : ''}ಉತ್ತಮ ವಸತಿಗಳು. ಏಕೆ ಆಯ್ಕೆಯಾಯಿತು ಎಂದು ನೋಡಲು ಒತ್ತಿ.`,
        `₹${n(budget)}/रात के बजट में ${place ? `${nm(place, lang)} के पास ` : ''}सबसे अच्छे ठहरने के विकल्प। क्यों चुना गया, देखने के लिए दबाएँ।`)
      cards.push({ type: 'stays', items }, { type: 'link', to: '/stay', label: { en: 'Refine stay search', kn: 'ವಸತಿ ಹುಡುಕಾಟ ಬದಲಿಸಿ', hi: 'ठहरने की खोज बदलें' } }); sources.push('osm', 'recommender')
      break
    }

    case 'route_distance': {
      const to = place && placeById[place] ? place : 'pattadakal'
      const rt = road('badami_bus_stand', to === 'badami' ? 'badami_caves' : to)
      const f = faq('reach')
      if (rt) {
        text = tr(lang,
          `${nm(to, lang)} is about ${rt.km} km from Badami town, roughly ${rt.min} minutes by road. ${f?.a.en ?? ''}`,
          `${nm(to, lang)} ಬಾದಾಮಿ ಪಟ್ಟಣದಿಂದ ಸುಮಾರು ${rt.km} ಕಿ.ಮೀ, ರಸ್ತೆಯಲ್ಲಿ ಸುಮಾರು ${rt.min} ನಿಮಿಷ. ${f?.a.kn ?? ''}`,
          `${nm(to, lang)} बादामी शहर से लगभग ${rt.km} किमी है, सड़क से करीब ${rt.min} मिनट। ${f?.a.hi ?? ''}`)
        cards.push({ type: 'route', to, km: rt.km, min: rt.min }); sources.push('osm-routing', 'kb')
      } else text = f ? f.a[lang] ?? f.a.en : ''
      break
    }

    case 'timings_entry': {
      const p = placeById[place === 'badami' ? 'badami_caves' : place ?? 'badami_caves'] ?? placeById.badami_caves
      text = tr(lang,
        `${p.name.en}: ${p.visit.entry}. Monuments here are generally open from sunrise to sunset (about 6 AM to 6 PM); plan about ${p.visit.minutes} minutes. Please confirm current timings and ticket prices at the counter.`,
        `${p.name.kn}: ${p.visit.entry}. ಇಲ್ಲಿನ ಸ್ಮಾರಕಗಳು ಸಾಮಾನ್ಯವಾಗಿ ಸೂರ್ಯೋದಯದಿಂದ ಸೂರ್ಯಾಸ್ತದವರೆಗೆ (ಸುಮಾರು ಬೆಳಿಗ್ಗೆ 6 ರಿಂದ ಸಂಜೆ 6) ತೆರೆದಿರುತ್ತವೆ; ಸುಮಾರು ${p.visit.minutes} ನಿಮಿಷ ಬೇಕು. ಈಗಿನ ಸಮಯ ಮತ್ತು ಟಿಕೆಟ್ ದರವನ್ನು ಕೌಂಟರ್‌ನಲ್ಲಿ ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.`,
        `${p.name.hi}: ${p.visit.entry}। यहाँ के स्मारक आमतौर पर सूर्योदय से सूर्यास्त तक (लगभग सुबह 6 से शाम 6) खुले रहते हैं; लगभग ${p.visit.minutes} मिनट लगते हैं। वर्तमान समय और टिकट दर काउंटर पर ज़रूर पुष्टि करें।`)
      cards.push({ type: 'place', id: p.id }); sources.push('kb')
      break
    }

    case 'safety_emergency': {
      const ref = place ? placeById[place === 'badami' ? 'badami_caves' : place] : placeById.badami_caves
      const h = [...HOSPITALS].sort((a, b) => haversineKm(ref, a) - haversineKm(ref, b))[0]
      text = tr(lang,
        `If this is an emergency, press SOS: it shares your location with the control room. Dial 112 for any emergency, 108 for an ambulance, 1091 for the women's helpline. Nearest public hospital: ${h.name}.`,
        `ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಾದರೆ SOS ಒತ್ತಿ: ನಿಮ್ಮ ಸ್ಥಳ ನಿಯಂತ್ರಣ ಕೊಠಡಿಗೆ ತಲುಪುತ್ತದೆ. ಯಾವುದೇ ತುರ್ತಿಗೆ 112, ಆಂಬ್ಯುಲೆನ್ಸ್‌ಗೆ 108, ಮಹಿಳಾ ಸಹಾಯವಾಣಿ 1091. ಹತ್ತಿರದ ಸರ್ಕಾರಿ ಆಸ್ಪತ್ರೆ: ${h.name}.`,
        `आपात स्थिति हो तो SOS दबाएँ: आपकी लोकेशन कंट्रोल रूम तक जाती है। किसी भी आपात स्थिति के लिए 112, एम्बुलेंस 108, महिला हेल्पलाइन 1091। निकटतम सरकारी अस्पताल: ${h.name}।`)
      cards.push({ type: 'emergency' }); sources.push('osm', 'kb')
      break
    }

    case 'itinerary': {
      const trip = parseTrip(question)
      const day = buildPlan(trip.input)[0]
      if (!day) { text = faq('one_day')?.a[lang] ?? ''; sources.push('kb'); break }
      const inp = trip.input
      const who = tr(lang, `${inp.people} ${inp.people > 1 ? 'people' : 'person'}${inp.kids ? ` (${inp.kids} children)` : ''}`,
        `${inp.people} ಜನರಿಗೆ${inp.kids ? ` (${inp.kids} ಮಕ್ಕಳು)` : ''}`, `${inp.people} लोगों के लिए${inp.kids ? ` (${inp.kids} बच्चे)` : ''}`)
      const from = inp.startFrom === 'badami_bus_stand' ? tr(lang, 'Badami town', 'ಬಾದಾಮಿ ಪಟ್ಟಣ', 'बादामी शहर') : inp.startFrom === 'bagalkot_town' ? tr(lang, 'Bagalkot', 'ಬಾಗಲಕೋಟೆ', 'बागलकोट') : nm(inp.startFrom, lang)
      const span = inp.hours ? tr(lang, `${inp.hours}-hour`, `${inp.hours} ಗಂಟೆಗಳ`, `${inp.hours} घंटे की`) : tr(lang, 'day', 'ದಿನದ', 'दिन की')
      const steps = day.stops.map((st, i) => {
        const lvlTxt = st.level ? ` (${lvl(st.level, lang)})` : ''
        const lunchTxt = day.lunch && day.lunch.afterIndex === i && day.lunch.eatery ? tr(lang, `; lunch at ${day.lunch.eatery.item.name}`, `; ${day.lunch.eatery.item.name} ನಲ್ಲಿ ಊಟ`, `; ${day.lunch.eatery.item.name} में दोपहर का खाना`) : ''
        return `${clockWord(st.arrive, lang)} ${nm(st.id, lang)}${lvlTxt}${lunchTxt}`
      }).join(' → ')
      const spend = day.cost.total
      const budgetTxt = inp.budget ? tr(lang, ` of your ₹${n(inp.budget)}`, ` (ನಿಮ್ಮ ₹${n(inp.budget)} ಬಜೆಟ್‌ನಲ್ಲಿ)`, ` (आपके ₹${n(inp.budget)} बजट में)`) : ''
      text = tr(lang,
        `Your ${span} plan from ${from} for ${who}: ${steps}. Back by ${clockWord(day.endAt, lang)}. About ${day.km} km; estimated spend ₹${n(spend)}${budgetTxt} for food and travel (entry tickets extra). Timings avoid the forecast crowd peaks${inp.kids ? ' and keep steep climbs out of the midday heat for the children' : ''}.`,
        `${who} ನಿಮ್ಮ ${span} ಯೋಜನೆ (ಆರಂಭ: ${from}): ${steps}. ${clockWord(day.endAt, lang)}ಕ್ಕೆ ಹಿಂತಿರುಗುತ್ತೀರಿ. ಸುಮಾರು ${day.km} ಕಿ.ಮೀ; ಊಟ ಮತ್ತು ಪ್ರಯಾಣಕ್ಕೆ ಅಂದಾಜು ₹${n(spend)}${budgetTxt}; ಪ್ರವೇಶ ಟಿಕೆಟ್ ಪ್ರತ್ಯೇಕ. ಜನಸಂದಣಿ ಹೆಚ್ಚಿರುವ ಸಮಯವನ್ನು ತಪ್ಪಿಸಲಾಗಿದೆ${inp.kids ? '; ಮಕ್ಕಳಿಗಾಗಿ ಮಧ್ಯಾಹ್ನದ ಬಿಸಿಲಿನಲ್ಲಿ ಕಡಿದಾದ ಹತ್ತುವಿಕೆ ಇಲ್ಲ' : ''}.`,
        `${who} आपकी ${span} योजना (शुरुआत: ${from}): ${steps}। ${clockWord(day.endAt, lang)} तक वापसी। लगभग ${day.km} किमी; खाने और यात्रा का अनुमानित खर्च ₹${n(spend)}${budgetTxt}; प्रवेश टिकट अलग। समय भीड़ के पूर्वानुमान के अनुसार चुना गया है${inp.kids ? '; बच्चों के लिए दोपहर की धूप में खड़ी चढ़ाई नहीं' : ''}।`)
      cards.push({ type: 'plan', day, query: question, understood: trip.understood })
      sources.push('forecast', 'parking-model', 'recommender', 'osm-routing')
      break
    }

    case 'festival': {
      const ev = upcomingEvents(at, 90)
      const f = faq('festivals')
      text = (f?.a[lang] ?? '') + (ev.length ? tr(lang, ' Coming up in the forecast calendar:', ' ಮುನ್ಸೂಚನೆ ಕ್ಯಾಲೆಂಡರ್‌ನಲ್ಲಿ ಮುಂಬರುವ ದಿನಗಳು:', ' पूर्वानुमान कैलेंडर में आने वाले दिन:') : '')
      if (ev.length) cards.push({ type: 'events', events: ev.slice(0, 5) })
      sources.push('kb', 'forecast')
      break
    }

    case 'weather_heat': {
      const w = await getWeather()
      const adv = heatAdvice(w.feelsC)
      text = tr(lang,
        `${w.live ? 'Now' : 'Typical for this month'}: ${w.tempC}°C, feels like ${w.feelsC}°C${w.rainPct != null ? `, ${w.rainPct}% chance of rain this hour` : ''}. ${adv.en}`,
        `${w.live ? 'ಈಗ' : 'ಈ ತಿಂಗಳ ಸಾಮಾನ್ಯ'}: ${w.tempC}°C, ಅನುಭವ ${w.feelsC}°C${w.rainPct != null ? `, ಈ ಗಂಟೆಯಲ್ಲಿ ಮಳೆಯ ಸಾಧ್ಯತೆ ${w.rainPct}%` : ''}. ${adv.kn}`,
        `${w.live ? 'अभी' : 'इस महीने सामान्य'}: ${w.tempC}°C, महसूस ${w.feelsC}°C${w.rainPct != null ? `, इस घंटे बारिश की संभावना ${w.rainPct}%` : ''}। ${adv.hi}`)
      sources.push(w.live ? 'open-meteo' : 'climate-normals')
      break
    }

    case 'accessibility': {
      const easy = PLACES.filter((p) => !p.visit.stairs && p.visit.wheelchair !== 'no').slice(0, 5)
      const f = faq('accessibility')
      text = (f?.a[lang] ?? '') + tr(lang, ' Step-free options: ', ' ಮೆಟ್ಟಿಲು ಇಲ್ಲದ ಆಯ್ಕೆಗಳು: ', ' बिना सीढ़ी वाले विकल्प: ') + easy.map((p) => p.name[lang] ?? p.name.en).join(', ') + '.'
      sources.push('kb')
      break
    }

    case 'shopping_crafts': text = faq('crafts')?.a[lang] ?? ''; cards.push({ type: 'place', id: 'ilkal' }, { type: 'link', to: '/local', label: { en: 'Meet local artisans', kn: 'ಸ್ಥಳೀಯ ಕುಶಲಕರ್ಮಿಗಳು', hi: 'स्थानीय कारीगर' } }); sources.push('dtdc_book'); break
    case 'guide': text = faq('guides')?.a[lang] ?? ''; cards.push({ type: 'link', to: '/local', label: { en: 'Find a local guide', kn: 'ಸ್ಥಳೀಯ ಮಾರ್ಗದರ್ಶಿ ಹುಡುಕಿ', hi: 'स्थानीय गाइड खोजें' } }); sources.push('dtdc_book'); break
    case 'adventure': text = faq('adventure')?.a[lang] ?? ''; cards.push({ type: 'place', id: 'yadahalli' }); sources.push('dtdc_book'); break
    case 'official_office': text = faq('tourism_office')?.a[lang] ?? ''; cards.push({ type: 'link', to: '/safety', label: { en: 'Call the tourism office', kn: 'ಪ್ರವಾಸೋದ್ಯಮ ಕಚೇರಿಗೆ ಕರೆ ಮಾಡಿ', hi: 'पर्यटन कार्यालय को कॉल करें' } }); sources.push('district_site'); break
    case 'official_reach': text = faq('reach_bagalkot')?.a[lang] ?? ''; cards.push({ type: 'link', to: '/plan', label: { en: 'Plan the day once you arrive', kn: 'ತಲುಪಿದ ಮೇಲೆ ದಿನದ ಯೋಜನೆ', hi: 'पहुँचकर दिन की योजना बनाएँ' } }); sources.push('district_site'); break
  }

  if (intent === 'fallback' || !text) {
    const hits = search(question, { lang, k: 2 })
    const top = hits[0]?.doc
    if (top && hits[0].score > 0.08) {
      if (top.kind === 'place') { const p = placeById[top.ref]; text = p.summary[lang] ?? p.summary.en; cards.push({ type: 'place', id: p.id }) }
      else if (top.kind === 'sculpture') { const s = sculptureById[top.ref]; text = `${s.name[lang] ?? s.name.en}: ${s.text[lang] ?? s.text.en}`; cards.push({ type: 'sculpture', id: s.id }) }
      else { const f = FAQS.find((x) => x.id === top.ref)!; text = f.a[lang] ?? f.a.en }
      sources.push('kb')
    } else {
      text = tr(lang, 'I am not sure I understood. You can ask about a place, crowds, parking, food, stays, routes or safety.', 'ನನಗೆ ಸರಿಯಾಗಿ ಅರ್ಥವಾಗಲಿಲ್ಲ. ಸ್ಥಳ, ಜನಸಂದಣಿ, ಪಾರ್ಕಿಂಗ್, ಊಟ, ವಸತಿ, ದಾರಿ ಅಥವಾ ಸುರಕ್ಷತೆಯ ಬಗ್ಗೆ ಕೇಳಬಹುದು.', 'मैं ठीक से समझ नहीं पाया। आप किसी जगह, भीड़, पार्किंग, खाना, ठहरना, रास्ता या सुरक्षा के बारे में पूछ सकते हैं।')
    }
  }

  track({ kind: 'ask', key: intent, lang, place })
  return { text: text.trim(), lang, intent, confidence: r.confidence, cards, sources: [...new Set(sources)], suggestions: suggestionsFor(intent, lang, place) }
}

function suggestionsFor(intent: string, lang: Lang, place?: string) {
  const p = place && placeById[place] ? nm(place, lang) : nm('pattadakal', lang)
  const S: Record<Lang, string[]> = {
    en: [`Is ${p} crowded now?`, `Parking at ${p}`, `Veg food near ${p}`, 'Plan my day', 'Who is the 18-armed Nataraja?'],
    kn: [`${p} ನಲ್ಲಿ ಈಗ ಜನ ಜಾಸ್ತಿ ಇದ್ದಾರಾ?`, `${p} ಪಾರ್ಕಿಂಗ್`, `${p} ಹತ್ತಿರ ಸಸ್ಯಾಹಾರಿ ಊಟ`, 'ನನ್ನ ದಿನದ ಯೋಜನೆ ಮಾಡಿ', '18 ಕೈಗಳ ನಟರಾಜ ಯಾರು?'],
    hi: [`क्या ${p} में अभी भीड़ है?`, `${p} में पार्किंग`, `${p} के पास शाकाहारी खाना`, 'मेरे दिन की योजना बनाइए', '18 भुजाओं वाले नटराज कौन हैं?'],
  }
  const drop: Record<string, number> = { best_time_crowd: 0, parking: 1, food: 2, itinerary: 3, sculpture: 4 }
  return S[lang].filter((_, i) => i !== drop[intent]).slice(0, 3)
}
