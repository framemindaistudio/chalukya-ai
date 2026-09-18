"""
A separate, freshly written test set of realistic questions (different wording from the training
templates, including speech-to-text style noise). Replace or extend it with real questions
collected from tourists and students: that is the most convincing test.
"""
FRESH = [
    # en
    ("my kids are hungry, any good place to eat around here", "food"), ("which lodge is cheap near the bus stand", "stay"),
    ("can we leave the car somewhere near the caves", "parking"), ("how many kilometres to aihole from here", "route_distance"),
    ("what time do they shut the gates at pattadakal", "timings_entry"), ("will it be packed on saturday morning", "best_time_crowd"),
    ("my father slipped on the steps and is bleeding", "safety_emergency"), ("my mother uses a walker, which temples are flat", "accessibility"),
    ("we have one full day, what should we cover", "itinerary"), ("where do the weavers sell sarees directly", "shopping_crafts"),
    ("is there any fair or jatre happening soon", "festival"), ("is the sun too strong to go up now", "weather_heat"),
    ("i want someone local to explain the carvings", "guide"), ("any bouldering spots for beginners", "adventure"),
    ("hey there", "greeting"), ("what's the story of the dancing god with many hands", "sculpture"),
    ("why did the chalukyas choose badami as capital", "about_place"), ("veg thali near banashankari temple", "food"),
    ("ac room for two nights for a family of four", "stay"), ("which gods are carved inside cave three", "sculpture"),
    # kn
    ("ಮಕ್ಕಳಿಗೆ ಹಸಿವಾಗಿದೆ ಹತ್ತಿರ ಎಲ್ಲಿ ಊಟ ಮಾಡಬಹುದು", "food"), ("ಇವತ್ತು ರಾತ್ರಿ ತಂಗಲು ಕಡಿಮೆ ಬೆಲೆಯ ಕೊಠಡಿ ಬೇಕು", "stay"),
    ("ಗುಹೆಯ ಹತ್ತಿರ ಕಾರು ನಿಲ್ಲಿಸಲು ಜಾಗ ಇದೆಯಾ", "parking"), ("ಇಲ್ಲಿಂದ ಐಹೊಳೆಗೆ ಎಷ್ಟು ಕಿಲೋಮೀಟರ್ ಆಗುತ್ತೆ", "route_distance"),
    ("ಪಟ್ಟದಕಲ್ಲು ಎಷ್ಟು ಗಂಟೆಗೆ ಬಾಗಿಲು ಹಾಕುತ್ತಾರೆ", "timings_entry"), ("ಶನಿವಾರ ಬೆಳಿಗ್ಗೆ ತುಂಬಾ ಜನ ಇರ್ತಾರಾ", "best_time_crowd"),
    ("ನಮ್ಮ ತಂದೆ ಮೆಟ್ಟಿಲಿನಿಂದ ಜಾರಿ ಬಿದ್ದರು ಸಹಾಯ ಬೇಕು", "safety_emergency"), ("ಅಜ್ಜಿಗೆ ಮೆಟ್ಟಿಲು ಹತ್ತಲು ಆಗಲ್ಲ ಯಾವ ಜಾಗ ಸುಲಭ", "accessibility"),
    ("ಒಂದು ದಿನದಲ್ಲಿ ಎಲ್ಲಾ ನೋಡಲು ಯೋಜನೆ ಹೇಳಿ", "itinerary"), ("ನೇಕಾರರಿಂದ ನೇರವಾಗಿ ಸೀರೆ ಕೊಳ್ಳಬಹುದಾ", "shopping_crafts"),
    ("ಹತ್ತಿರದಲ್ಲಿ ಜಾತ್ರೆ ಏನಾದರೂ ಇದೆಯಾ", "festival"), ("ಈಗ ಬಿಸಿಲು ಜಾಸ್ತಿ ಇದೆಯಾ ಮೇಲೆ ಹೋಗಬಹುದಾ", "weather_heat"),
    ("ಕೆತ್ತನೆಗಳನ್ನು ವಿವರಿಸಲು ಸ್ಥಳೀಯ ಮಾರ್ಗದರ್ಶಿ ಸಿಗ್ತಾರಾ", "guide"), ("ಬಂಡೆ ಹತ್ತುವ ಸಾಹಸಕ್ಕೆ ಎಲ್ಲಿ ಹೋಗಬೇಕು", "adventure"),
    ("ನಮಸ್ಕಾರ ಹೇಗಿದ್ದೀರಿ", "greeting"), ("ಅನೇಕ ಕೈಗಳಿರುವ ನೃತ್ಯ ಮಾಡುವ ದೇವರ ಕಥೆ ಏನು", "sculpture"),
    ("ಚಾಲುಕ್ಯರು ಬಾದಾಮಿಯನ್ನು ರಾಜಧಾನಿ ಏಕೆ ಮಾಡಿದರು", "about_place"), ("ಬನಶಂಕರಿ ದೇವಸ್ಥಾನದ ಹತ್ತಿರ ಸಸ್ಯಾಹಾರಿ ಊಟ", "food"),
    ("ನಾಲ್ಕು ಜನರ ಕುಟುಂಬಕ್ಕೆ ಎರಡು ರಾತ್ರಿ ರೂಮ್ ಬೇಕು", "stay"), ("ಮೂರನೇ ಗುಹೆಯಲ್ಲಿ ಯಾವ ದೇವರ ಶಿಲ್ಪಗಳಿವೆ", "sculpture"),
    # hi
    ("बच्चों को भूख लगी है पास में कहाँ खा सकते हैं", "food"), ("बस स्टैंड के पास सस्ता लॉज कौन सा है", "stay"),
    ("गुफाओं के पास गाड़ी कहाँ लगाएँ", "parking"), ("यहाँ से ऐहोल कितने किलोमीटर है", "route_distance"),
    ("पट्टदकल का गेट कितने बजे बंद होता है", "timings_entry"), ("शनिवार सुबह बहुत भीड़ रहेगी क्या", "best_time_crowd"),
    ("मेरे पिताजी सीढ़ियों से गिर गए खून निकल रहा है", "safety_emergency"), ("माँ वॉकर से चलती हैं कौन से मंदिर समतल हैं", "accessibility"),
    ("हमारे पास एक पूरा दिन है क्या क्या देखें", "itinerary"), ("बुनकरों से सीधे साड़ी कहाँ मिलेगी", "shopping_crafts"),
    ("जल्दी कोई मेला या जात्रा है क्या", "festival"), ("अभी धूप बहुत तेज़ है क्या ऊपर जा सकते हैं", "weather_heat"),
    ("नक्काशी समझाने के लिए कोई स्थानीय गाइड मिलेगा", "guide"), ("शुरुआती लोगों के लिए बोल्डरिंग कहाँ करें", "adventure"),
    ("नमस्कार कैसे हैं आप", "greeting"), ("कई हाथों वाले नाचते भगवान की कहानी क्या है", "sculpture"),
    ("चालुक्यों ने बादामी को राजधानी क्यों बनाया", "about_place"), ("बनशंकरी मंदिर के पास शाकाहारी थाली", "food"),
    ("चार लोगों के परिवार के लिए दो रात का कमरा", "stay"), ("तीसरी गुफा में कौन से देवता बने हैं", "sculpture"),
    # romanised / speech-to-text style
    ("hasivagide oota elli sigutte", "food"), ("room sikkuttaa ivattu raatri", "stay"), ("car elli nillisbeku", "parking"),
    ("aihole kitna door hai yahan se", "route_distance"), ("pattadakal kab band hota hai", "timings_entry"),
    ("sunday bheed jyada hogi kya", "best_time_crowd"), ("help help ambulance bejo", "safety_emergency"),
    ("dadi ke liye seedhi kam wali jagah", "accessibility"), ("ek din ka plan batao", "itinerary"), ("ilkal seere yelli kollodu", "shopping_crafts"),
]
