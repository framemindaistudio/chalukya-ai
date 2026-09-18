"""
Compares intent-classification approaches on (1) unseen phrasing templates (GroupKFold) and
(2) a separately written fresh test set. Writes out/intent_comparison.json.

  A  char n-gram TF-IDF + logistic regression    (runs in the browser, offline)
  B  curated lexicon only                         (rules)
  C  A + B hybrid                                 (browser default)
  D  multilingual-e5-small embeddings + LR        (server, semantic)
  E  C + D hybrid                                 (server default)
"""
import json
import os
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold

from fresh_test import FRESH
from intents_data import expand, mask
from lexicon import lex_counts

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
OUT = Path(__file__).parent / "out"
rows = expand()
X = [r[0] for r in rows]; y = np.array([r[1] for r in rows]); groups = [r[3] for r in rows]
classes = sorted(set(y))
Xf = [mask(q) for q, _ in FRESH]; yf = np.array([l for _, l in FRESH])

from sentence_transformers import SentenceTransformer
emb_model = SentenceTransformer("intfloat/multilingual-e5-small")
def embed(texts): return emb_model.encode(["query: " + t.replace("#", "place") for t in texts], normalize_embeddings=True, batch_size=64)
E_all, E_fresh = embed(X), embed(Xf)


def softmax(z, beta=1.0):
    z = beta * (z - z.max(1, keepdims=True)); e = np.exp(z); return e / e.sum(1, keepdims=True)


def p_lex(texts):
    C = np.array([lex_counts(t, classes) for t in texts], dtype=float)
    P = softmax(C, 3.0)
    P[C.sum(1) == 0] = 1 / len(classes)          # no keyword hit -> uninformative
    return P


def fit_char(Xtr, ytr):
    v = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), sublinear_tf=True, max_features=4000)
    m = LogisticRegression(C=12, max_iter=3000).fit(v.fit_transform(Xtr), ytr)
    return lambda t: m.predict_proba(v.transform(t))


def fit_emb(Etr, ytr):
    m = LogisticRegression(C=8, max_iter=3000).fit(Etr, ytr)
    return lambda E: m.predict_proba(E)


def evaluate(P, ytrue): return float((np.array(classes)[P.argmax(1)] == ytrue).mean())


res = {k: {"unseen_templates": None, "fresh_test": None} for k in "ABCDE"}
names = {"A": "char n-gram LR (browser)", "B": "lexicon only", "C": "char LR + lexicon (browser default)",
         "D": "multilingual-e5 embeddings + LR", "E": "char LR + lexicon + e5 (server default)"}
acc = {k: [] for k in "ABCDE"}
for tr, te in GroupKFold(5).split(X, y, groups):
    Xtr = [X[i] for i in tr]; Xte = [X[i] for i in te]
    pa = fit_char(Xtr, y[tr])(Xte); pb = p_lex(Xte); pd = fit_emb(E_all[tr], y[tr])(E_all[te])
    for k, P in {"A": pa, "B": pb, "C": 0.5 * pa + 0.5 * pb, "D": pd, "E": (pa + pb + pd) / 3}.items():
        acc[k].append((evaluate(P, y[te]), len(te)))
for k in acc:
    res[k]["unseen_templates"] = round(sum(a * n for a, n in acc[k]) / sum(n for _, n in acc[k]), 3)

pa = fit_char(X, y)(Xf); pb = p_lex(Xf); pd = fit_emb(E_all, y)(E_fresh)
for k, P in {"A": pa, "B": pb, "C": 0.5 * pa + 0.5 * pb, "D": pd, "E": (pa + pb + pd) / 3}.items():
    res[k]["fresh_test"] = round(evaluate(P, yf), 3)

out = {"n_train_examples": len(X), "n_fresh_test": len(FRESH),
       "results": {names[k]: v for k, v in res.items()},
       "note": "The lexicon is hand-curated by the team, so its scores are an upper-bound style estimate; the fresh test set was written separately from the training templates."}
(OUT / "intent_comparison.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf8")
print(json.dumps(out, indent=2, ensure_ascii=False))
