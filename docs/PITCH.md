# Pitch + live demo script (5 min talk · 3 min demo · 2 min Q&A)

Rehearse this at least four times with a timer. Speak slowly. Every number below is real and traceable.

## Before you walk in (checklist)
- Laptop on charger. Run `START_DEMO.bat` 10 minutes before. Two windows: the tourist app on the phone,
  and `/command` on the projector.
- Phone on the laptop's hotspot/Wi-Fi, app open at the https address. **Open Scan once** so the model is cached.
- Keep 3 photos on the phone: a Badami cave sculpture (e.g. Nataraja), the Durga temple, and a
  non-Chalukyan temple (Hampi) for the "not sure" moment. Use your own shots if you have them.
- Airplane-mode trick ready: the scan must still work with Wi-Fi off.
- Language: open in **ಕನ್ನಡ** first. Judges in Bagalkot will feel it.

## Talk (5 minutes)

**1. The hook (30 s)**
"Bagalkot has a UNESCO World Heritage Site, the birthplace of Indian temple architecture, and nearly
10 lakh ticketed visits a year. That figure is from ASI. But stand inside Badami Cave 3 and ask:
who is this? Is it too crowded to climb now? Where do I park? Where can I eat jolada rotti? There is
no one to ask, and often no signal."

**2. What we built (45 s)**
"Chalukya AI is one companion for the whole tourist journey, and one command centre for the district.
It covers all six problem statements: sculptures, voice, hotels, food, safety and parking. They sit on
one shared data layer, because a tourist doesn't live six separate problems. They live one day."

**3. The AI, with proof (2 min).** Show the How-the-AI-works page or the slide.
- Vision: "We trained on 1,960 freely licensed photos from 202 photographers. We tested on photographers
  the model never saw, so near-duplicate photos can't inflate the score. Result: **85.8 %** exact sculpture,
  **98 %** correct site. And when it isn't sure, it says so: answered photos are **95.6 %** correct."
- Forecast: "We anchored to real ASI annual footfall. Our model's error is **13 %**, against **31 %** for
  'same day last year'. On festival days it is **15 % against 43 %**."
- Parking: "Two hours ahead it is within **±3.5 slots**. The naive guess is ±7.9."
- Language: "It understands Kannada, Hindi, English and even romanised Kannada. It answers only from
  verified sources, so it cannot invent history."

**4. Inclusive and sustainable (45 s)**
"Recommendations give small local businesses a fair boost and explain every choice. Owners keep their
own prices current through the Local Business Portal. The command centre turns forecasts into litres of
water, kilograms of waste and the number of Pravasi Mitras needed next Sunday."

**5. Honesty + scale (30 s)**
"Daily footfall and sensors are simulated for this prototype, calibrated to ASI totals and labelled in the
app. Plug in the ticket-counter data and the same pipeline retrains. It runs on a phone and a laptop:
no GPU, no paid API."

## Live demo (3 minutes)
1. **Home in Kannada (20 s):** the circuit line, Badami → Pattadakal → Aihole, live crowd rings and free parking.
2. **Scan (40 s):** photograph the Nataraja printout or photo. Show the answer, then "Listen" in Kannada.
   **Turn on airplane mode, scan again.** It still works. Then show the Hampi photo: "Not sure".
3. **Ask by voice (40 s):** say in Kannada: *"ಪಟ್ಟದಕಲ್ಲು ಹತ್ತಿರ ಸಸ್ಯಾಹಾರಿ ಊಟ ಎಲ್ಲಿ ಸಿಗುತ್ತದೆ?"*
   Then in Hindi: *"बादामी में पार्किंग खाली है क्या?"*
4. **Plan (30 s):** 1 day, temples, "With elders". Point out: caves at 7 AM before the heat, Bhutanatha at sunset.
5. **SOS → command centre (50 s):** hold SOS on the phone. It appears on the projector with the location.
   Click **Respond**, and the phone turns green: "Control room is responding". Finish with the CCTV counter
   (privacy blur) and "Dasara rush" in the scenario simulator.

## Closing line
"Six problem statements, one app. It works in the cave with no signal, speaks Kannada, and hands the district a
live view of its heritage. We'd love to pilot it at Badami this Dasara."
