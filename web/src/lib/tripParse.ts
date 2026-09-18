import { findPlaces } from './intent'
import type { Interest, Mobility, Mode, PlanInput } from './itinerary'
import { now } from './clock'

/*
  Turns a free-text trip request into planner inputs, in English, Kannada, Hindi or romanised text:
    "I am in Badami. I have 6 hours, ₹3,000 budget, two children, and I like history."
    "ನಾನು ಬಾದಾಮಿಯಲ್ಲಿದ್ದೇನೆ, 5 ಗಂಟೆ ಇದೆ, ಇಬ್ಬರು ಮಕ್ಕಳು, ಇತಿಹಾಸ ಇಷ್ಟ"
    "हम पट्टदकल में हैं, 4 घंटे हैं, बजट 2000"
  Every extracted field is returned with the words that produced it, so the app can show what it understood.
*/
const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5,
  ಒಂದು: 1, ಎರಡು: 2, ಮೂರು: 3, ನಾಲ್ಕು: 4, ಐದು: 5, ಆರು: 6, ಏಳು: 7, ಎಂಟು: 8, ಒಬ್ಬ: 1, ಇಬ್ಬರು: 2, ಮೂವರು: 3, ನಾಲ್ವರು: 4,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, सात: 7, आठ: 8,
  ondu: 1, eradu: 2, ibbaru: 2, mooru: 3, do: 2, teen: 3, char: 4,
}
const N = '(\\d+(?:\\.\\d+)?|' + Object.keys(NUM_WORDS).join('|') + ')'
const num = (s: string) => (isNaN(Number(s)) ? NUM_WORDS[s.toLowerCase()] ?? NaN : Number(s))

const INTERESTS: [RegExp, Interest][] = [
  [/(histor|architect|heritage|temple|sculpt|cave|monument|carving|ಇತಿಹಾಸ|ವಾಸ್ತು|ದೇವಾಲಯ|ಶಿಲ್ಪ|ಗುಹೆ|ಸ್ಮಾರಕ|इतिहास|वास्तु|मंदिर|मूर्ति|गुफा|स्मारक|itihas|guhe)/i, 'heritage'],
  [/(pilgrim|devot|pooja|puja|darshan|worship|ತೀರ್ಥ|ಪೂಜೆ|ದರ್ಶನ|भक्ति|तीर्थ|पूजा|दर्शन)/i, 'pilgrimage'],
  [/(nature|lake|sunset|wildlife|bird|trek|climb|adventure|view|ಪ್ರಕೃತಿ|ಕೆರೆ|ಸೂರ್ಯಾಸ್ತ|ಸಾಹಸ|प्रकृति|झील|सूर्यास्त|एडवेंचर)/i, 'nature'],
  [/(shop|saree|sari|craft|weav|food|eat|sweet|ಸೀರೆ|ಕರಕುಶಲ|ಊಟ|ಶಾಪಿಂಗ್|साड़ी|हस्तशिल्प|खाना|खरीदारी)/i, 'crafts'],
]

export type ParsedTrip = { input: PlanInput; understood: { key: string; value: string }[] }

