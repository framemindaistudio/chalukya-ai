# Judges' questions: short, honest answers

Answer in two or three sentences, give one number, and offer to show it. Never claim more than the table in the README.

## Data & honesty
**Q: Is this real data?**
The photos, the ASI annual footfall, the OpenStreetMap places, roads and hospitals, and the weather are real.
The daily and hourly footfall shape and the parking sensor streams are simulated, calibrated so the annual
totals match ASI exactly, and the app labels simulated values. Give us ticket-counter data and the same
pipeline retrains without code changes.

**Q: Where did you get sculpture images?**
From Wikimedia Commons: 1,960 freely licensed photos from 202 photographers, sorted by the Commons categories
for each cave and temple. Every photo's author and licence is recorded.

**Q: How do you know the accuracy isn't inflated?**
We split by photographer. Photos by the same person of the same sculpture never appear in both train and test,
so near-duplicates can't leak. Test accuracy is 85.8 % on 344 unseen photos, and we report per-class results,
including the weak ones.

**Q: Where is it weak?**
Wide shots of neighbouring Pattadakal temples (Virupaksha, Mallikarjuna), because one photo often contains
several temples. The site is still right 98 % of the time, so the app answers at site level and asks for a
closer photo. Fix: more close-up photos collected on site.

**Q: What if someone photographs something else?**
It checks its own confidence (calibrated threshold 0.75). Below that, it says "not sure" and shows candidates.
On confident answers it is 95.6 % accurate, and it rejected 82 % of non-Chalukyan temple and street photos in
our test. That set is small, only 33 images, so we don't over-claim it.

## AI / ML choices
**Q: Why EfficientNet-B0, not a bigger model?**
It has 4 M parameters and a 16 MB file, so it runs on a mid-range phone in about 0.3 s with no internet.
Inside the caves there is often no signal, so on-device inference was a requirement, not a nice-to-have.

**Q: Why LightGBM for forecasting and not LSTM?**
Tourism demand here is driven by calendar effects: weekends, Dasara, Deepavali, the Banashankari jatre,
school holidays. Gradient boosting learns those from few years of daily data, trains in seconds and is easy
to explain. It halves the error of 'same day last year'. With years of hourly data, a sequence model becomes
worth comparing.

**Q: What is conformal prediction?**
A way to calibrate the uncertainty band. We checked, on held-out months, how often reality fell outside the
band and widened it until it covered about 80 %. We measured 79.2 %. So the planners' "likely range" is trustworthy.

**Q: Is the assistant a chatbot like ChatGPT?**
No, deliberately. It understands the question with a trained multilingual model, then calls tools: the
forecast, the parking model, the recommender, the knowledge base. It composes the answer from their outputs.
It cannot make up history, and it works offline. An LLM could be added later only to polish the language,
never to supply facts.

**Q: How does it understand Kannada?**
Character n-grams work across scripts and survive speech-to-text spelling errors. We add multilingual-e5
sentence embeddings on the server and a curated Kannada/Hindi/English keyword dictionary. On a separately
written test set, including romanised Kannada, it scores 88.6 % (78.6 % phone-only).

**Q: How are recommendations made? Isn't it just sorting by rating?**
It is a weighted score over budget fit, distance to the places *you* are visiting, amenity or cuisine match,
and a rating smoothed for few reviews. Locally owned places get a small boost, and a diversity step stops
one chain or one street filling the list. Each result shows its reasons.

## IoT & safety
**Q: Did you build hardware?**
The ESP32 firmware is written and wired for 4 ultrasonic slot sensors with LEDs, plus a safety node. For the
demo, a simulator streams the same messages. The server treats both identically and runs anomaly detection;
for example, a sensor stuck at zero raises an alert.

**Q: Privacy with cameras?**
Only counts leave the camera. Frames are blurred on screen and never stored. SOS shares location only when
the tourist presses it.

**Q: What happens after SOS?**
It reaches the command centre in real time with location, language and conditions. When an officer presses
Respond, the tourist's phone shows the control room is responding. Missed check-ins and geofence entries raise
alerts automatically.

## Feasibility & scale
**Q: What does it cost to run?**
It needs no GPU and no paid APIs. The models run on phones and one ordinary laptop or small cloud server.
Maps are OpenStreetMap, weather is Open-Meteo (free). The real costs are sensors (about ₹1,000 per 4 slots)
and staff time.

**Q: How would the district adopt it?**
Pilot at Badami caves parking plus the three ASI sites for one festival season, and feed in ASI ticket counts.
Pravasi Mitras use the command centre and local businesses self-register through the portal. The same design
extends to Hampi or any heritage district by adding photos and places.

**Q: What would you do with more time?**
Collect our own on-site photos (especially Pattadakal close-ups), connect real ticket data, add a crowd-density
model for festival days, and get native speakers to review all Kannada and Hindi text.

**Q: What is your own contribution versus libraries?**
Dataset curation and the leakage-free split. Training and calibration. The festival-aware calendar and ASI
calibration. The multilingual intent dataset and hybrid model. The phone-side model exports (ONNX, LightGBM
trees as JSON). The planner's optimisation. The whole product and command centre. Libraries provide
the building blocks; every pipeline and evaluation is ours.
