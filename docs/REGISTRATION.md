# Registration form answers (copy-paste)

**Problem selected:** Open Innovation: AI-based Tourism Problem
*(Chalukya AI covers PS 07, 12, 18, 19, 21 and 25 in one platform. If the form allows only a numbered
problem, choose 07, AI Identification of Chalukyan Sculptures, and say the rest are integrated modules.)*

**Project title:** Chalukya AI: an offline-first AI companion and district command centre for Bagalkot tourism

**Problem statement**
Bagalkot has a UNESCO World Heritage Site (Pattadakal) and two of India's most important early temple sites
(Badami, Aihole), with about 9.8 lakh ticketed visits a year (ASI). Yet tourists face scattered information,
little in Kannada or Hindi, no idea of crowds or parking before arriving, harsh heat on cave steps, weak
mobile signal inside the caves, and no easy way to find local food, stays or artisans. The district has no
single live view of crowds, parking and safety incidents to plan staff, water and waste.

**Brief description of the proposed solution**
A mobile-first app (PWA) plus a command centre. Tourists can:
(1) photograph a sculpture and get its story in Kannada, Hindi or English, offline on the phone;
(2) ask a voice assistant anything in their language;
(3) get a crowd-, heat- and parking-aware day plan;
(4) find explainable hotel and restaurant recommendations that favour local businesses;
(5) use SOS, geofence, check-in and heat alerts.
The district command centre sees live crowds against carrying capacity, 30-day forecasts, parking,
CCTV people counts, IoT sensor health and alerts, plus 7-day water, waste and staffing plans.

**AI / ML technology used**
Transfer learning (EfficientNet-B0, ONNX, on-device), open-set rejection and Grad-CAM explainability;
LightGBM forecasting with conformal prediction intervals; LightGBM parking prediction (phone-side model);
multilingual NLU (char n-gram logistic regression + multilingual-e5 embeddings + lexicon); retrieval-grounded
answer generation; multi-criteria recommender with MMR diversity; Faster R-CNN person counting; robust
z-score anomaly detection; exhaustive route optimisation.

**IoT / hardware used**
ESP32 parking node (4 × HC-SR04 ultrasonic, LEDs) and safety node (PIR, DHT22, ultrasonic, buzzer, panic
button) posting to the server; a software simulator when hardware is absent.

**Software / tools used**
Python, PyTorch, timm, scikit-learn, LightGBM, sentence-transformers, ONNX Runtime (web + Python), FastAPI,
WebSockets, React + TypeScript + Vite + Tailwind, Leaflet (OpenStreetMap), Recharts, Arduino (ESP32),
Wikimedia Commons, OpenStreetMap / OSRM, Open-Meteo.

**Expected tourism impact**
Visitors spread across quieter hours and sites. Less parking circling and fewer turned-away cars.
Heritage explained in Kannada and Hindi to the majority of visitors. Measurable safety response
(SOS to acknowledgement). More spending with local eateries, weavers and guides. Data-driven planning
of water, waste and Pravasi Mitra deployment on festival days.

**Prototype status:** Working software prototype, with ESP32 firmware ready (hardware optional).
