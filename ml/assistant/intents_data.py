"""
Training data for the assistant's intent classifier, in Kannada, Hindi, English and romanised
("Kanglish"/"Hinglish") forms, the way tourists actually type or speak.

Each template has an id. `{p}` is filled with place names in the same language, so one template
becomes several sentences. Evaluation uses GroupKFold on template ids, so the model is always
tested on phrasings it never saw.
"""

PLACES = {
    "en": ["Badami", "Pattadakal", "Aihole", "Mahakuta", "Banashankari", "Kudalasangama", "Badami caves", "Durga temple"],
    "kn": ["ಬಾದಾಮಿ", "ಪಟ್ಟದಕಲ್ಲು", "ಐಹೊಳೆ", "ಮಹಾಕೂಟ", "ಬನಶಂಕರಿ", "ಕೂಡಲಸಂಗಮ", "ಬಾದಾಮಿ ಗುಹೆ", "ದುರ್ಗಾ ದೇವಾಲಯ"],
    "hi": ["बादामी", "पट्टदकल", "ऐहोल", "महाकूट", "बनशंकरी", "कूडलसंगम", "बादामी गुफा", "दुर्गा मंदिर"],
    "rom": ["badami", "pattadakal", "aihole", "mahakuta", "banashankari", "kudala sangama", "badami guhe", "durga gudi"],
}