export function parseTrip(text: string): ParsedTrip {
  const t = text.toLowerCase().replace(/(\d),(\d)/g, '$1$2').replace(/,/g, ' ')   // "₹3,000" -> "₹3000"
  const understood: ParsedTrip['understood'] = []
  const at = now()

  // time available
  let hours: number | undefined, days = 1
  const h = t.match(new RegExp(N + '\\s*(hours?|hrs?|h\\b|ಗಂಟೆ|घंटे|घंटा|ghante|gante)'))
  const d = t.match(new RegExp(N + '\\s*(days?|ದಿನ|दिन|dina|din)'))
  if (d && num(d[1]) >= 1) { days = Math.min(3, Math.round(num(d[1]))); understood.push({ key: 'days', value: String(days) }) }
  else if (h) { hours = Math.min(12, num(h[1])); understood.push({ key: 'time', value: `${hours} h` }) }
  else if (/(half day|ಅರ್ಧ ದಿನ|आधा दिन)/.test(t)) { hours = 5; understood.push({ key: 'time', value: '5 h' }) }
  else if (/(full day|whole day|ಇಡೀ ದಿನ|पूरा दिन)/.test(t)) understood.push({ key: 'time', value: 'full day' })

  // budget
  const b = t.match(/(?:₹|rs\.?|inr|rupees?|budget|ಬಜೆಟ್|ರೂ\.?|बजट|रुपये|रु\.?)\s*(\d{3,6})|(\d{3,6})\s*(?:₹|rs|rupees?|ರೂಪಾಯಿ|ರೂ|रुपये|रु)/)
  const budget = b ? Number(b[1] ?? b[2]) : undefined
  if (budget) understood.push({ key: 'budget', value: `₹${budget.toLocaleString('en-IN')}` })

  // who is travelling
  const kidsM = t.match(new RegExp(N + '\\s*(children|child|kids?|ಮಕ್ಕಳು|ಮಗು|बच्चे|बच्चा|makkalu|bacche)'))
  let kids = kidsM ? num(kidsM[1]) : /(children|kids|ಮಕ್ಕಳು|बच्चे|makkalu)/.test(t) ? 2 : 0
  if (isNaN(kids)) kids = 2
  const adultsM = t.match(new RegExp(N + '\\s*(adults?|people|persons?|members|ಜನ|लोग|log)'))
  const adults = adultsM ? num(adultsM[1]) : /(family|ಕುಟುಂಬ|परिवार)/.test(t) || kids ? 2 : /(couple|wife|husband|ಪತ್ನಿ|पत्नी)/.test(t) ? 2 : 1
  const group = /\b(we|us|our)\b/.test(t) || /(ನಾವು|ನಮ್ಮ|ನಮಗೆ|हम|हमारे|हमें)/.test(t)
  const elder = /(grand(mother|father|ma|pa)|parents|ಅಜ್ಜ|ಅಜ್ಜಿ|ಅಪ್ಪ|ಅಮ್ಮ|दादा|दादी|नाना|नानी|माता|पिता)/.test(t)
  const people = Math.max(group || elder ? 2 : 1, (isNaN(adults) ? 2 : adults) + kids + (elder && !adultsM ? 1 : 0))
  if (kids) understood.push({ key: 'children', value: String(kids) })
  understood.push({ key: 'people', value: String(people) })

  let mobility: Mobility = 'normal'
  if (/(wheelchair|ಗಾಲಿಕುರ್ಚಿ|व्हीलचेयर)/.test(t)) mobility = 'wheelchair'
  else if (/(elder|senior|old parents|grand(mother|father|ma|pa)|ಹಿರಿಯ|ಅಜ್ಜ|ಅಜ್ಜಿ|बुज़ुर्ग|बुजुर्ग|दादा|दादी|नाना|नानी)/.test(t)) mobility = 'senior'
  if (mobility !== 'normal') understood.push({ key: 'mobility', value: mobility })

  // interests
  const interests = INTERESTS.filter(([re]) => re.test(t)).map(([, i]) => i)
  if (!interests.length) interests.push('heritage')
  understood.push({ key: 'interests', value: interests.join(', ') })

  // transport
  const mode: Mode = /(bus|ksrtc|ಬಸ್|बस)/.test(t) ? 'bus' : /(bike|scooter|two.?wheeler|ಬೈಕ್|बाइक)/.test(t) ? 'bike' : 'car'
  understood.push({ key: 'transport', value: mode })

  // starting point
  const pl = findPlaces(text)[0]
  const startFrom = !pl || pl === 'badami' ? 'badami_bus_stand' : pl === 'bagalkot' ? 'bagalkot_town' : pl
  understood.push({ key: 'from', value: startFrom === 'badami_bus_stand' ? 'Badami town' : startFrom === 'bagalkot_town' ? 'Bagalkot' : startFrom })

  // when: now if the sites are open (or "tomorrow")
  const tomorrow = /\b(tomorrow|naale|kal)\b/.test(t) || /(ನಾಳೆ|(^|\s)कल(\s|$))/.test(t)
  const start = new Date(at)
  let startMin = at.getHours() * 60 + at.getMinutes()
  if (tomorrow || startMin > 16 * 60 + 30) { start.setDate(start.getDate() + 1); startMin = 8 * 60; understood.push({ key: 'when', value: 'tomorrow 8 AM' }) }
  else { startMin = Math.max(6 * 60 + 30, Math.ceil(startMin / 15) * 15 + 10); understood.push({ key: 'when', value: 'now' }) }

  return { input: { start, days, interests, mobility, mode, people, startFrom, startMin, hours, kids, budget }, understood }
}
