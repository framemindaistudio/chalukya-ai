"""One-off enrichment of places.json with facts cross-checked against the District Tourism
Development Committee book 'Sounds and Emotions' (2022). Paraphrased, never copied."""
import io
import json
from pathlib import Path

p = Path(__file__).parent / "places.json"
kb = json.load(io.open(p, encoding="utf8"))
if any(x["id"] == "amingad" for x in kb["places"]):
    raise SystemExit("already enriched")
P = {x["id"]: x for x in kb["places"]}

kb["_note"] = ("Curated knowledge base for Chalukya AI. Facts cross-checked against the District Tourism Development Committee, "
               "Bagalkote book 'Sounds and Emotions' (2022), ASI and Wikipedia/Wikidata. Text is paraphrased because the book is copyrighted. "
               "Coordinates come from Wikipedia/Wikidata/OpenStreetMap. Kannada and Hindi text should be reviewed by a native speaker; "
               "'verify' marks facts to confirm on site.")
kb["sources"] = [
    {"id": "dtdc_book", "title": "Sounds and Emotions (coffee-table book), District Tourism Development Committee, Bagalkote, 2022"},
    {"id": "asi_footfall", "title": "ASI: Visitor footfall at centrally protected ticketed monuments (document headed FY 2024-25)"},
    {"id": "wikidata", "title": "Wikipedia / Wikidata / OpenStreetMap (coordinates, basic facts)"},
]

P["pattadakal"]["lat"], P["pattadakal"]["lng"] = 15.94928, 75.81625

P["badami_caves"]["facts"] += [
    {"en": "The district tourism book reads the Nataraja's arms as 81 dance movements of Bharatanatyam, arranged like a cosmic wheel.",
     "kn": "ನಟರಾಜನ ಕೈಗಳು ಭರತನಾಟ್ಯದ 81 ನೃತ್ಯ ಭಂಗಿಗಳನ್ನು ಸೂಚಿಸುತ್ತವೆ ಎಂದು ಜಿಲ್ಲಾ ಪ್ರವಾಸೋದ್ಯಮ ಪುಸ್ತಕ ಹೇಳುತ್ತದೆ; ಅವು ವಿಶ್ವಚಕ್ರದಂತೆ ಜೋಡಿಸಲ್ಪಟ್ಟಿವೆ.",
     "hi": "ज़िला पर्यटन पुस्तक के अनुसार नटराज की भुजाएँ भरतनाट्यम की 81 नृत्य मुद्राओं को दर्शाती हैं, जो एक ब्रह्मांडीय चक्र की तरह सजी हैं।", "src": "dtdc_book"},
    {"en": "Cave 3 took about twelve years to carve and holds the earliest surviving traces of fresco painting in Indian art.",
     "kn": "3ನೇ ಗುಹೆಯನ್ನು ಕೆತ್ತಲು ಸುಮಾರು ಹನ್ನೆರಡು ವರ್ಷಗಳು ಬೇಕಾದವು; ಭಾರತೀಯ ಕಲೆಯ ಅತ್ಯಂತ ಹಳೆಯ ಉಳಿದಿರುವ ಭಿತ್ತಿಚಿತ್ರದ ಕುರುಹುಗಳು ಇಲ್ಲಿವೆ.",
     "hi": "गुफा 3 को तराशने में लगभग बारह वर्ष लगे और इसमें भारतीय कला में भित्तिचित्र (फ्रेस्को) के सबसे पुराने बचे हुए निशान हैं।", "src": "dtdc_book"},
]
P["bhutanatha"]["facts"].append(
    {"en": "There are two sub-groups: the older Bhutanatha group in the southern Dravida style and the Mallikarjuna group in the northern Nagara style.",
     "kn": "ಎರಡು ಉಪಗುಂಪುಗಳಿವೆ: ದ್ರಾವಿಡ ಶೈಲಿಯ ಹಳೆಯ ಭೂತನಾಥ ಗುಂಪು ಮತ್ತು ನಾಗರ ಶೈಲಿಯ ಮಲ್ಲಿಕಾರ್ಜುನ ಗುಂಪು.",
     "hi": "दो उप-समूह हैं: दक्षिणी द्रविड़ शैली का पुराना भूतनाथ समूह और उत्तरी नागर शैली का मल्लिकार्जुन समूह।", "src": "dtdc_book"})