T = {
 "about_place": {
  "en": ["tell me about {p}", "what is special about {p}", "history of {p}", "who built {p}", "why is {p} famous", "what is there to see in {p}", "explain {p} to me", "when was {p} built", "{p} history please", "which dynasty built {p}"],
  "kn": ["{p} ಬಗ್ಗೆ ಹೇಳಿ", "{p} ಇತಿಹಾಸ ಏನು", "{p} ಯಾರು ಕಟ್ಟಿಸಿದರು", "{p} ಯಾಕೆ ಪ್ರಸಿದ್ಧ", "{p} ನಲ್ಲಿ ಏನು ನೋಡಬಹುದು", "{p} ವಿಶೇಷತೆ ಏನು", "{p} ಯಾವಾಗ ಕಟ್ಟಲಾಯಿತು"],
  "hi": ["{p} के बारे में बताइए", "{p} का इतिहास क्या है", "{p} किसने बनवाया", "{p} क्यों प्रसिद्ध है", "{p} में क्या देखने लायक है", "{p} कब बना था", "{p} की खासियत क्या है"],
  "rom": ["{p} bagge heli", "{p} itihasa enu", "{p} ke bare mein batao", "{p} kisne banaya", "{p} yaake famous", "{p} ka history"],
 },
 "sculpture": {
  "en": ["who is the god with eighteen arms", "what is nataraja", "tell me about the ardhanarishvara sculpture", "what does trivikrama mean", "which statue is this", "who is bahubali", "what is the varaha avatar", "meaning of harihara", "story of narasimha carving", "who is shown in this relief"],
  "kn": ["ಹದಿನೆಂಟು ಕೈಗಳ ದೇವರು ಯಾರು", "ನಟರಾಜ ಅಂದರೆ ಏನು", "ಅರ್ಧನಾರೀಶ್ವರ ಶಿಲ್ಪದ ಬಗ್ಗೆ ಹೇಳಿ", "ತ್ರಿವಿಕ್ರಮ ಅಂದರೆ ಏನು", "ಈ ವಿಗ್ರಹ ಯಾವುದು", "ಬಾಹುಬಲಿ ಯಾರು", "ವರಾಹ ಅವತಾರ ಏನು"],
  "hi": ["अठारह भुजाओं वाले देवता कौन हैं", "नटराज क्या है", "अर्धनारीश्वर मूर्ति के बारे में बताइए", "त्रिविक्रम का मतलब क्या है", "यह मूर्ति किसकी है", "बाहुबली कौन हैं", "वराह अवतार क्या है"],
  "rom": ["nataraja yaaru", "ee murti yaaru", "ye murti kiski hai", "harihara meaning", "trivikrama kathe", "bahubali kaun hai"],
 },
 "timings_entry": {
  "en": ["what are the timings of {p}", "when does {p} open", "is {p} open today", "ticket price for {p}", "entry fee at {p}", "what time does {p} close", "is {p} closed on friday", "do I need a ticket for {p}"],
  "kn": ["{p} ಸಮಯ ಏನು", "{p} ಯಾವಾಗ ತೆರೆಯುತ್ತದೆ", "{p} ಇಂದು ತೆರೆದಿದೆಯೇ", "{p} ಟಿಕೆಟ್ ಬೆಲೆ ಎಷ್ಟು", "{p} ಪ್ರವೇಶ ಶುಲ್ಕ ಎಷ್ಟು", "{p} ಎಷ್ಟು ಗಂಟೆಗೆ ಮುಚ್ಚುತ್ತದೆ"],
  "hi": ["{p} का समय क्या है", "{p} कब खुलता है", "क्या {p} आज खुला है", "{p} का टिकट कितने का है", "{p} में प्रवेश शुल्क कितना है", "{p} कितने बजे बंद होता है"],
  "rom": ["{p} timings", "{p} ticket yeshtu", "{p} kitne baje khulta hai", "{p} open idya", "{p} entry fee kitna"],
 },
 "best_time_crowd": {
  "en": ["when is the best time to visit {p}", "is {p} crowded now", "how busy is {p} today", "when will {p} be less crowded", "best hour to avoid crowd at {p}", "will {p} be crowded this sunday", "rush at {p} tomorrow", "quiet time to see {p}"],
  "kn": ["{p} ನೋಡಲು ಉತ್ತಮ ಸಮಯ ಯಾವುದು", "{p} ನಲ್ಲಿ ಈಗ ಜನ ಜಾಸ್ತಿ ಇದ್ದಾರಾ", "ಇಂದು {p} ಎಷ್ಟು ರಶ್ ಇದೆ", "{p} ನಲ್ಲಿ ಜನಸಂದಣಿ ಕಡಿಮೆ ಯಾವಾಗ", "ಭಾನುವಾರ {p} ರಶ್ ಇರುತ್ತಾ"],
  "hi": ["{p} जाने का सबसे अच्छा समय कब है", "क्या {p} में अभी भीड़ है", "आज {p} में कितनी भीड़ है", "{p} में भीड़ कब कम होगी", "रविवार को {p} में भीड़ होगी क्या"],
  "rom": ["{p} rush ideya", "{p} mein bheed hai kya", "{p} best time", "{p} jana kab accha hai", "{p} janasandani"],
 },
 "parking": {
  "en": ["is parking available at {p}", "where can I park near {p}", "how many parking slots are free at {p}", "will I get parking at {p} at 11", "parking near {p}", "is the {p} parking full", "car parking at {p}"],
  "kn": ["{p} ನಲ್ಲಿ ಪಾರ್ಕಿಂಗ್ ಸಿಗುತ್ತಾ", "{p} ಹತ್ತಿರ ಕಾರು ಎಲ್ಲಿ ನಿಲ್ಲಿಸಬೇಕು", "{p} ಪಾರ್ಕಿಂಗ್ ಖಾಲಿ ಇದೆಯಾ", "{p} ನಲ್ಲಿ ವಾಹನ ನಿಲುಗಡೆ ಎಲ್ಲಿ"],
  "hi": ["क्या {p} में पार्किंग मिलेगी", "{p} के पास गाड़ी कहाँ खड़ी करें", "{p} पार्किंग में कितनी जगह खाली है", "{p} की पार्किंग भरी है क्या"],
  "rom": ["{p} parking sigutha", "{p} parking milegi", "{p} parking full aa", "gaadi kahan park karein {p}", "car park {p}"],
 },
 "food": {
  "en": ["where can I eat near {p}", "good veg restaurant near {p}", "best place for jolada rotti", "cheap food near {p}", "restaurants in {p}", "where to have lunch near {p}", "north karnataka meals near me", "non veg food near {p}", "suggest a hotel for dinner"],
  "kn": ["{p} ಹತ್ತಿರ ಊಟ ಎಲ್ಲಿ ಸಿಗುತ್ತದೆ", "{p} ನಲ್ಲಿ ಒಳ್ಳೆ ಸಸ್ಯಾಹಾರಿ ಹೋಟೆಲ್", "ಜೋಳದ ರೊಟ್ಟಿ ಊಟ ಎಲ್ಲಿ ಸಿಗುತ್ತದೆ", "{p} ಹತ್ತಿರ ಕಡಿಮೆ ಬೆಲೆಯ ಊಟ", "ಮಧ್ಯಾಹ್ನದ ಊಟಕ್ಕೆ ಎಲ್ಲಿ ಹೋಗಲಿ", "ಮಾಂಸಾಹಾರಿ ಊಟ {p} ನಲ್ಲಿ"],
  "hi": ["{p} के पास खाना कहाँ मिलेगा", "{p} में अच्छा शाकाहारी रेस्टोरेंट", "ज्वार की रोटी कहाँ मिलेगी", "{p} के पास सस्ता खाना", "दोपहर का खाना कहाँ खाएँ", "{p} में नॉन वेज खाना"],
  "rom": ["{p} oota elli", "{p} mein khana kahan", "veg hotel {p}", "jolada rotti oota", "{p} restaurant suggest", "non veg {p} elli"],
 },
 "stay": {
  "en": ["hotels in {p}", "where should I stay near {p}", "budget room near {p}", "good hotel with parking in {p}", "family room in {p} under 2000", "best place to stay for a night in {p}", "lodge near {p} bus stand", "AC room in {p}"],
  "kn": ["{p} ನಲ್ಲಿ ಉಳಿಯಲು ಹೋಟೆಲ್", "{p} ಹತ್ತಿರ ಕಡಿಮೆ ಬೆಲೆಯ ರೂಮ್", "{p} ನಲ್ಲಿ ಲಾಡ್ಜ್ ಎಲ್ಲಿದೆ", "ಕುಟುಂಬಕ್ಕೆ {p} ನಲ್ಲಿ ರೂಮ್", "ರಾತ್ರಿ ಉಳಿಯಲು ಎಲ್ಲಿ"],
  "hi": ["{p} में होटल", "{p} के पास कहाँ ठहरें", "{p} में सस्ता कमरा", "{p} में परिवार के लिए कमरा", "रात रुकने के लिए अच्छी जगह {p}"],
  "rom": ["{p} room beku", "{p} mein hotel", "{p} lodge", "rukne ke liye jagah {p}", "{p} stay suggest"],
 },
 "route_distance": {
  "en": ["how far is {p}", "how do I reach {p}", "distance from badami to {p}", "bus to {p}", "how long does it take to go to {p}", "which road to {p}", "nearest railway station to {p}", "is there a train to {p}"],
  "kn": ["{p} ಎಷ್ಟು ದೂರ", "{p} ಗೆ ಹೇಗೆ ಹೋಗುವುದು", "ಬಾದಾಮಿಯಿಂದ {p} ಎಷ್ಟು ಕಿಲೋಮೀಟರ್", "{p} ಗೆ ಬಸ್ ಇದೆಯಾ", "{p} ತಲುಪಲು ಎಷ್ಟು ಸಮಯ", "{p} ಗೆ ದಾರಿ ಯಾವುದು"],
  "hi": ["{p} कितनी दूर है", "{p} कैसे पहुँचें", "बादामी से {p} की दूरी", "{p} के लिए बस है क्या", "{p} पहुँचने में कितना समय लगेगा", "{p} का रास्ता बताइए"],
  "rom": ["{p} eshtu dura", "{p} kaise jaye", "{p} ge bus ide", "{p} kitna door hai", "{p} route"],
 },
 "safety_emergency": {
  "en": ["help emergency", "I need an ambulance", "police number", "nearest hospital to {p}", "I am lost", "is {p} safe for women", "I feel unsafe", "someone fell down", "call for help", "emergency contact numbers"],
  "kn": ["ಸಹಾಯ ಮಾಡಿ ತುರ್ತು", "ಆಂಬ್ಯುಲೆನ್ಸ್ ಬೇಕು", "ಪೊಲೀಸ್ ಸಂಖ್ಯೆ ಏನು", "{p} ಹತ್ತಿರ ಆಸ್ಪತ್ರೆ ಎಲ್ಲಿದೆ", "ನಾನು ದಾರಿ ತಪ್ಪಿದ್ದೇನೆ", "ಮಹಿಳೆಯರಿಗೆ {p} ಸುರಕ್ಷಿತವೇ", "ಯಾರೋ ಬಿದ್ದಿದ್ದಾರೆ"],
  "hi": ["मदद चाहिए इमरजेंसी", "एम्बुलेंस चाहिए", "पुलिस का नंबर क्या है", "{p} के पास अस्पताल कहाँ है", "मैं रास्ता भटक गया हूँ", "क्या {p} महिलाओं के लिए सुरक्षित है", "कोई गिर गया है"],
  "rom": ["help madi", "ambulance beku", "madad chahiye", "police number", "hospital elli", "mujhe dar lag raha hai", "SOS"],
 },
 "accessibility": {
  "en": ["can my grandmother climb {p}", "is {p} wheelchair accessible", "how many steps at {p}", "places without stairs", "is {p} suitable for elderly", "easy walking places for seniors"],
  "kn": ["ಹಿರಿಯರು {p} ಹತ್ತಬಹುದೇ", "{p} ನಲ್ಲಿ ಗಾಲಿಕುರ್ಚಿ ಹೋಗುತ್ತದೆಯೇ", "{p} ನಲ್ಲಿ ಎಷ್ಟು ಮೆಟ್ಟಿಲುಗಳಿವೆ", "ಮೆಟ್ಟಿಲು ಇಲ್ಲದ ಸ್ಥಳಗಳು", "ವಯಸ್ಸಾದವರಿಗೆ ಸುಲಭ ಸ್ಥಳಗಳು"],
  "hi": ["क्या दादी {p} चढ़ सकती हैं", "क्या {p} व्हीलचेयर के लिए सुलभ है", "{p} में कितनी सीढ़ियाँ हैं", "बिना सीढ़ी वाली जगहें", "बुज़ुर्गों के लिए आसान जगहें"],
  "rom": ["{p} steps jaasti aa", "wheelchair {p}", "old people {p} hogbahuda", "seedhi kitni hai {p}"],
 },
 "itinerary": {
  "en": ["plan my day", "plan a two day trip", "make an itinerary for badami pattadakal aihole", "what should I see in one day", "I have 5 hours what to do", "plan a family trip", "suggest a route for tomorrow", "create a travel plan"],
  "kn": ["ನನ್ನ ದಿನದ ಯೋಜನೆ ಮಾಡಿ", "ಎರಡು ದಿನದ ಪ್ರವಾಸ ಯೋಜನೆ", "ಒಂದೇ ದಿನದಲ್ಲಿ ಏನು ನೋಡಬಹುದು", "ನಾಳೆಗೆ ಮಾರ್ಗ ಸೂಚಿಸಿ", "ಕುಟುಂಬ ಪ್ರವಾಸ ಯೋಜಿಸಿ"],
  "hi": ["मेरे दिन की योजना बनाइए", "दो दिन की यात्रा योजना", "एक दिन में क्या देखें", "कल के लिए रूट बताइए", "परिवार के लिए यात्रा योजना बनाइए"],
  "rom": ["trip plan madi", "ek din mein kya dekhein", "itinerary banao", "2 days plan", "plan maadi"],
 },
 "shopping_crafts": {
  "en": ["where to buy ilkal sarees", "local handicrafts near {p}", "souvenirs to buy", "guledgudda khana fabric shop", "weavers to visit", "what to shop in bagalkot"],
  "kn": ["ಇಳಕಲ್ ಸೀರೆ ಎಲ್ಲಿ ಕೊಳ್ಳಬಹುದು", "{p} ಹತ್ತಿರ ಕರಕುಶಲ ವಸ್ತುಗಳು", "ಗುಳೇದಗುಡ್ಡ ಖಣ ಎಲ್ಲಿ ಸಿಗುತ್ತದೆ", "ನೇಕಾರರನ್ನು ಭೇಟಿ ಮಾಡಬಹುದೇ", "ಯಾವ ನೆನಪಿನ ಕಾಣಿಕೆ ಕೊಳ್ಳಲಿ"],
  "hi": ["इलकल साड़ी कहाँ खरीदें", "{p} के पास हस्तशिल्प", "गुलेदगुड्ड खण कपड़ा कहाँ मिलेगा", "बुनकरों से मिल सकते हैं क्या", "यादगार के लिए क्या खरीदें"],
  "rom": ["ilkal saree elli", "saree kahan milegi", "shopping {p}", "kardantu elli sigutte", "handloom shop"],
 },
 "festival": {
  "en": ["any festival this month", "when is banashankari jatre", "events in {p} this week", "is there a festival at {p}", "pattadakal dance festival dates", "what is happening this weekend"],
  "kn": ["ಈ ತಿಂಗಳು ಯಾವುದಾದರೂ ಹಬ್ಬ ಇದೆಯಾ", "ಬನಶಂಕರಿ ಜಾತ್ರೆ ಯಾವಾಗ", "{p} ನಲ್ಲಿ ಈ ವಾರ ಉತ್ಸವ ಇದೆಯಾ", "ಪಟ್ಟದಕಲ್ಲು ನೃತ್ಯೋತ್ಸವ ಯಾವಾಗ"],
  "hi": ["इस महीने कोई त्योहार है क्या", "बनशंकरी जात्रा कब है", "इस हफ्ते {p} में कोई उत्सव है", "पट्टदकल नृत्य उत्सव कब है"],
  "rom": ["jatre yavaga", "festival kab hai", "utsava ide", "mela kab lagega"],
 },
 "weather_heat": {
  "en": ["how hot is it today", "weather in {p}", "will it rain today", "is it too hot to climb now", "temperature at {p}", "heat warning"],
  "kn": ["ಇಂದು ಎಷ್ಟು ಬಿಸಿಲು", "{p} ಹವಾಮಾನ ಹೇಗಿದೆ", "ಇಂದು ಮಳೆ ಬರುತ್ತಾ", "ಈಗ ಹತ್ತಲು ತುಂಬಾ ಬಿಸಿಯೇ", "{p} ತಾಪಮಾನ ಎಷ್ಟು"],
  "hi": ["आज कितनी गर्मी है", "{p} का मौसम कैसा है", "आज बारिश होगी क्या", "क्या अभी चढ़ने के लिए बहुत गर्मी है", "{p} का तापमान क्या है"],
  "rom": ["bisilu jaasti aa", "mausam kaisa hai", "male barutta", "garmi kitni hai", "weather {p}"],
 },
 "guide": {
  "en": ["can I hire a guide at {p}", "is there a local guide", "who is pravasi mitra", "audio guide for {p}", "need a tour guide"],
  "kn": ["{p} ನಲ್ಲಿ ಗೈಡ್ ಸಿಗುತ್ತಾರಾ", "ಸ್ಥಳೀಯ ಮಾರ್ಗದರ್ಶಿ ಬೇಕು", "ಪ್ರವಾಸಿ ಮಿತ್ರ ಯಾರು", "ಮಾರ್ಗದರ್ಶಕರನ್ನು ಎಲ್ಲಿ ಭೇಟಿಯಾಗಲಿ"],
  "hi": ["क्या {p} में गाइड मिलेगा", "स्थानीय गाइड चाहिए", "प्रवासी मित्र कौन हैं", "टूर गाइड कहाँ मिलेगा"],
  "rom": ["guide sigtara", "guide chahiye", "pravasi mitra", "guide {p}"],
 },
 "adventure": {
  "en": ["rock climbing in badami", "adventure activities near {p}", "trekking near {p}", "bouldering routes", "things to do for young people", "wildlife sanctuary nearby", "bird watching places"],
  "kn": ["ಬಾದಾಮಿಯಲ್ಲಿ ಬಂಡೆ ಹತ್ತುವುದು", "{p} ಹತ್ತಿರ ಸಾಹಸ ಚಟುವಟಿಕೆ", "{p} ಹತ್ತಿರ ಚಾರಣ", "ಹತ್ತಿರ ವನ್ಯಜೀವಿ ಧಾಮ ಇದೆಯಾ", "ಪಕ್ಷಿ ವೀಕ್ಷಣೆ ಎಲ್ಲಿ"],
  "hi": ["बादामी में रॉक क्लाइंबिंग", "{p} के पास एडवेंचर", "{p} के पास ट्रेकिंग", "पास में वन्यजीव अभयारण्य है क्या", "पक्षी देखने की जगह"],
  "rom": ["climbing badami", "trekking {p}", "adventure kya hai", "chinkara sanctuary"],
 },
 "greeting": {
  "en": ["hello", "hi there", "namaste", "good morning", "thank you", "thanks a lot", "who are you", "what can you do"],
  "kn": ["ನಮಸ್ಕಾರ", "ಹಲೋ", "ಶುಭೋದಯ", "ಧನ್ಯವಾದಗಳು", "ನೀವು ಯಾರು", "ನೀವು ಏನು ಮಾಡಬಲ್ಲಿರಿ"],
  "hi": ["नमस्ते", "हैलो", "सुप्रभात", "धन्यवाद", "आप कौन हैं", "आप क्या कर सकते हैं"],
  "rom": ["namaskara", "namaste ji", "thank you so much", "dhanyavadagalu", "shukriya", "neevu yaaru"],
 },
}


