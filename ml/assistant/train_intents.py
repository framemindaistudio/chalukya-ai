"""
Multilingual intent classifier for the voice/text assistant.

Character n-gram TF-IDF (script-agnostic: works the same for Kannada, Devanagari and Latin, and is
robust to speech-to-text spelling noise) + multinomial logistic regression.
Evaluated with GroupKFold over *templates*, so every test sentence is a phrasing the model never saw.
Exported as plain JSON so the SAME model runs offline in the browser (web/src/lib/intent.ts).

    python train_intents.py -> out/intent_model.json, out/intent_metrics.json
"""
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import make_pipeline

from intents_data import expand, mask

OUT = Path(__file__).parent / "out"; OUT.mkdir(exist_ok=True)
rows = expand()
X = [r[0] for r in rows]; y = np.array([r[1] for r in rows]); lang = np.array([r[2] for r in rows]); groups = [r[3] for r in rows]


def make():
    return make_pipeline(
        TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), lowercase=True, sublinear_tf=True, max_features=4000),
        LogisticRegression(C=12, max_iter=3000),
    )


pred = np.empty_like(y)
for tr, te in GroupKFold(n_splits=5).split(X, y, groups):
    m = make().fit([X[i] for i in tr], y[tr])
    pred[te] = m.predict([X[i] for i in te])

by_lang = {l: {"n": int((lang == l).sum()), "accuracy": round(float(accuracy_score(y[lang == l], pred[lang == l])), 3)} for l in ("en", "kn", "hi", "rom")}
confusions = defaultdict(int)
for a, b in zip(y, pred):
    if a != b: confusions[f"{a} -> {b}"] += 1
metrics = {
    "model": "char n-gram (2-4) TF-IDF + multinomial logistic regression",
    "evaluation": "5-fold GroupKFold over phrasing templates (test phrasings never seen in training)",
    "n_examples": len(X), "n_templates": len(set(groups)), "n_intents": len(set(y)),
    "accuracy": round(float(accuracy_score(y, pred)), 3), "macro_f1": round(float(f1_score(y, pred, average="macro")), 3),
    "by_language": by_lang, "top_confusions": sorted(confusions.items(), key=lambda kv: -kv[1])[:8],
}
(OUT / "intent_metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf8")
print(json.dumps(metrics, indent=2, ensure_ascii=False))

# Final model on all data, exported for the browser + server
final = make().fit(X, y)
vec, clf = final.named_steps["tfidfvectorizer"], final.named_steps["logisticregression"]
vocab = {k: int(v) for k, v in vec.vocabulary_.items()}
export = {
    "ngram_range": list(vec.ngram_range), "classes": clf.classes_.tolist(),
    "vocab": vocab, "idf": [round(float(v), 4) for v in vec.idf_],
    "coef": [[round(float(v), 3) for v in row] for row in clf.coef_], "intercept": [round(float(v), 4) for v in clf.intercept_],
}
(OUT / "intent_model.json").write_text(json.dumps(export, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
print("exported", (OUT / "intent_model.json").stat().st_size // 1024, "KB")

for q in ["ಪಟ್ಟದಕಲ್ಲು ಹತ್ತಿರ ಶುದ್ಧ ಸಸ್ಯಾಹಾರಿ ಊಟ ಎಲ್ಲಿ", "बादामी में पार्किंग खाली है?", "who carved the dancing shiva", "aihole ge hege hogodu",
          "is it crowded at pattadakal on sunday", "ನಾಳೆ ಬಾದಾಮಿ ಪ್ರವಾಸ ಯೋಜನೆ ಮಾಡಿ", "mujhe ambulance chahiye", "ilkal saree shop"]:
    p = final.predict_proba([mask(q)])[0]; i = p.argmax()
    print(f"{q:45s} -> {clf.classes_[i]} ({p[i]:.2f})")
