"""
Daily visitor forecasting with LightGBM (median + P10/P90 quantile models), evaluated on a
time-based holdout against two baselines, then used to forecast the coming months.

    python train_footfall.py   -> out/footfall_metrics.json, out/footfall_forecast.json, out/footfall_test.png
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from calendar_features import features, label
from simulate import ASI_FY2425, SITES, hourly_profile, simulate_daily

OUT = Path(__file__).parent / "out"; OUT.mkdir(exist_ok=True)
TODAY = dt.date(2026, 9, 18)
TRAIN_END, TEST_END = dt.date(2025, 12, 31), dt.date(2026, 8, 31)
HORIZON_END = dt.date(2026, 12, 31)
# People comfortably present at once. Assumed carrying capacity, used for crowd levels.
CAPACITY = {"badami_caves": 350, "pattadakal": 600, "aihole": 400, "banashankari": 1500, "mahakuta": 250, "kudalasangama": 1200}
DWELL_H = {"badami_caves": 1.6, "pattadakal": 1.8, "aihole": 1.7, "banashankari": 1.0, "mahakuta": 0.8, "kudalasangama": 1.0}


def frame(df: pd.DataFrame) -> pd.DataFrame:
    F = pd.DataFrame([features(d) for d in df.date])
    F["site"] = pd.Categorical(df.site.values, categories=SITES)
    return F


def wape(y, p): return float(np.abs(y - p).sum() / y.sum())
def mape(y, p): return float(np.mean(np.abs(y - p) / y))


def fit(X, y, alpha=None):
    params = dict(n_estimators=700, learning_rate=0.03, num_leaves=31, min_child_samples=15, subsample=0.9,
                  subsample_freq=1, colsample_bytree=0.9, verbose=-1)
    if alpha is None:
        m = lgb.LGBMRegressor(objective="regression", **params)
    else:
        m = lgb.LGBMRegressor(objective="quantile", alpha=alpha, **params)
    m.fit(X, np.log1p(y))
    return m


def main():
    df = simulate_daily(end="2026-12-31")
    hist = df[df.date <= TODAY - dt.timedelta(days=1)].copy()          # what would be "known" today
    tr, te = hist[hist.date <= TRAIN_END], hist[(hist.date > TRAIN_END) & (hist.date <= TEST_END)]

    Xtr, Xte = frame(tr), frame(te)
    med = fit(Xtr, tr.visitors.values)
    # Conformalized quantile regression: fit P10/P90 on the first part of training, measure how far
    # reality falls outside the band on the last 6 months, and widen the band by that amount (log space).
    cal_start = TRAIN_END - dt.timedelta(days=183)
    ptr, cal = tr[tr.date < cal_start], tr[tr.date >= cal_start]
    q10, q90 = fit(frame(ptr), ptr.visitors.values, .1), fit(frame(ptr), ptr.visitors.values, .9)
    Xc, yc = frame(cal), np.log1p(cal.visitors.values)
    E = np.maximum(q10.predict(Xc) - yc, yc - q90.predict(Xc))
    n = len(E); qhat = float(np.quantile(E, min(1, 0.8 * (n + 1) / n)))
    p10, p90 = fit(Xtr, tr.visitors.values, 0.1), fit(Xtr, tr.visitors.values, 0.9)
    yhat = np.expm1(med.predict(Xte)); lo = np.expm1(p10.predict(Xte) - qhat); hi = np.expm1(p90.predict(Xte) + qhat)
    y = te.visitors.values

    # Baseline 1: seasonal naive, the same weekday 52 weeks earlier
    lookup = hist.set_index(["site", "date"]).visitors
    naive = np.array([lookup.get((s, d - dt.timedelta(weeks=52)), np.nan) for s, d in zip(te.site, te.date)])
    # Baseline 2: site x month x weekday average from training data (what a spreadsheet would do)
    tr2 = tr.assign(m=[d.month for d in tr.date], w=[d.weekday() for d in tr.date])
    avg = tr2.groupby(["site", "m", "w"]).visitors.mean()
    table = np.array([avg.get((s, d.month, d.weekday()), np.nan) for s, d in zip(te.site, te.date)])

    per_site = {}
    for s in SITES:
        k = (te.site == s).values
        per_site[s] = {"wape_model": round(wape(y[k], yhat[k]), 4), "wape_seasonal_naive": round(wape(y[k], naive[k]), 4),
                       "wape_month_weekday_avg": round(wape(y[k], table[k]), 4), "p10_p90_coverage": round(float(np.mean((y[k] >= lo[k]) & (y[k] <= hi[k]))), 3)}
    fest = np.array([bool(label(d)) for d in te.date])
    metrics = {
        "data": "simulated daily footfall calibrated to ASI annual totals (FY 2024-25 document); non-ASI sites use assumed totals",
        "train": f"2022-01-01..{TRAIN_END}", "test": f"{TRAIN_END + dt.timedelta(days=1)}..{TEST_END}", "n_test_days": int(len(te) / len(SITES)),
        "wape": {"lightgbm": round(wape(y, yhat), 4), "seasonal_naive": round(wape(y, naive), 4), "month_weekday_avg": round(wape(y, table), 4)},
        "mape": {"lightgbm": round(mape(y, yhat), 4), "seasonal_naive": round(mape(y, naive), 4), "month_weekday_avg": round(mape(y, table), 4)},
        "wape_on_festival_days": {"lightgbm": round(wape(y[fest], yhat[fest]), 4), "seasonal_naive": round(wape(y[fest], naive[fest]), 4), "month_weekday_avg": round(wape(y[fest], table[fest]), 4)},
        "p10_p90_interval_coverage": round(float(np.mean((y >= lo) & (y <= hi))), 3),
        "interval_method": "conformalized quantile regression (target 80% coverage)", "conformal_widening_log": round(qhat, 4),
        "per_site": per_site,
        "top_features": sorted(zip(Xtr.columns, med.feature_importances_.tolist()), key=lambda t: -t[1])[:8],
    }
    (OUT / "footfall_metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps({k: metrics[k] for k in ("wape", "mape", "wape_on_festival_days", "p10_p90_interval_coverage")}, indent=2))

    # Plot one site for the report
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    k = (te.site == "badami_caves").values
    fig, ax = plt.subplots(figsize=(12, 4))
    ax.fill_between(te.date[k], lo[k], hi[k], alpha=.25, color="#1f5e57", label="P10–P90")
    ax.plot(te.date[k], y[k], color="#222", lw=1, label="actual (simulated)")
    ax.plot(te.date[k], yhat[k], color="#c0562f", lw=1.4, label="LightGBM forecast")
    ax.set_title("Badami Cave Temples: daily visitors, test period"); ax.legend(); fig.tight_layout()
    fig.savefig(OUT / "footfall_test.png", dpi=120); plt.close(fig)

    # Refit on everything known up to today, forecast forward
    Xall = frame(hist)
    med, p10, p90 = fit(Xall, hist.visitors.values), fit(Xall, hist.visitors.values, .1), fit(Xall, hist.visitors.values, .9)
    fut = pd.DataFrame([{"site": s, "date": d} for s in SITES for d in pd.date_range(TODAY, HORIZON_END).date])
    Xf = frame(fut)
    fut["p50"], fut["p10"], fut["p90"] = np.expm1(med.predict(Xf)), np.expm1(p10.predict(Xf) - qhat), np.expm1(p90.predict(Xf) + qhat)

    out = {"generated_for": str(TODAY), "model": "LightGBM (log target) + quantile P10/P90", "sites": {}}
    for s in SITES:
        rows = []
        for r in fut[fut.site == s].itertuples():
            prof = hourly_profile(s, r.date)
            present = (r.p50 * prof * DWELL_H[s]).round().astype(int)      # people on site each hour
            rows.append({"d": str(r.date), "p50": int(r.p50), "p10": int(r.p10), "p90": int(r.p90), "tag": label(r.date),
                         "hourly": present.tolist()})
        # Recent actuals for context charts (last 60 days)
        recent = hist[(hist.site == s) & (hist.date >= TODAY - dt.timedelta(days=60))]
        out["sites"][s] = {"capacity": CAPACITY[s], "calibrated_to_asi": s in ASI_FY2425,
                           "recent": [{"d": str(d), "v": int(v)} for d, v in zip(recent.date, recent.visitors)], "forecast": rows}
    (OUT / "footfall_forecast.json").write_text(json.dumps(out, separators=(",", ":")))
    print("forecast days:", len(out["sites"]["badami_caves"]["forecast"]))
    df.to_csv(OUT / "footfall_simulated.csv", index=False)


if __name__ == "__main__":
    main()
