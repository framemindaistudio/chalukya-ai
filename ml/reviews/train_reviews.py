"""
Visitor review analysis: sentiment (positive / negative / mixed) + facility aspects
(toilets & cleanliness, drinking water, parking, crowd, guides & information, safety, food,
accessibility, heat & shade), in Kannada, Hindi, English and romanised text.

  Sentiment: char n-gram TF-IDF + logistic regression (exported for the phone) and
             multilingual-e5 embeddings + logistic regression (server); evaluated on a held-out set.
  Aspects:   curated trilingual lexicon (phone) and lexicon ∪ e5 one-vs-rest classifiers (server).
Outputs: out/review_model.json (phone), out/review_metrics.json
"""
import json
import os
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score

from reviews_data import TEST, TRAIN

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
OUT = Path(__file__).parent / "out"; OUT.mkdir(exist_ok=True)
ASPECTS = ["toilets", "water", "parking", "crowd", "guides", "safety", "food", "access", "heat"]
LEX = {
    "toilets": ["toilet", "washroom", "restroom", "bathroom", "dustbin", "garbage", "plastic", "dirty", "filthy", "stink", "litter", "clean",
                "ಶೌಚಾಲಯ", "ಸ್ವಚ್ಛ", "ಗಲೀಜು", "ಕಸ", "ಪ್ಲಾಸ್ಟಿಕ್", "शौचालय", "टॉयलेट", "सफ़ाई", "साफ़", "गंदे", "कूड़", "प्लास्टिक", "galiju", "gande"],
    "water": ["water", "drinking", "bottle", "tap", "cooler", "ನೀರು", "ನೀರೇ", "ನೀರಿನ", "पानी", "neeru", "paani"],
    "parking": ["parking", "park ", "car ", "vehicle", "spot", "ಪಾರ್ಕಿಂಗ್", "ವಾಹನ", "ಕಾರು", "पार्किंग", "गाड़ी"],
    "crowd": ["crowd", "rush", "queue", "packed", "school groups", "hardly any", "ಜನ ", "ಜನಸಂದಣಿ", "ರಶ್", "ಸಾಲು", "भीड़", "लाइन", "bheed", "jana "],
    "guides": ["guide", "board", "information", "explain", "signage", "pravasi", "audio", "museum", "ಮಾರ್ಗದರ್ಶಿ", "ಫಲಕ", "ಮಾಹಿತಿ", "ವಿವರಿಸ",
               "ಪ್ರವಾಸಿ ಮಿತ್ರ", "गाइड", "बोर्ड", "सूचना", "समझा", "प्रवासी मित्र", "जानकार"],
    "safety": ["safe", "police", "security", "harass", "drunk", "monkey", "slippery", "dark", "ಸುರಕ್ಷಿತ", "ಪೊಲೀಸ", "ಭದ್ರತಾ", "ತೊಂದರೆ", "ಮಂಗ",
               "ಜಾರು", "ಬೆಳಕಿಲ್ಲ", "ಭಯ", "सुरक्षित", "पुलिस", "सुरक्षा", "परेशान", "बंदर", "फिसलन", "रोशनी", "डर"],
    "food": ["food", " eat", "meal", "thali", "restaurant", "lunch", "rotti", "dhaba", "ಊಟ", "ರೊಟ್ಟಿ", "ಹೋಟೆಲ್", "ಖಾನಾವಳಿ", "खाना", "रोटी", "थाली", "ढाबा", "oota", "khana"],
    "access": ["steps", "stairs", "wheelchair", "ramp", "elderly", "railing", "grandmother", "walker", "ಮೆಟ್ಟಿಲು", "ಗಾಲಿಕುರ್ಚಿ", "ಹಿರಿಯ", "ಅಜ್ಜಿ",
               "ವಯಸ್ಸಾದ", "ಹಿಡಿಕೆ", "सीढ़ि", "व्हीलचेयर", "बुज़ुर्ग", "दादी", "रेलिंग", "seedhi"],
    "heat": ["hot", "heat", "sun ", "shade", "scorching", "umbrella", "ಬಿಸಿಲು", "ಬಿಸಿಲಿನ", "ನೆರಳು", "ತಾಪ", "गर्मी", "धूप", "छाया", "bisilu", "garmi"],
}