P["badami_fort"]["facts"].append(
    {"en": "Despite its name, the Upper Shivalaya is essentially a Vishnu temple; its base carries scenes from the Ramayana and Krishna's childhood.",
     "kn": "ಹೆಸರಿನ ಹೊರತಾಗಿಯೂ ಮೇಲಿನ ಶಿವಾಲಯ ಮೂಲತಃ ವಿಷ್ಣು ದೇವಾಲಯ; ಇದರ ಅಧಿಷ್ಠಾನದಲ್ಲಿ ರಾಮಾಯಣ ಮತ್ತು ಕೃಷ್ಣನ ಬಾಲ್ಯದ ದೃಶ್ಯಗಳಿವೆ.",
     "hi": "नाम के बावजूद ऊपरी शिवालय मूलतः विष्णु मंदिर है; इसके आधार पर रामायण और कृष्ण के बचपन के दृश्य हैं।", "src": "dtdc_book"})

a = P["aihole"]
a["summary"]["en"] = ("Aihole has around 125 temples and monuments spread over about five square kilometres. Chalukyan builders "
                      "experimented with temple forms here, which is why it is called the cradle of Indian temple architecture. The Durga "
                      "temple, with its apsidal (horseshoe-shaped) plan and pillared gallery, is its most famous monument.")
a["facts"] = [
    {"en": "Despite its name, the Durga temple was originally dedicated to Surya and Vishnu. It stood near a fort-like enclosure, 'Durgada Gudi' (the temple by the fort), which gave it its name.",
     "kn": "ಹೆಸರಿನ ಹೊರತಾಗಿಯೂ ದುರ್ಗಾ ದೇವಾಲಯ ಮೂಲತಃ ಸೂರ್ಯ ಮತ್ತು ವಿಷ್ಣುವಿಗೆ ಅರ್ಪಿತ. ಕೋಟೆಯಂತಹ ಆವರಣದ ಬಳಿ ಇದ್ದುದರಿಂದ 'ದುರ್ಗದ ಗುಡಿ' ಎಂಬ ಹೆಸರು ಬಂದಿತು.",
     "hi": "नाम के बावजूद दुर्गा मंदिर मूल रूप से सूर्य और विष्णु को समर्पित था। किले जैसे अहाते के पास होने से इसे 'दुर्गद गुडी' (किले के पास का मंदिर) कहा गया।", "src": "dtdc_book"},
    {"en": "The Lad Khan temple, one of Aihole's earliest experiments, was originally a Shiva temple. It is named after an Adil Shahi commander who briefly stayed in it. Its roof mimics timber construction in stone.",
     "kn": "ಐಹೊಳೆಯ ಆರಂಭಿಕ ಪ್ರಯೋಗಗಳಲ್ಲಿ ಒಂದಾದ ಲಾಡ್ ಖಾನ್ ದೇವಾಲಯ ಮೂಲತಃ ಶಿವ ದೇವಾಲಯ; ಅಲ್ಲಿ ಸ್ವಲ್ಪಕಾಲ ತಂಗಿದ್ದ ಆದಿಲ್ ಶಾಹಿ ಸೇನಾಧಿಕಾರಿಯ ಹೆಸರು ಬಂದಿದೆ. ಇದರ ಛಾವಣಿ ಮರದ ರಚನೆಯನ್ನು ಕಲ್ಲಿನಲ್ಲಿ ಅನುಕರಿಸುತ್ತದೆ.",
     "hi": "ऐहोल के शुरुआती प्रयोगों में से एक लाड खान मंदिर मूल रूप से शिव मंदिर था; इसका नाम कुछ समय यहाँ रुके एक आदिलशाही सेनापति पर पड़ा। इसकी छत पत्थर में लकड़ी की संरचना की नकल करती है।", "src": "dtdc_book"},
    {"en": "Local legend: Parashurama washed his blood-stained axe in the Malaprabha here and the river turned red. People cried 'Ayyo, hole!', and the place came to be called Aihole.",
     "kn": "ಸ್ಥಳೀಯ ಐತಿಹ್ಯ: ಪರಶುರಾಮನು ರಕ್ತಸಿಕ್ತ ಕೊಡಲಿಯನ್ನು ಇಲ್ಲಿ ಮಲಪ್ರಭೆಯಲ್ಲಿ ತೊಳೆದಾಗ ನದಿ ಕೆಂಪಾಯಿತು; ಜನರು 'ಅಯ್ಯೋ, ಹೊಳೆ!' ಎಂದು ಉದ್ಗರಿಸಿದರು. ಹೀಗೆ ಐಹೊಳೆ ಎಂಬ ಹೆಸರು ಬಂತು.",
     "hi": "स्थानीय कथा: परशुराम ने यहाँ मालप्रभा में अपना रक्तरंजित फरसा धोया और नदी लाल हो गई; लोग चिल्लाए 'अय्यो, होले!' और इस जगह का नाम ऐहोल पड़ा।", "src": "dtdc_book"},
]