def expand():
    """-> list of (masked_text, intent, lang, template_id)."""
    rows = []
    for intent, by_lang in T.items():
        for lang, templates in by_lang.items():
            for ti, t in enumerate(templates):
                gid = f"{intent}:{lang}:{ti}"
                if "{p}" in t:
                    for p in PLACES[lang][:5] if lang != "rom" else PLACES["rom"][:4]:
                        rows.append((t.replace("{p}", p), intent, lang, gid))
                else:
                    rows.append((t, intent, lang, gid))
    # the classifier only ever sees masked text; duplicates after masking carry no extra signal
    seen, out = set(), []
    for text, intent, lang, gid in rows:
        k = (mask(text), intent)
        if k in seen: continue
        seen.add(k); out.append((mask(text), intent, lang, gid))
    return out
    return rows


# ── Entity masking ──────────────────────────────────────────────────────────────────────────────
# Place names appear under every intent, so for the classifier they are pure noise. We replace any
# known place alias with "#" before classifying. The assistant extracts the place separately.
ALIASES = {
    "badami_caves": ["badami caves", "badami cave", "badami guhe", "ಬಾದಾಮಿ ಗುಹೆ", "ಬಾದಾಮಿ ಗುಹೆಗಳು", "बादामी गुफा", "बादामी गुफाएँ", "cave temples", "ಗುಹಾಂತರ ದೇವಾಲಯ"],
    "badami": ["badami", "ಬಾದಾಮಿ", "बादामी", "vatapi", "ವಾತಾಪಿ", "वातापी"],
    "pattadakal": ["pattadakal", "pattadakallu", "pattadkal", "ಪಟ್ಟದಕಲ್ಲು", "ಪಟ್ಟದಕಲ್", "पट्टदकल", "पट्टडकल", "virupaksha", "ವಿರೂಪಾಕ್ಷ", "विरूपाक्ष"],
    "aihole": ["aihole", "aihol", "ಐಹೊಳೆ", "ऐहोल", "ऐहोले", "durga temple", "durga gudi", "ದುರ್ಗಾ ದೇವಾಲಯ", "दुर्गा मंदिर", "meguti", "ಮೇಗುತಿ", "ravanaphadi", "ರಾವಣಫಡಿ"],
    "mahakuta": ["mahakuta", "mahakoota", "ಮಹಾಕೂಟ", "महाकूट"],
    "banashankari": ["banashankari", "ಬನಶಂಕರಿ", "बनशंकरी"],
    "kudalasangama": ["kudalasangama", "kudala sangama", "kudal sangam", "ಕೂಡಲಸಂಗಮ", "कूडलसंगम", "कूडल संगम"],
    "bhutanatha": ["bhutanatha", "bhoothanatha", "agastya lake", "agastya", "ಭೂತನಾಥ", "ಅಗಸ್ತ್ಯ ತೀರ್ಥ", "भूतनाथ", "अगस्त्य"],
    "ilkal": ["ilkal", "ilakal", "ಇಳಕಲ್", "इलकल"],
    "guledgudda": ["guledgudda", "ಗುಳೇದಗುಡ್ಡ", "गुलेदगुड्ड"],
    "bagalkot": ["bagalkot", "bagalkote", "ಬಾಗಲಕೋಟೆ", "बागलकोट"],
    "almatti": ["almatti", "ಆಲಮಟ್ಟಿ", "अलमट्टी"],
}
_FLAT = sorted(((a, pid) for pid, al in ALIASES.items() for a in al), key=lambda t: -len(t[0]))


def find_places(text: str) -> list[str]:
    t, found = text.lower(), []
    for a, pid in _FLAT:
        if a in t and pid not in found:
            found.append(pid); t = t.replace(a, " ")
    return found


def mask(text: str) -> str:
    t = text.lower()
    for a, _ in _FLAT:
        t = t.replace(a, " # ")
    return " ".join(t.split())
