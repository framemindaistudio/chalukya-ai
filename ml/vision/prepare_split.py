"""
Photographer-grouped train/val/test split.

Why grouped: one photographer usually uploads several near-identical shots of the same
sculpture from the same visit. A random split would put near-duplicates on both sides and
inflate test accuracy. Here every (class, photographer) group goes to exactly ONE split, so the
test set measures recognition of photos taken by people the model has never seen.

    python prepare_split.py      ->  data/splits.csv  (file, class, split)
"""
import csv
import random
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent / "data"
TEST, VAL = 0.18, 0.12
random.seed(42)

rows = list(csv.DictReader(open(ROOT / "metadata.csv", encoding="utf-8")))
by_class = defaultdict(lambda: defaultdict(list))
for r in rows:
    by_class[r["class"]][r["uploader"] or "unknown"].append(r["file"])

out, summary = [], []
for cls, groups in sorted(by_class.items()):
    n = sum(len(v) for v in groups.values())
    items = list(groups.items())
    random.shuffle(items)
    # Small groups first, so the held-out splits get many different photographers rather than one big one
    items.sort(key=lambda kv: len(kv[1]))
    split_of, counts = {}, {"test": 0, "val": 0, "train": 0}
    for uploader, files in items:
        if counts["test"] + len(files) <= max(2, round(n * TEST)) and counts["test"] < n * TEST:
            s = "test"
        elif counts["val"] + len(files) <= max(2, round(n * VAL)) and counts["val"] < n * VAL:
            s = "val"
        else:
            s = "train"
        counts[s] += len(files)
        for f in files:
            out.append({"file": f, "class": cls, "split": s})
    summary.append((cls, n, counts["train"], counts["val"], counts["test"], len(groups)))

with open(ROOT / "splits.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=["file", "class", "split"])
    w.writeheader(); w.writerows(out)

print(f"{'class':32s} {'total':>5s} {'train':>5s} {'val':>4s} {'test':>4s} {'photographers':>13s}")
for s in summary:
    print(f"{s[0]:32s} {s[1]:5d} {s[2]:5d} {s[3]:4d} {s[4]:4d} {s[5]:13d}")
tot = [sum(s[i] for s in summary) for i in (1, 2, 3, 4)]
print(f"{'TOTAL':32s} {tot[0]:5d} {tot[1]:5d} {tot[2]:4d} {tot[3]:4d}")
