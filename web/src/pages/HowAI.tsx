import { Camera, CarFront, Database, LineChart, MessageSquareHeart, MessagesSquare, ScanText, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, Eyebrow, PageHead } from '../components/ui'
import { METRICS } from '../lib/data'
import { useLang } from '../lib/i18n'

const pct = (x?: number) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)

function Model({ icon, title, problem, how, children }: { icon: ReactNode; title: string; problem: string; how: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lake-soft text-lake">{icon}</span>
        <div><div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{problem}</div><h2 className="display text-[21px] leading-tight">{title}</h2></div>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{how}</p>
      <div className="mt-3">{children}</div>
    </Card>
  )
}
function Stat({ v, l, good }: { v: string; l: string; good?: boolean }) {
  return <div className="rounded-xl bg-mist px-3 py-2"><div className={`num text-[22px] font-bold leading-none ${good ? 'text-lake' : 'text-ink'}`}>{v}</div><div className="mt-1 text-[11.5px] leading-tight text-ink-3">{l}</div></div>
}

export default function HowAI() {
  const { lang } = useLang()
  const v = METRICS.vision, vo = METRICS.vision_openset, f = METRICS.footfall, p = METRICS.parking, it = METRICS.intent, rv = METRICS.reviews
  return (
    <div>
      <PageHead title={lang === 'kn' ? 'AI ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ' : lang === 'hi' ? 'AI कैसे काम करता है' : 'How the AI works'} sub="Five models trained for Bagalkot, five open models put to work, one verified knowledge base, and an honest account of what is real data and what is simulated." />
      <div className="space-y-4 px-4">
        <Model icon={<Camera size={20} />} problem="PS 07 · Heritage" title="Sculpture & monument recognition"
          how={`Transfer learning: an ImageNet-pretrained EfficientNet-B0 fine-tuned on ${v ? v.n_train + v.n_val + v.n_test : '~1,960'} freely licensed Wikimedia Commons photos of 25 Chalukyan sculptures and monuments. Tested on photographers the model never saw, so near-duplicate shots cannot inflate the score. Exported to ONNX; it runs on the phone, offline. The live lens runs the same model on the camera feed several times a second and only names what has held steady across frames.`}>
          <div className="grid grid-cols-2 gap-2">
            <Stat v={pct(v?.test_top1)} l="top-1 accuracy (held-out photographers)" good />
            <Stat v={pct(v?.test_top3)} l="correct answer in top 3" />
            <Stat v={pct(v?.test_site_accuracy)} l="correct site (Badami / Pattadakal / Aihole)" good />
            <Stat v={pct(vo?.test?.accuracy_when_answered)} l={`accuracy when confident (answers ${pct(vo?.test?.answered)})`} good />
          </div>
          <p className="mt-2 text-[12.5px] text-ink-2">Says “not sure” instead of guessing: rejects {pct(vo?.ood?.rejected)} of non-Chalukyan photos (Hampi, Belur, food, streets; n={vo?.ood?.n}). Weakest: telling neighbouring Pattadakal temples apart from wide shots; the app then answers at site level.</p>
          <img src="/img/ai/confusion.png" alt="Confusion matrix of the sculpture model on the held-out test set" className="mt-3 w-full rounded-xl border border-line" loading="lazy" />
        </Model>

        <Model icon={<LineChart size={20} />} problem="Sustainable planning" title="Visitor footfall forecasting"
          how="LightGBM on calendar features (weekday, season, festivals such as Dasara, Deepavali and the Banashankari jatre, school vacations, ASI free-entry days), with P10–P90 intervals calibrated by conformal prediction. Trained on daily data simulated to match ASI's published annual footfall exactly (Badami 4.45 lakh, Pattadakal 3.25 lakh, Aihole 2.14 lakh)." >
          <div className="grid grid-cols-3 gap-2">
            <Stat v={pct(f?.wape?.lightgbm)} l="error (WAPE), our model" good />
            <Stat v={pct(f?.wape?.seasonal_naive)} l="“same day last year”" />
            <Stat v={pct(f?.wape?.month_weekday_avg)} l="monthly average" />
          </div>
          <p className="mt-2 text-[12.5px] text-ink-2">On festival days: {pct(f?.wape_on_festival_days?.lightgbm)} vs {pct(f?.wape_on_festival_days?.seasonal_naive)} for the baseline. Interval coverage {pct(f?.p10_p90_interval_coverage)} (target 80%).</p>
          <img src="/img/ai/footfall_test.png" alt="Forecast versus actual for Badami caves in the test period" className="mt-3 w-full rounded-xl border border-line" loading="lazy" />
        </Model>

        <Model icon={<CarFront size={20} />} problem="PS 21 · Smart mobility" title="Parking availability prediction"
          how="IoT slot sensors (ESP32 + ultrasonic) report every 10 minutes. LightGBM predicts occupancy 30, 60 and 120 minutes ahead from the current count, its trend, time, calendar and the day's footfall forecast. Tested on the winter peak season, when lots actually fill.">
          <div className="grid grid-cols-3 gap-2">
            {p && Object.entries(p.horizons).map(([h, x]: [string, any]) => <Stat key={h} v={`±${x.mae_slots_model}`} l={`slots error at ${h} (vs ±${x.mae_slots_persistence})`} good />)}
          </div>
          {p && <p className="mt-2 text-[12.5px] text-ink-2">“Lot will be full” alerts are right {pct(p.horizons['60min']?.lot_full_precision)} of the time an hour ahead.</p>}
        </Model>

        <Model icon={<MessagesSquare size={20} />} problem="PS 12 · Tourist assistance" title="Multilingual voice assistant"
          how="Speech → intent → tools → answer. Intent is a hybrid of a character n-gram model (runs on the phone), a curated Kannada/Hindi/English lexicon and multilingual-e5 sentence embeddings (server). Answers are composed only from the forecast/parking/recommender outputs and the verified knowledge base, so it cannot invent history.">
          {it && (
            <table className="num w-full text-[13px]">
              <thead><tr className="text-left text-ink-3"><th className="font-medium">Approach</th><th className="font-medium">unseen</th><th className="font-medium">fresh</th></tr></thead>
              <tbody>{Object.entries(it.results).map(([k, x]: [string, any]) => <tr key={k} className="border-t border-line"><td className="py-1.5 pr-2">{k}</td><td>{pct(x.unseen_templates)}</td><td className={k.includes('server') ? 'font-bold text-lake' : ''}>{pct(x.fresh_test)}</td></tr>)}</tbody>
            </table>
          )}
          <p className="mt-2 text-[12px] text-ink-3">“Unseen” = phrasings held out by template; “fresh” = a separately written test set incl. romanised and speech-style questions.</p>
        </Model>

        <Model icon={<ScanText size={20} />} problem="Heritage · Language access" title="Heritage board reader"
          how="Photograph an information board in Kannada, Hindi or English. Tesseract LSTM reads all three scripts on the phone, offline. The text is matched to the verified knowledge base (the name on the board's heading line, in any script), so the tourist gets the monument's story in their language with no network. With the district server, Meta's NLLB-200 translates the full board into English, Kannada, Hindi, Marathi, Telugu or Tamil.">
          <div className="grid grid-cols-3 gap-2">
            <Stat v="4 / 4" l="real ASI boards matched to the right monument or site" good />
            <Stat v="3.9×" l="faster translation after int8 quantization" />
            <Stat v="~6 s" l="to the first translated sentence (streamed)" />
          </div>
          <p className="mt-2 text-[12.5px] text-ink-2">Monument names are protected with a glossary from the knowledge base: without it, NLLB turned ಪಟ್ಟದಕಲ್ಲು into “the stone” (kal = stone). OCR noise from the board's edges is cleaned before translation. Only 4 boards tested so far, so treat 4/4 as a demonstration, not an accuracy figure.</p>
        </Model>

        <Model icon={<MessageSquareHeart size={20} />} problem="Department dashboard" title="Review sentiment & complaint topics"
          how="Visitors rate a site in any language, by text or voice. The model finds the sentiment and what the complaint is about (toilets, drinking water, parking, cleanliness, guides, safety, crowding…), and the command centre shows which site needs what.">
          <div className="grid grid-cols-2 gap-2">
            <Stat v={pct(rv?.sentiment_accuracy?.e5_server)} l="sentiment accuracy, multilingual-e5 (fair number)" good />
            <Stat v={pct(rv?.aspect_f1_precision_recall?.lexicon_plus_e5_server?.[0])} l="complaint-topic F1" />
          </div>
          <p className="mt-2 text-[12.5px] text-ink-2">Small team-written data (89 training, 30 test reviews in four scripts/styles). The phone's lexicon model scores {pct(rv?.sentiment_accuracy?.char_plus_polarity_lexicon_phone)}, but we wrote both its word lists and the test set, so we report the e5 number.</p>
        </Model>

        <Model icon={<Sparkles size={20} />} problem="PS 18 & 19 · Hospitality, food" title="Explainable recommenders"
          how="Hybrid multi-criteria ranking: budget fit, distance to the places you will visit, amenity or cuisine match, a Bayesian-smoothed rating, and a small boost for locally owned businesses, then a diversity re-rank so the top results are not one street or one chain. Every result shows why it was picked.">
          <p className="text-[12.5px] text-ink-2">Names and locations are real (OpenStreetMap). Prices, ratings and hours are simulated until owners maintain them through the Local Business Portal.</p>
        </Model>

        <Model icon={<ShieldCheck size={20} />} problem="PS 25 · Safety" title="Tourist safety system"
          how="SOS with location, geofenced caution zones, missed check-in alerts, live heat index from Open-Meteo, overcrowding alerts from the forecast and CCTV people counts, and anomaly detection on IoT sensor streams. Everything reaches the district command centre in real time.">
          <p className="text-[12.5px] text-ink-2">Try it: open the command centre on a laptop and press SOS on a phone.</p>
        </Model>

        <Card className="p-4">
          <div className="flex items-center gap-2"><Database size={18} className="text-lake" /><Eyebrow>Data: what is real, what is simulated</Eyebrow></div>
          <ul className="mt-2 space-y-1.5 text-[13.5px]">
            <li><b className="text-lake">Real:</b> 1,960 CC-licensed monument photos (202 photographers); ASI annual footfall; OpenStreetMap places, hospitals, roads (OSRM distances); district tourism book facts (paraphrased); the District Administration's tourism pages and tourism office contact; photos of real ASI information boards; Open-Meteo weather.</li>
            <li><b className="text-[#8a6412]">AI-enhanced:</b> the home-screen photos are real Commons photographs, relit and upscaled to 4K with an image model (Nano Banana 2). The architecture is unchanged and the credit line says so.</li>
            <li><b className="text-sand">Simulated:</b> daily/hourly footfall shape, parking sensor streams, business prices and ratings. Clearly labelled in the app; each pipeline retrains unchanged on real data.</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