P["pattadakal"]["facts"].insert(1, {
    "en": "Of its ten main temples, four are in the southern Dravida style, four carry northern Nagara elements and two blend both.",
    "kn": "ಇಲ್ಲಿನ ಹತ್ತು ಪ್ರಮುಖ ದೇವಾಲಯಗಳಲ್ಲಿ ನಾಲ್ಕು ದ್ರಾವಿಡ ಶೈಲಿ, ನಾಲ್ಕು ನಾಗರ ಅಂಶಗಳು, ಎರಡು ಎರಡೂ ಶೈಲಿಗಳ ಮಿಶ್ರಣ.",
    "hi": "यहाँ के दस प्रमुख मंदिरों में चार द्रविड़ शैली के, चार में नागर तत्व और दो में दोनों शैलियों का मेल है।", "src": "dtdc_book"})
P["pattadakal"]["facts"].append({
    "en": "The queen is believed to have brought sculptors from the Pallava capital Kanchi, inspired by its Kailasanatha temple. A tall pillar near Virupaksha records Vikramaditya II's victory in old Kannada.",
    "kn": "ಕಂಚಿಯ ಕೈಲಾಸನಾಥ ದೇವಾಲಯದಿಂದ ಪ್ರೇರಿತಳಾದ ರಾಣಿ ಪಲ್ಲವ ರಾಜಧಾನಿಯಿಂದ ಶಿಲ್ಪಿಗಳನ್ನು ಕರೆತಂದಳು ಎಂದು ನಂಬಲಾಗಿದೆ. ವಿರೂಪಾಕ್ಷದ ಬಳಿಯ ಎತ್ತರದ ಸ್ತಂಭ ಹಳೆಗನ್ನಡದಲ್ಲಿ ಇಮ್ಮಡಿ ವಿಕ್ರಮಾದಿತ್ಯನ ವಿಜಯವನ್ನು ದಾಖಲಿಸಿದೆ.",
    "hi": "माना जाता है कि कांची के कैलासनाथ मंदिर से प्रेरित रानी पल्लव राजधानी से शिल्पी लाई थीं। विरूपाक्ष के पास एक ऊँचा स्तंभ पुरानी कन्नड़ में विक्रमादित्य द्वितीय की विजय दर्ज करता है।", "src": "dtdc_book"})

m = P["mahakuta"]["summary"]
m["en"] = ("Called the 'Dakshina Kashi' (Kashi of the South), Mahakuta has more than two dozen Chalukya-era Shiva temples around the "
           "spring-fed Vishnu Pushkarini tank. It blends southern Dravida and northern Nagara styles, and the Mahakuteshwara temple is still in active worship.")
