"""
Fine-tunes an ImageNet-pretrained CNN (transfer learning) to recognise 25 Chalukyan sculptures
and monuments, evaluates it on the photographer-held-out test set, and exports ONNX for
on-device (browser) and server inference.

    python train.py --model efficientnet_b0 --epochs 14
Outputs (in ml/vision/out/<model>/):
    best.pt, model.onnx, labels.json, metrics.json, confusion.png, per_class.csv, curves.png
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
import time
from pathlib import Path

import numpy as np
import timm
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import transforms as T

ROOT = Path(__file__).parent
DATA = ROOT / "data"
MEAN, STD = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)


def seed_all(s=42):
    random.seed(s); np.random.seed(s); torch.manual_seed(s)


def load_rows():
    rows = list(csv.DictReader(open(DATA / "splits.csv", encoding="utf-8")))
    classes = sorted({r["class"] for r in rows})
    return rows, classes


class Mem(Dataset):
    """Images are decoded once and kept in RAM (shorter side 288px): CPU training is I/O-bound otherwise."""
    cache: dict[str, Image.Image] = {}

    def __init__(self, rows, cidx, tf):
        self.rows, self.cidx, self.tf = rows, cidx, tf

    @classmethod
    def img(cls, f):
        if f not in cls.cache:
            im = Image.open(DATA / "raw" / f).convert("RGB")
            s = 288 / min(im.size)
            cls.cache[f] = im.resize((max(288, round(im.width * s)), max(288, round(im.height * s))), Image.BICUBIC)
        return cls.cache[f]

    def __len__(self): return len(self.rows)

    def __getitem__(self, i):
        r = self.rows[i]
        return self.tf(self.img(r["file"])), self.cidx[r["class"]]


def transforms(size):
    train = T.Compose([
        T.RandomResizedCrop(size, scale=(0.45, 1.0), ratio=(0.7, 1.4)),
        T.RandomHorizontalFlip(),
        T.RandomApply([T.RandomRotation(12)], p=0.4),
        T.RandomApply([T.RandomPerspective(0.25, p=1.0)], p=0.3),        # tourists shoot at angles
        T.ColorJitter(0.45, 0.4, 0.35, 0.05),                              # harsh sun vs dim caves
        T.RandomApply([T.GaussianBlur(5, (0.1, 2.0))], p=0.25),           # shaky phone shots
        T.RandomGrayscale(0.05),
        T.ToTensor(), T.Normalize(MEAN, STD),
        T.RandomErasing(p=0.35, scale=(0.02, 0.15)),                       # people standing in front
    ])
    test = T.Compose([T.Resize(int(size * 1.14)), T.CenterCrop(size), T.ToTensor(), T.Normalize(MEAN, STD)])
    return train, test


@torch.no_grad()
def predict(model, loader, tta=True):
    model.eval(); P, Y = [], []
    for x, y in loader:
        p = model(x).softmax(1)
        if tta: p = (p + model(torch.flip(x, dims=[3])).softmax(1)) / 2
        P.append(p); Y.append(y)
    return torch.cat(P).numpy(), torch.cat(Y).numpy()


def plot_confusion(cm, labels, path):
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    cmn = cm / np.maximum(cm.sum(1, keepdims=True), 1)
    fig, ax = plt.subplots(figsize=(13, 11))
    ax.imshow(cmn, cmap="Oranges", vmin=0, vmax=1)
    ax.set_xticks(range(len(labels))); ax.set_yticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=75, ha="right", fontsize=8); ax.set_yticklabels(labels, fontsize=8)
    for i in range(len(labels)):
        for j in range(len(labels)):
            if cm[i, j]: ax.text(j, i, cm[i, j], ha="center", va="center", fontsize=7, color="black" if cmn[i, j] < .6 else "white")
    ax.set_xlabel("Predicted"); ax.set_ylabel("True")
    ax.set_title("Confusion matrix: photographer-held-out test set")
    fig.tight_layout(); fig.savefig(path, dpi=130); plt.close(fig)


def plot_curves(hist, path):
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(1, 2, figsize=(11, 4))
    ep = [h["epoch"] for h in hist]
    ax[0].plot(ep, [h["train_loss"] for h in hist], label="train loss"); ax[0].legend(); ax[0].set_xlabel("epoch")
    ax[1].plot(ep, [h["val_acc"] for h in hist], label="val top-1"); ax[1].plot(ep, [h["val_f1"] for h in hist], label="val macro-F1")
    ax[1].legend(); ax[1].set_xlabel("epoch"); ax[1].set_ylim(0, 1)
    fig.tight_layout(); fig.savefig(path, dpi=120); plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="efficientnet_b0")
    ap.add_argument("--epochs", type=int, default=14)
    ap.add_argument("--warm", type=int, default=2, help="epochs training only the new head")
    ap.add_argument("--size", type=int, default=224)
    ap.add_argument("--bs", type=int, default=32)
    ap.add_argument("--lr", type=float, default=6e-4)
    ap.add_argument("--threads", type=int, default=10)
    a = ap.parse_args()
    seed_all(); torch.set_num_threads(a.threads)

    rows, classes = load_rows()
    cidx = {c: i for i, c in enumerate(classes)}
    out = ROOT / "out" / a.model; out.mkdir(parents=True, exist_ok=True)
    tr_rows = [r for r in rows if r["split"] == "train"]
    va_rows = [r for r in rows if r["split"] == "val"]
    te_rows = [r for r in rows if r["split"] == "test"]
    tf_tr, tf_te = transforms(a.size)
    print(f"train {len(tr_rows)}  val {len(va_rows)}  test {len(te_rows)}  classes {len(classes)}", flush=True)
    t0 = time.time()
    for r in rows: Mem.img(r["file"])
    print(f"decoded images in {time.time()-t0:.0f}s", flush=True)

    # Class-balanced sampling (∝ 1/sqrt(n)) so 12-image sculptures are not drowned out by 300-image temples
    counts = np.bincount([cidx[r["class"]] for r in tr_rows], minlength=len(classes))
    w = [1 / math.sqrt(counts[cidx[r["class"]]]) for r in tr_rows]
    sampler = WeightedRandomSampler(w, num_samples=len(tr_rows), replacement=True)
    dl_tr = DataLoader(Mem(tr_rows, cidx, tf_tr), batch_size=a.bs, sampler=sampler, num_workers=0)
    dl_va = DataLoader(Mem(va_rows, cidx, tf_te), batch_size=64)
    dl_te = DataLoader(Mem(te_rows, cidx, tf_te), batch_size=64)

    model = timm.create_model(a.model, pretrained=True, num_classes=len(classes), drop_rate=0.25)
    head = model.get_classifier()
    crit = nn.CrossEntropyLoss(label_smoothing=0.1)

    def run_epoch(opt, sched=None):
        model.train(); tot, n = 0.0, 0
        for x, y in dl_tr:
            opt.zero_grad(set_to_none=True)
            loss = crit(model(x), y); loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 2.0)
            opt.step()
            if sched: sched.step()
            tot += loss.item() * len(y); n += len(y)
        return tot / n

    hist, best, best_state = [], -1, None
    # Stage 1: warm up the new classifier head with the pretrained backbone frozen
    for p in model.parameters(): p.requires_grad = False
    for p in head.parameters(): p.requires_grad = True
    opt = torch.optim.AdamW(head.parameters(), lr=3e-3, weight_decay=1e-4)
    for ep in range(1, a.warm + 1):
        t = time.time(); loss = run_epoch(opt)
        P, Y = predict(model, dl_va, tta=False)
        acc, f1 = (P.argmax(1) == Y).mean(), f1_score(Y, P.argmax(1), average="macro")
        hist.append({"epoch": ep, "stage": "head", "train_loss": loss, "val_acc": float(acc), "val_f1": float(f1)})
        print(f"[head] ep {ep} loss {loss:.3f} val_acc {acc:.3f} val_f1 {f1:.3f} ({time.time()-t:.0f}s)", flush=True)

    # Stage 2: fine-tune everything, lower LR on the backbone, cosine schedule
    for p in model.parameters(): p.requires_grad = True
    head_ids = {id(p) for p in head.parameters()}
    opt = torch.optim.AdamW([
        {"params": [p for p in model.parameters() if id(p) not in head_ids], "lr": a.lr * 0.5},
        {"params": list(head.parameters()), "lr": a.lr},
    ], weight_decay=0.02)
    steps = a.epochs * len(dl_tr)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=[a.lr * 0.5, a.lr], total_steps=steps, pct_start=0.15)
    for ep in range(1, a.epochs + 1):
        t = time.time(); loss = run_epoch(opt, sched)
        P, Y = predict(model, dl_va, tta=False)
        acc, f1 = (P.argmax(1) == Y).mean(), f1_score(Y, P.argmax(1), average="macro")
        score = 0.5 * acc + 0.5 * f1
        hist.append({"epoch": a.warm + ep, "stage": "full", "train_loss": loss, "val_acc": float(acc), "val_f1": float(f1)})
        flag = ""
        if score > best:
            best, best_state, flag = score, {k: v.clone() for k, v in model.state_dict().items()}, "  *best"
        print(f"[full] ep {ep} loss {loss:.3f} val_acc {acc:.3f} val_f1 {f1:.3f} ({time.time()-t:.0f}s){flag}", flush=True)

    model.load_state_dict(best_state)
    torch.save({"state": best_state, "classes": classes, "model": a.model, "size": a.size}, out / "best.pt")

    # ── Test: photographer-held-out ──
    P, Y = predict(model, dl_te, tta=True)
    pred = P.argmax(1)
    top3 = np.mean([y in np.argsort(-p)[:3] for p, y in zip(P, Y)])
    site = lambda c: c.split("_")[0]
    site_acc = np.mean([site(classes[a_]) == site(classes[b_]) for a_, b_ in zip(pred, Y)])
    rep = classification_report(Y, pred, labels=range(len(classes)), target_names=classes, output_dict=True, zero_division=0)
    metrics = {
        "model": a.model, "params_m": round(sum(p.numel() for p in model.parameters()) / 1e6, 2),
        "n_train": len(tr_rows), "n_val": len(va_rows), "n_test": len(te_rows), "classes": len(classes),
        "test_top1": round(float((pred == Y).mean()), 4), "test_top3": round(float(top3), 4),
        "test_macro_f1": round(float(rep["macro avg"]["f1-score"]), 4),
        "test_site_accuracy": round(float(site_acc), 4),
        "split": "photographer-grouped (no photographer appears in both train and test for a class)",
        "history": hist,
    }
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2))
    with open(out / "per_class.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh); w.writerow(["class", "precision", "recall", "f1", "support"])
        for c in classes:
            r = rep[c]; w.writerow([c, f"{r['precision']:.3f}", f"{r['recall']:.3f}", f"{r['f1-score']:.3f}", int(r["support"])])
    plot_confusion(confusion_matrix(Y, pred, labels=range(len(classes))), classes, out / "confusion.png")
    plot_curves(hist, out / "curves.png")
    np.save(out / "test_probs.npy", P); np.save(out / "test_labels.npy", Y)
    (out / "labels.json").write_text(json.dumps(classes, indent=1))
    print(json.dumps({k: v for k, v in metrics.items() if k != "history"}, indent=2), flush=True)

    # ── Export ONNX (softmax probabilities out, so the browser needs no post-processing) ──
    class WithSoftmax(nn.Module):
        def __init__(self, m): super().__init__(); self.m = m
        def forward(self, x): return self.m(x).softmax(1)
    model.eval()
    torch.onnx.export(WithSoftmax(model), torch.randn(1, 3, a.size, a.size), out / "model.onnx",
                      input_names=["image"], output_names=["probs"], dynamic_axes={"image": {0: "n"}, "probs": {0: "n"}},
                      opset_version=17, dynamo=False)
    print(f"ONNX -> {out/'model.onnx'} ({(out/'model.onnx').stat().st_size/1e6:.1f} MB)", flush=True)


if __name__ == "__main__":
    main()