POS = ["beautiful", "stunning", "clean", "great", "loved", "love", "amazing", "helpful", "safe", "tasty", "lovely", "easy", "excellent", "peaceful", "magical", "good", "nice", "enjoyed", "must visit", "breathtaking", "perfect",
       "ಸುಂದರ", "ಚೆನ್ನಾಗಿ", "ಅದ್ಭುತ", "ಸ್ವಚ್ಛ", "ರುಚಿ", "ಸುಲಭ", "ಸಹಾಯ", "ಒಳ್ಳೆ", "ಖುಷಿ", "ಜ್ಞಾನಿ", "ಶಾಂತ", "ಸುರಕ್ಷಿತ",
       "अच्छा", "अच्छे", "सुंदर", "शानदार", "साफ़", "स्वादिष्ट", "आसान", "मदद", "बढ़िया", "जानकार", "शांत", "सुरक्षित", "मज़ा", "super", "chennagi", "ruchi", "accha"]
NEG = ["dirty", "filthy", "stink", "no ", "not ", "locked", "broken", "harass", "unsafe", "full", "circled", "rush", "packed", "scorching", "faded", "overpriced", "impossible", "hardly any decent", "difficult", "careful", "shouting", "drunk", "waited", "pestering",
       "ಇಲ್ಲ", "ಗಲೀಜು", "ಕಷ್ಟ", "ತೊಂದರೆ", "ಕೆಟ್ಟ", "ಸಿಗಲಿಲ್ಲ", "ಭಯ", "ಜಾಸ್ತಿ", "ತಡೆಯಲಾಗಲಿಲ್ಲ", "ಆಗಲೇ ಇಲ್ಲ",
       "नहीं", "गंदे", "खराब", "परेशान", "डर", "भीड़", "मुश्किल", "महँगा", "बर्दाश्त", "धुंधले", "illa", "nahi", "gande", "galiju", "bheed"]
CONTRAST = [" but ", " though", "ಆದರೆ", "ಆದರೂ", "लेकिन", " पर ", "सुधार", "ಸುಧಾರಿಸ", "need work"]


def polarity(t: str):
    t = " " + t.lower() + " "
    pos = sum(k in t for k in POS); neg = sum(k in t for k in NEG); con = any(k in t for k in CONTRAST)
    if pos and (neg or con) and con: return {"mix": 0.8, "pos": 0.1, "neg": 0.1}
    if neg > pos: return {"neg": 0.8, "mix": 0.1, "pos": 0.1}
    if pos > neg: return {"pos": 0.8, "mix": 0.1, "neg": 0.1}
    return None


def lex_aspects(t: str):
    t = " " + t.lower() + " "
    return [a for a in ASPECTS if any(k in t for k in LEX[a])]


def multi_f1(true, pred):
    tp = sum(len(set(a) & set(b)) for a, b in zip(true, pred)); fp = sum(len(set(b) - set(a)) for a, b in zip(true, pred)); fn = sum(len(set(a) - set(b)) for a, b in zip(true, pred))
    p = tp / max(tp + fp, 1); r = tp / max(tp + fn, 1)
    return round(2 * p * r / max(p + r, 1e-9), 3), round(p, 3), round(r, 3)


Xtr = [t for t, _, _ in TRAIN]; ytr = np.array([s for _, s, _ in TRAIN]); Atr = [a for _, _, a in TRAIN]
Xte = [t for t, _, _ in TEST]; yte = np.array([s for _, s, _ in TEST]); Ate = [a for _, _, a in TEST]

vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), sublinear_tf=True, max_features=3000)
char = LogisticRegression(C=10, max_iter=3000, class_weight="balanced").fit(vec.fit_transform(Xtr), ytr)
p_char = char.predict(vec.transform(Xte))

