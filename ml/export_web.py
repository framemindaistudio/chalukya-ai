"""Copies trained artefacts and curated data into the web app (web/src/data, web/public/models)."""
import json
import shutil
import sys
from pathlib import Path

ML = Path(__file__).parent
WEB = ML.parent / "web"
DATA, MODELS = WEB / "src" / "data", WEB / "public" / "models"
DATA.mkdir(parents=True, exist_ok=True); MODELS.mkdir(parents=True, exist_ok=True)


def copy_json(src, name, transform=None):
    d = json.load(open(src, encoding="utf8"))
    if transform: d = transform(d)
    (DATA / name).write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    print(f"  {name:28s} {(DATA / name).stat().st_size / 1024:7.1f} KB")


print("data ->", DATA)
copy_json(ML / "kb" / "places.json", "places.json")
copy_json(ML / "kb" / "sculptures.json", "sculptures.json")
copy_json(ML / "data" / "businesses.json", "businesses.json")
copy_json(ML / "data" / "distances.json", "distances.json")
copy_json(ML / "forecast" / "out" / "footfall_forecast.json", "footfall.json")
copy_json(ML / "forecast" / "out" / "parking_days.json", "parking.json")
copy_json(ML / "forecast" / "out" / "parking_lite.json", "parking_model.json")
copy_json(ML / "forecast" / "out" / "calendar.json", "calendar.json")
copy_json(ML / "assistant" / "out" / "lexicon.json", "lexicon.json")

metrics = {}
for key, path in {"footfall": "forecast/out/footfall_metrics.json", "parking": "forecast/out/parking_metrics.json",
                  "intent": "assistant/out/intent_comparison.json", "vision": "vision/out/efficientnet_b0/metrics.json",
                  "vision_openset": "vision/out/efficientnet_b0/ood_report.json",
                  "reviews": "reviews/out/review_metrics.json"}.items():
    p = ML / path
    if p.exists():
        m = json.load(open(p, encoding="utf8")); m.pop("history", None); metrics[key] = m
(DATA / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=1), encoding="utf8")
print("  metrics.json")

# Large, lazily-loaded artefacts go to /public so they are fetched only when a screen needs them
shutil.copy(ML / "assistant" / "out" / "intent_model.json", MODELS / "intent_model.json")
shutil.copy(ML / "reviews" / "out" / "review_model.json", MODELS / "review_model.json")
sys.path.insert(0, str(ML / "reviews"))
from reviews_data import SAMPLES
(DATA / "review_samples.json").write_text(json.dumps([{"place": p, "text": t, "stars": st} for p, t, st in SAMPLES], ensure_ascii=False), encoding="utf8")
v = ML / "vision" / "out" / "efficientnet_b0"
if (v / "model.onnx").exists():
    shutil.copy(v / "model.onnx", MODELS / "sculpture.onnx")
    shutil.copy(v / "labels.json", MODELS / "sculpture_labels.json")
    if (v / "calibration.json").exists(): shutil.copy(v / "calibration.json", MODELS / "sculpture_calibration.json")
    print("  models/sculpture.onnx", round((MODELS / "sculpture.onnx").stat().st_size / 1e6, 1), "MB")
print("done")