m["kn"] = ("'ದಕ್ಷಿಣ ಕಾಶಿ' ಎಂದು ಕರೆಯಲ್ಪಡುವ ಮಹಾಕೂಟದಲ್ಲಿ ಚಿಲುಮೆಯ ನೀರಿನ ವಿಷ್ಣು ಪುಷ್ಕರಿಣಿಯ ಸುತ್ತ ಎರಡು ಡಜನ್‌ಗಿಂತ ಹೆಚ್ಚು ಚಾಲುಕ್ಯ ಕಾಲದ ಶಿವ ದೇವಾಲಯಗಳಿವೆ. "
           "ದ್ರಾವಿಡ ಮತ್ತು ನಾಗರ ಶೈಲಿಗಳ ಮಿಶ್ರಣ; ಮಹಾಕೂಟೇಶ್ವರ ದೇವಾಲಯದಲ್ಲಿ ಇಂದಿಗೂ ಪೂಜೆ ನಡೆಯುತ್ತದೆ.")
m["hi"] = ("'दक्षिण काशी' कहे जाने वाले महाकूट में झरने से भरे विष्णु पुष्करिणी कुंड के चारों ओर चालुक्य काल के दो दर्जन से अधिक शिव मंदिर हैं। "
           "यहाँ द्रविड़ और नागर शैलियों का मेल है, और महाकूटेश्वर मंदिर में आज भी पूजा होती है।")

P["banashankari"]["facts"].append({
    "en": "The jatre runs for about three weeks, beginning with the chariot festival, and is one of the largest fairs in Karnataka, with hundreds of drama troupes.",
    "kn": "ರಥೋತ್ಸವದಿಂದ ಆರಂಭವಾಗುವ ಜಾತ್ರೆ ಸುಮಾರು ಮೂರು ವಾರ ನಡೆಯುತ್ತದೆ; ನೂರಾರು ನಾಟಕ ಕಂಪನಿಗಳಿರುವ ಇದು ಕರ್ನಾಟಕದ ಅತಿದೊಡ್ಡ ಜಾತ್ರೆಗಳಲ್ಲಿ ಒಂದು.",
    "hi": "रथोत्सव से शुरू होने वाला जात्रा लगभग तीन सप्ताह चलता है और सैकड़ों नाटक मंडलियों के साथ कर्नाटक के सबसे बड़े मेलों में से एक है।", "src": "dtdc_book"})
P["kudalasangama"]["facts"].append({
    "en": "Basavanna's samadhi, the Aikya Mantapa, sits where the rivers meet. The complex also has the Sangamanatha temple, the Basava Gopura and a hall seating about 6,000 people.",
    "kn": "ನದಿಗಳು ಸೇರುವಲ್ಲಿ ಬಸವಣ್ಣನವರ ಐಕ್ಯ ಮಂಟಪವಿದೆ; ಸಂಗಮನಾಥ ದೇವಾಲಯ, ಬಸವ ಗೋಪುರ ಮತ್ತು ಸುಮಾರು 6,000 ಆಸನಗಳ ಸಭಾಭವನವೂ ಇದೆ.",
    "hi": "नदियों के संगम पर बसवण्णा की समाधि, ऐक्य मंडप है; यहाँ संगमनाथ मंदिर, बसव गोपुर और लगभग 6,000 लोगों की क्षमता वाला सभा भवन भी है।", "src": "dtdc_book"})
P["ilkal"]["facts"] = [{
    "en": "A single Ilkal saree takes three to seven days to weave. The body is joined to the pallu with a series of loops, a technique called 'tope teni'.",
    "kn": "ಒಂದು ಇಳಕಲ್ ಸೀರೆ ನೇಯಲು ಮೂರರಿಂದ ಏಳು ದಿನ ಬೇಕು. ಸೀರೆಯ ಒಡಲನ್ನು ಸೆರಗಿಗೆ ಕುಣಿಕೆಗಳ ಸರಣಿಯಿಂದ ಜೋಡಿಸುವ ತಂತ್ರವೇ 'ತೋಪು ತೆನಿ'.",
    "hi": "एक इलकल साड़ी बुनने में तीन से सात दिन लगते हैं। साड़ी के मुख्य भाग को पल्लू से फंदों की शृंखला द्वारा जोड़ा जाता है, जिसे 'तोपे तेनी' कहते हैं।", "src": "dtdc_book"}]