from sentence_transformers import SentenceTransformer
emb = SentenceTransformer("intfloat/multilingual-e5-small")
Etr = emb.encode(["query: " + t for t in Xtr], normalize_embeddings=True); Ete = emb.encode(["query: " + t for t in Xte], normalize_embeddings=True)
e5 = LogisticRegression(C=8, max_iter=3000, class_weight="balanced").fit(Etr, ytr)
p_e5 = e5.predict(Ete)
def phone_hybrid(texts):
    P = char.predict_proba(vec.transform(texts))
    for i, t in enumerate(texts):
        pol = polarity(t)
        if pol: P[i] = 0.4 * P[i] + 0.6 * np.array([pol[c] for c in char.classes_])
    return np.array(char.classes_)[P.argmax(1)]
p_phone = phone_hybrid(Xte)
p_hyb = np.array(e5.classes_)[(e5.predict_proba(Ete) + char.predict_proba(vec.transform(Xte))).argmax(1)]

# aspects: lexicon, and lexicon ∪ e5 one-vs-rest
lex_pred = [lex_aspects(t) for t in Xte]
ovr = {}
for a in ASPECTS:
    y = np.array([a in s for s in Atr])
    if y.sum() >= 3: ovr[a] = LogisticRegression(C=4, max_iter=3000, class_weight="balanced").fit(Etr, y)
e5_pred = [[a for a, m in ovr.items() if m.predict_proba(Ete[i:i + 1])[0, 1] > 0.6] for i in range(len(Xte))]
union = [sorted(set(a) | set(b)) for a, b in zip(lex_pred, e5_pred)]

metrics = {
    "data": f"{len(TRAIN)} labelled training reviews, {len(TEST)} separately written test reviews (en/kn/hi/romanised)",
    "sentiment_accuracy": {"char_ngram_phone": round(float(accuracy_score(yte, p_char)), 3), "char_plus_polarity_lexicon_phone": round(float(accuracy_score(yte, p_phone)), 3), "e5_server": round(float(accuracy_score(yte, p_e5)), 3), "hybrid_server": round(float(accuracy_score(yte, p_hyb)), 3)},
    "sentiment_macro_f1": {"char_ngram_phone": round(float(f1_score(yte, p_char, average="macro")), 3), "char_plus_polarity_lexicon_phone": round(float(f1_score(yte, p_phone, average="macro")), 3), "e5_server": round(float(f1_score(yte, p_e5, average="macro")), 3), "hybrid_server": round(float(f1_score(yte, p_hyb, average="macro")), 3)},
    "aspect_f1_precision_recall": {"lexicon_phone": multi_f1(Ate, lex_pred), "lexicon_plus_e5_server": multi_f1(Ate, union)},
    "note": "Small, team-written dataset. The keyword lexicons were curated by the same team that wrote the test reviews, so lexicon scores are optimistic; the e5 model is the fair number. Add real moderated in-app reviews before relying on it.",
}
(OUT / "review_metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf8")
print(json.dumps(metrics, indent=2, ensure_ascii=False))
for t, y, p in zip(Xte, yte, p_hyb):
    if y != p: print("  miss:", y, "->", p, "|", t[:60])

vec2 = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), sublinear_tf=True, max_features=3000)
full = LogisticRegression(C=10, max_iter=3000, class_weight="balanced").fit(vec2.fit_transform(Xtr + Xte), list(ytr) + list(yte))
export = {"ngram_range": [2, 4], "classes": full.classes_.tolist(), "vocab": {k: int(v) for k, v in vec2.vocabulary_.items()},
          "idf": [round(float(v), 4) for v in vec2.idf_], "coef": [[round(float(v), 3) for v in r] for r in full.coef_],
          "intercept": [round(float(v), 4) for v in full.intercept_], "aspects": ASPECTS, "lex": LEX, "pos": POS, "neg": NEG, "contrast": CONTRAST}
(OUT / "review_model.json").write_text(json.dumps(export, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
print("exported", (OUT / "review_model.json").stat().st_size // 1024, "KB")
