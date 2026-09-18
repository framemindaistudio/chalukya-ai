"""
Parking availability forecasting (IoT + ML).

IoT sensors report occupancy every 10 minutes (simulated here from the footfall model with a
queue: arrivals from the hourly visitor curve, departures after a gamma-distributed dwell time,
cars turned away when full). LightGBM then predicts occupancy 30, 60 and 120 minutes ahead from:
current occupancy, its 30-minute trend, time of day, weekday, holiday/festival flags and the
day's forecast footfall. Baseline: persistence ("it will stay as it is now").

    python train_parking.py -> out/parking_metrics.json, out/parking_model_h{30,60,120}.txt, out/parking_today.json
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from calendar_features import features
from simulate import PARKING_LOTS, simulate_daily, simulate_parking

OUT = Path(__file__).parent / "out"; OUT.mkdir(exist_ok=True)
HORIZONS = {30: 3, 60: 6, 120: 12}  # minutes -> steps of 10 min
FEATS = ["occ_frac", "trend30", "minute_of_day", "dow", "weekend", "holiday", "long_weekend", "school_vacation",
         "festival", "day_visitors_k", "capacity", "lot_idx"]


def build(df: pd.DataFrame, daily: pd.DataFrame) -> pd.DataFrame:
    dv = daily.set_index(["site", "date"]).visitors
    lot_idx = {l[0]: i for i, l in enumerate(PARKING_LOTS)}
    parts = []
    for lot, g in df.groupby("lot"):
        g = g.sort_values("ts").copy()
        g["date"] = g.ts.dt.date
        g["occ_frac"] = g.occupied / g.capacity
        g["trend30"] = g.groupby("date").occ_frac.diff(3).fillna(0)
        for h, s in HORIZONS.items():
            g[f"y{h}"] = g.groupby("date").occ_frac.shift(-s)
        cal = {d: features(d) for d in g.date.unique()}
        for k in ("dow", "weekend", "holiday", "long_weekend", "school_vacation"):
            g[k] = g.date.map(lambda d: cal[d][k])
        g["festival"] = g.date.map(lambda d: int(cal[d]["diwali_window"] or cal[d]["dasara_window"] or cal[d]["jatre"] or cal[d]["heritage_free_entry"]))
        g["minute_of_day"] = g.ts.dt.hour * 60 + g.ts.dt.minute
        g["day_visitors_k"] = [dv.get((s, d), 0) / 1000 for s, d in zip(g.site, g.date)]
        g["lot_idx"] = lot_idx[lot]
        parts.append(g)
    return pd.concat(parts)


def main():
    daily = simulate_daily(end="2026-12-31")
    print("simulating 10-minute IoT occupancy for", len(PARKING_LOTS), "lots…", flush=True)
    occ = simulate_parking(daily, start="2024-01-01", end="2026-02-28")
    occ.to_csv(OUT / "parking_simulated.csv.gz", index=False, compression="gzip")
    X = build(occ, daily)
    split = pd.Timestamp("2025-11-01")   # test on the winter peak season, when lots actually fill
    metrics = {"data": "simulated 10-minute IoT occupancy (queue model driven by the footfall simulation)",
               "train": "2024-01-01..2025-10-31", "test": "2025-11-01..2026-02-28 (peak season)", "horizons": {}}
    for h in HORIZONS:
        d = X.dropna(subset=[f"y{h}"])
        tr, te = d[d.ts < split], d[d.ts >= split]
        m = lgb.LGBMRegressor(n_estimators=500, learning_rate=0.05, num_leaves=63, min_child_samples=40, subsample=0.8,
                              subsample_freq=1, colsample_bytree=0.9, verbose=-1)
        m.fit(tr[FEATS], tr[f"y{h}"])
        p = np.clip(m.predict(te[FEATS]), 0, 1)
        cap = te.capacity.values
        mae_slots = float(np.mean(np.abs(p - te[f"y{h}"].values) * cap))
        base = float(np.mean(np.abs(te.occ_frac.values - te[f"y{h}"].values) * cap))
        # "Will I find a slot?" as a yes/no: full = more than 95% occupied
        full_true, full_pred = te[f"y{h}"].values > .95, p > .95
        tp = int((full_true & full_pred).sum()); fp = int((~full_true & full_pred).sum()); fn = int((full_true & ~full_pred).sum())
        metrics["horizons"][f"{h}min"] = {
            "mae_slots_model": round(mae_slots, 2), "mae_slots_persistence": round(base, 2),
            "improvement_vs_persistence": round(1 - mae_slots / base, 3),
            "lot_full_precision": round(tp / max(tp + fp, 1), 3), "lot_full_recall": round(tp / max(tp + fn, 1), 3),
        }
        metrics["horizons"][f"{h}min"]["test_share_of_time_full"] = round(float(full_true.mean()), 3)
        m.booster_.save_model(str(OUT / f"parking_model_h{h}.txt"))
        print(h, metrics["horizons"][f"{h}min"], flush=True)
    (OUT / "parking_metrics.json").write_text(json.dumps(metrics, indent=2))

    # A realistic "today" curve for each lot, used to seed the live IoT stream in the app
    today = dt.date(2026, 9, 18)
    occ_today = simulate_parking(daily, start=str(today), end=str(today + dt.timedelta(days=9)), seed=99)
    out = {}
    for lot, site, name, cap, lat, lng, _ in PARKING_LOTS:
        g = occ_today[occ_today.lot == lot]
        out[lot] = {"site": site, "name": name, "capacity": cap, "lat": lat, "lng": lng,
                    "days": {str(d): g[g.ts.dt.date == d].occupied.tolist() for d in sorted(g.ts.dt.date.unique())}}
    (OUT / "parking_days.json").write_text(json.dumps({"step_min": 10, "start_hour": 6, "lots": out}, separators=(",", ":")))




def export_lite():
    """Small LightGBM models (120 trees x 15 leaves) exported as JSON so the phone can run the same
    kind of model offline. Also exports the calendar features the models need for the next months."""
    daily = simulate_daily(end="2026-12-31")
    occ = pd.read_csv(OUT / "parking_simulated.csv.gz", parse_dates=["ts"])
    X = build(occ, daily)
    split = pd.Timestamp("2025-11-01")
    lite = {"features": FEATS, "horizons": {}, "metrics": {}}
    for h in HORIZONS:
        d = X.dropna(subset=[f"y{h}"]); tr, te = d[d.ts < split], d[d.ts >= split]
        m = lgb.LGBMRegressor(n_estimators=120, learning_rate=0.08, num_leaves=15, min_child_samples=60, verbose=-1)
        m.fit(tr[FEATS], tr[f"y{h}"])
        p = np.clip(m.predict(te[FEATS]), 0, 1); cap = te.capacity.values
        lite["metrics"][f"{h}min"] = {"mae_slots_lite": round(float(np.mean(np.abs(p - te[f"y{h}"].values) * cap)), 2)}
        dump = m.booster_.dump_model()
        def conv(n):
            if "leaf_value" in n: return round(n["leaf_value"], 5)
            return [n["split_feature"], round(n["threshold"], 5), conv(n["left_child"]), conv(n["right_child"])]
        lite["horizons"][str(h)] = {"init": 0.0, "trees": [conv(t["tree_structure"]) for t in dump["tree_info"]]}
    lite["lots"] = [l[0] for l in PARKING_LOTS]
    (OUT / "parking_lite.json").write_text(json.dumps(lite, separators=(",", ":")))
    cal = {}
    for d in pd.date_range("2026-09-18", "2026-12-31").date:
        f = features(d)
        cal[str(d)] = [f["dow"], f["weekend"], f["holiday"], f["long_weekend"], f["school_vacation"],
                       int(f["diwali_window"] or f["dasara_window"] or f["jatre"] or f["heritage_free_entry"])]
    (OUT / "calendar.json").write_text(json.dumps({"fields": ["dow", "weekend", "holiday", "long_weekend", "school_vacation", "festival"], "days": cal}, separators=(",", ":")))
    print("lite models:", lite["metrics"], (OUT / "parking_lite.json").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    import sys
    export_lite() if "--lite" in sys.argv else (main(), export_lite())