kb["places"] += [
    {"id": "siddanakolla", "town": "ilkal", "kind": "pilgrimage", "lat": 15.97932, "lng": 75.85946,
     "name": {"en": "Siddanakolla", "kn": "ಸಿದ್ಧನಕೊಳ್ಳ", "hi": "सिद्धनकोल्ल"}, "period": "Chalukya-era temples; living shrine", "dynasty": "Badami Chalukyas",
     "summary": {"en": "A group of Chalukya-era temples at the head of a rocky valley, with the Siddeshwara shrine and a small cascade where pilgrims bathe. The surrounding hills also hold prehistoric rock art.",
                 "kn": "ಕಲ್ಲಿನ ಕಣಿವೆಯ ಆರಂಭದಲ್ಲಿರುವ ಚಾಲುಕ್ಯ ಕಾಲದ ದೇವಾಲಯಗಳ ಸಮೂಹ; ಸಿದ್ಧೇಶ್ವರ ಸನ್ನಿಧಿ ಮತ್ತು ಯಾತ್ರಿಕರು ಸ್ನಾನ ಮಾಡುವ ಚಿಕ್ಕ ಜಲಧಾರೆ ಇದೆ. ಸುತ್ತಲಿನ ಬೆಟ್ಟಗಳಲ್ಲಿ ಇತಿಹಾಸಪೂರ್ವ ಶಿಲಾಚಿತ್ರಗಳೂ ಇವೆ.",
                 "hi": "एक चट्टानी घाटी के मुहाने पर चालुक्य काल के मंदिरों का समूह, जहाँ सिद्धेश्वर मंदिर और एक छोटा झरना है जिसमें तीर्थयात्री स्नान करते हैं। आसपास की पहाड़ियों में प्रागैतिहासिक शैल चित्र भी हैं।"},
     "facts": [], "visit": {"minutes": 60, "stairs": True, "wheelchair": "no", "shade": "medium", "entry": "Free"},
     "tags": ["pilgrimage", "nature", "quiet", "rock-art", "offbeat"], "src": "dtdc_book"},
    {"id": "yadahalli", "town": "bilagi", "kind": "nature", "lat": 16.34650, "lng": 75.50237,
     "name": {"en": "Yadahalli Chinkara Wildlife Sanctuary", "kn": "ಯಡಹಳ್ಳಿ ಚಿಂಕಾರ ವನ್ಯಜೀವಿ ಧಾಮ", "hi": "यडहल्ली चिंकारा वन्यजीव अभयारण्य"}, "period": "Protected area", "dynasty": "—",
     "summary": {"en": "Karnataka's first sanctuary for the chinkara (Indian gazelle), in Bilagi taluk, covering about 9,600 hectares of scrub and grassland. The district records around 173 bird species, including winter migrants.",
                 "kn": "ಬೀಳಗಿ ತಾಲ್ಲೂಕಿನಲ್ಲಿರುವ, ಚಿಂಕಾರ (ಭಾರತೀಯ ಜಿಂಕೆ) ಗಾಗಿ ಕರ್ನಾಟಕದ ಮೊದಲ ಧಾಮ; ಸುಮಾರು 9,600 ಹೆಕ್ಟೇರ್ ಕುರುಚಲು ಕಾಡು ಮತ್ತು ಹುಲ್ಲುಗಾವಲು. ಜಿಲ್ಲೆಯಲ್ಲಿ ಚಳಿಗಾಲದ ವಲಸೆ ಹಕ್ಕಿಗಳು ಸೇರಿ ಸುಮಾರು 173 ಪಕ್ಷಿ ಪ್ರಭೇದಗಳು ದಾಖಲಾಗಿವೆ.",
                 "hi": "बिलगी तालुक में चिंकारा (भारतीय चिकारा) के लिए कर्नाटक का पहला अभयारण्य, लगभग 9,600 हेक्टेयर झाड़ीदार जंगल और घास के मैदान। ज़िले में शीतकालीन प्रवासी पक्षियों सहित लगभग 173 पक्षी प्रजातियाँ दर्ज हैं।"},
     "facts": [], "visit": {"minutes": 120, "stairs": False, "wheelchair": "partial", "shade": "low", "entry": "Forest department rules apply (verify)"},
     "tags": ["nature", "wildlife", "birding", "offbeat"], "src": "dtdc_book"},
    {"id": "amingad", "town": "hungund", "kind": "food", "lat": 16.06025, "lng": 75.95087,
     "name": {"en": "Amingad: Home of Kardantu", "kn": "ಅಮೀನಗಡ: ಕರದಂಟಿನ ತವರು", "hi": "अमीनगड: करदंटु का घर"}, "period": "Living tradition", "dynasty": "—",
     "summary": {"en": "A town on the Badami–Kudalasangama road famous for kardantu, a rich sweet of dry fruits, jaggery and edible gum. It began as nutritious food for wrestlers and new mothers and is now made on a large scale.",
                 "kn": "ಬಾದಾಮಿ–ಕೂಡಲಸಂಗಮ ದಾರಿಯಲ್ಲಿರುವ ಊರು; ಒಣಹಣ್ಣು, ಬೆಲ್ಲ ಮತ್ತು ಅಂಟಿನ ಕರದಂಟಿಗೆ ಪ್ರಸಿದ್ಧ. ಕುಸ್ತಿಪಟುಗಳು ಮತ್ತು ಬಾಣಂತಿಯರಿಗೆ ಪೌಷ್ಟಿಕ ಆಹಾರವಾಗಿ ಆರಂಭವಾದ ಇದು ಈಗ ದೊಡ್ಡ ಪ್ರಮಾಣದಲ್ಲಿ ತಯಾರಾಗುತ್ತದೆ.",
                 "hi": "बादामी–कूडलसंगम मार्ग पर बसा कस्बा, जो सूखे मेवों, गुड़ और गोंद से बनी मिठाई करदंटु के लिए प्रसिद्ध है। यह पहलवानों और नई माताओं के पौष्टिक आहार के रूप में शुरू हुई और अब बड़े पैमाने पर बनती है।"},
     "facts": [], "visit": {"minutes": 20, "stairs": False, "wheelchair": "yes", "shade": "high", "entry": "Free"},
     "tags": ["food", "sweets", "shopping", "local-livelihood"], "src": "dtdc_book"},
]

