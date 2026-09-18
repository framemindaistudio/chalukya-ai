# Chalukya AI · ಚಾಲುಕ್ಯ AI

**One offline-first AI companion for every tourist journey in Bagalkot district, and one command
centre for the people who run it.**

Built for *AI to Redesign Tourism: Bagalkot 2026* (inter-college AI project competition, 24 Sept 2026),
on the World Tourism Day 2026 theme *"Digital Agenda and Artificial Intelligence to Redesign Tourism"*.

It covers all six problem statements in one product, instead of six disconnected demos:

| Problem statement | What Chalukya AI does | AI inside |
|---|---|---|
| **PS 07** Chalukyan sculpture identification | Photograph a sculpture or temple → name, story, audio narration, location; says "not sure" instead of guessing; site-level answer when unsure between neighbouring temples; Grad-CAM "why" | EfficientNet-B0 transfer learning, ONNX on the phone (offline) |
| **PS 12** Multilingual voice assistant | Speak or type in Kannada, Hindi, English or romanised text; answers in the same language, read aloud, with live data cards and sources | Hybrid intent model (char n-grams + curated lexicon + multilingual-e5), tool-using answer composer grounded in a verified KB |
| **PS 18** Hotel recommendation | Budget, distance to *your* itinerary, must-have amenities, priorities → ranked list with "why this" | Multi-criteria hybrid ranking + Bayesian rating + inclusive-growth boost + diversity (MMR) re-rank |
| **PS 19** Local restaurant recommendation | Veg / non-veg, budget for two, cuisine, "jolada rotti meals", open now | Same explainable ranker; diet inferred from names where obvious |
| **PS 25** Tourist safety alerts | Hold-to-SOS with location, geofenced caution zones, missed check-in alarm, live heat index, CCTV people counting (privacy-blurred), IoT anomaly detection → command centre in real time | Person detector (Faster R-CNN), robust z-score anomaly detection, forecast-driven overcrowding alerts |
| **PS 21** Smart parking prediction | Live free slots per lot + predicted free slots on arrival | LightGBM 30/60/120-min forecasts; a 120-tree version runs on the phone |
| **Open innovation** | Crowd-aware trip planner; 7-day water/waste/staff planning; Local Business Portal; offline PWA | LightGBM footfall forecasting with conformal intervals; exhaustive route optimisation |

## Results (honest numbers)

| Model | Test design | Result | Baseline |
|---|---|---|---|
| Sculpture recognition (25 classes, 1,960 CC-licensed photos from 202 photographers) | photographer-held-out test set (344 photos) | **85.8 % top-1**, 91.9 % top-3, **98.0 % correct site**, macro-F1 0.83 | — |
| … with the "not sure" rule | same | answers 79 % of photos at **95.6 % accuracy**; rejects 82 % of non-Chalukyan photos (n = 33) | — |
| Footfall forecast (6 sites) | time-based hold-out, Jan–Aug 2026 | **WAPE 13.1 %**; festival days 14.9 % | same-day-last-year 31.1 % (42.7 % on festivals) |
| Forecast intervals | same | 79.2 % coverage for a nominal 80 % band (conformal) | — |
| Parking (6 lots) | winter peak season hold-out | **±3.5 slots at 2 h ahead**; "lot full" alerts 81 % precise | "stays the same": ±7.9 |
| Intent understanding (17 intents, 3 languages + romanised) | unseen phrasings / fresh test set | server hybrid **95.8 % / 88.6 %**; phone-only 91.2 % / 78.6 % | char model alone 51.7 % / 68.6 % |

Full reports: `ml/vision/out/efficientnet_b0/`, `ml/forecast/out/`, `ml/assistant/out/`.

## What is real and what is simulated

**Real:** 1,960 monument photos (Wikimedia Commons, CC licences, credits in `ml/vision/data/metadata.csv`);
ASI annual footfall (Badami 4,44,542 · Pattadakal 3,24,615 · Durga temple Aihole 2,13,901); OpenStreetMap
places, hospitals and road network (OSRM); facts cross-checked against the District Tourism Development
Committee's book *Sounds and Emotions* (2022, paraphrased); Open-Meteo live weather.

**Simulated (and labelled in the app):** the daily/hourly shape of footfall (calibrated so the annual totals
match ASI exactly), parking sensor streams, business prices/ratings/hours. Every pipeline retrains unchanged
on real ticket-counter or sensor data.

## Run it

```bash
# one click on Windows
START_DEMO.bat
# or manually
.venv\Scripts\python -m server        # web app + APIs on :8300 (https :8443 for phones)
.venv\Scripts\python iot\simulator.py # IoT stream (or flash iot/parking_node to an ESP32)
```
Open `http://localhost:8300` (tourist app) and `http://localhost:8300/command` (district command centre).
Phones on the same Wi-Fi: use the https address the server prints (accept the certificate once; needed for mic and GPS).

Without the server, `cd web && npm run dev` still runs the whole app: vision, intent, recommenders,
forecasts, planner and parking model all run on the device.

## Repository map

```
ml/vision/      dataset builder, photographer-grouped split, training, open-set calibration, Grad-CAM (server)
ml/forecast/    calendar features, calibrated simulator, footfall + parking models (+ phone export)
ml/assistant/   trilingual intent data, lexicon, training + comparison, fresh test set
ml/kb/          curated knowledge base (en / ಕನ್ನಡ / हिन्दी) with sources
ml/data/        OpenStreetMap businesses, OSRM distances, photos with credits, CCTV samples
web/            React + TypeScript PWA (tourist app + command centre)
server/         FastAPI: WebSocket alerts, IoT ingest + anomaly detection, vision, intent, people counting, TTS
iot/            ESP32 firmware (parking, safety) and a simulator
docs/           pitch, demo script, judges' Q&A, registration answers
```

## Credits
Photos: Wikimedia Commons contributors (see `ml/vision/data/metadata.csv` and `web/src/data/photo_credits.json`).
Map data © OpenStreetMap contributors. Weather: Open-Meteo. Footfall totals: Archaeological Survey of India.
Reference: District Tourism Development Committee, Bagalkote, *Sounds and Emotions* (2022).
Kannada and Hindi text should be reviewed by a native speaker before public release.