kb["practical"] += [
    {"id": "guides", "q": {"en": "Can I get a local guide?", "kn": "ಸ್ಥಳೀಯ ಮಾರ್ಗದರ್ಶಿ ಸಿಗುತ್ತಾರೆಯೇ?", "hi": "क्या स्थानीय गाइड मिल सकता है?"},
     "a": {"en": "Yes. The district has placed 'Pravasi Mitra' tourist helpers at the UNESCO site and other major monuments to guide visitors. Licensed guides are also usually available at the Badami caves, Pattadakal and Aihole entrances. Hiring a local guide supports local livelihoods.",
           "kn": "ಹೌದು. ಯುನೆಸ್ಕೋ ತಾಣ ಮತ್ತು ಇತರ ಪ್ರಮುಖ ಸ್ಮಾರಕಗಳಲ್ಲಿ ಪ್ರವಾಸಿಗರಿಗೆ ಮಾರ್ಗದರ್ಶನ ನೀಡಲು ಜಿಲ್ಲಾಡಳಿತ 'ಪ್ರವಾಸಿ ಮಿತ್ರ'ರನ್ನು ನೇಮಿಸಿದೆ. ಬಾದಾಮಿ ಗುಹೆ, ಪಟ್ಟದಕಲ್ಲು, ಐಹೊಳೆ ಪ್ರವೇಶದ್ವಾರಗಳಲ್ಲಿ ಪರವಾನಗಿ ಪಡೆದ ಮಾರ್ಗದರ್ಶಿಗಳೂ ಸಾಮಾನ್ಯವಾಗಿ ಸಿಗುತ್ತಾರೆ. ಸ್ಥಳೀಯ ಮಾರ್ಗದರ್ಶಿಯನ್ನು ನೇಮಿಸುವುದು ಸ್ಥಳೀಯ ಜೀವನೋಪಾಯಕ್ಕೆ ನೆರವು.",
           "hi": "हाँ। ज़िला प्रशासन ने यूनेस्को स्थल और अन्य प्रमुख स्मारकों पर पर्यटकों की मदद के लिए 'प्रवासी मित्र' नियुक्त किए हैं। बादामी गुफाओं, पट्टदकल और ऐहोल के प्रवेश द्वार पर लाइसेंसधारी गाइड भी आमतौर पर मिलते हैं। स्थानीय गाइड रखना स्थानीय आजीविका को सहारा देता है।"},
     "tags": ["guide", "pravasi-mitra", "local-livelihood", "help"], "src": "dtdc_book"},
    {"id": "adventure", "q": {"en": "Is there rock climbing or adventure in Badami?", "kn": "ಬಾದಾಮಿಯಲ್ಲಿ ಬಂಡೆ ಹತ್ತುವ ಸಾಹಸ ಇದೆಯೇ?", "hi": "क्या बादामी में रॉक क्लाइंबिंग या एडवेंचर है?"},
     "a": {"en": "Yes. Badami's sandstone cliffs, with their horizontal cracks, have more than 150 bolted climbing routes, and climbers call it a mecca of rock climbing. Climb only with a certified instructor and proper gear, and avoid midday heat.",
           "kn": "ಹೌದು. ಅಡ್ಡ ಬಿರುಕುಗಳಿರುವ ಬಾದಾಮಿಯ ಮರಳುಗಲ್ಲಿನ ಬಂಡೆಗಳಲ್ಲಿ 150ಕ್ಕೂ ಹೆಚ್ಚು ಬೋಲ್ಟ್ ಮಾಡಿದ ಹತ್ತುವ ದಾರಿಗಳಿವೆ; ಆರೋಹಿಗಳು ಇದನ್ನು ಬಂಡೆ ಹತ್ತುವ 'ಮೆಕ್ಕಾ' ಎನ್ನುತ್ತಾರೆ. ಪ್ರಮಾಣಿತ ತರಬೇತುದಾರ ಮತ್ತು ಸರಿಯಾದ ಸಾಧನಗಳೊಂದಿಗೆ ಮಾತ್ರ ಹತ್ತಿ; ಮಧ್ಯಾಹ್ನದ ಬಿಸಿಲು ತಪ್ಪಿಸಿ.",
           "hi": "हाँ। क्षैतिज दरारों वाली बादामी की बलुआ पत्थर की चट्टानों पर 150 से अधिक बोल्टेड क्लाइंबिंग रूट हैं, और क्लाइंबर इसे रॉक क्लाइंबिंग का मक्का कहते हैं। केवल प्रमाणित प्रशिक्षक और सही उपकरणों के साथ चढ़ें, और दोपहर की गर्मी से बचें।"},
     "tags": ["adventure", "climbing", "rock", "activity"], "src": "dtdc_book"},
]
for x in kb["practical"]:
    if x["id"] == "food":
        x["a"]["en"] = ("Try a North Karnataka meal: jolada rotti (jowar flatbread) with ennegai (stuffed brinjal curry), kalu palya (sprouted legumes) "
                        "and shenga chutney (groundnut chutney). For a sweet, take home kardantu from Amingad, first made in Bagalkote as nutrition for wrestlers and new mothers.")

io.open(p, "w", encoding="utf8").write(json.dumps(kb, ensure_ascii=False, indent=1))
print(len(kb["places"]), "places,", len(kb["practical"]), "FAQs")
