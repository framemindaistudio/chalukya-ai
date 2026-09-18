"""
Visitor-footfall and parking simulator.

We do not have daily or hourly ticket-counter data, so we SIMULATE it. The simulation is anchored to the
one real public figure we have: ASI annual footfall (document headed FY 2024-25):
    Badami Cave 444,542 · Group of Temples, Pattadakal 324,615 · Durga temple, Aihole 213,901.
Daily shape (season, weekday, festivals, vacations, heat, rain) comes from the calendar and plain
assumptions documented below. The ML models are trained on this data. When ASI or the district
shares real ticket-counter data, the same pipeline retrains on it unchanged.

Non-ASI sites (Banashankari, Mahakuta, Kudalasangama) have NO public figure; their scale is an
explicit assumption and is labelled "estimated" wherever it is shown.
"""
from __future__ import annotations

import datetime as dt
import math

import numpy as np
import pandas as pd

from calendar_features import features

ASI_FY2425 = {"badami_caves": 444_542, "pattadakal": 324_615, "aihole": 213_901}
ESTIMATED_ANNUAL = {"banashankari": 600_000, "mahakuta": 90_000, "kudalasangama": 350_000}  # assumption, not data
SITES = list(ASI_FY2425) + list(ESTIMATED_ANNUAL)

# Monthly seasonality: winter peak (Nov–Jan), summer heat dip at monuments, monsoon lull
SEASON = {1: 1.35, 2: 1.15, 3: 0.95, 4: 0.85, 5: 0.80, 6: 0.60, 7: 0.55, 8: 0.65, 9: 0.75, 10: 1.10, 11: 1.40, 12: 1.45}
DOW = [0.75, 0.70, 0.72, 0.78, 0.90, 1.55, 1.75]  # Mon..Sun
PILGRIM = {"banashankari", "kudalasangama", "mahakuta"}


def daily_multiplier(site: str, d: dt.date, rng: np.random.Generator) -> float:
    f = features(d)
    m = SEASON[d.month] * DOW[d.weekday()]
    if f["holiday"]: m *= 1.6
    if f["long_weekend"]: m *= 1.35
    if f["school_vacation"]: m *= 1.25 if f["hot_season"] else 1.3
    if f["diwali_window"]: m *= 1.5
    if f["dasara_window"]: m *= 1.45
    if f["heritage_free_entry"] and site in ASI_FY2425: m *= 1.8
    if site == "banashankari":
        if f["jatre_peak"]: m *= 9.0
        elif f["jatre"]: m *= 3.2
        if d.weekday() == 1 or d.weekday() == 4: m *= 1.3      # Tuesdays and Fridays are temple days
    if site == "mahakuta" and f["shivaratri"]: m *= 6.0
    if site == "kudalasangama" and (f["shivaratri"] or (d.month == 1 and d.day in (14, 15))): m *= 4.0
    if site in ("pattadakal", "aihole", "badami_caves") and f["jatre"]: m *= 1.15  # jatre visitors also see monuments
    growth = 1.0 + 0.06 * (d.year - 2024) + 0.06 * (d.month - 6) / 12             # ~6% annual growth
    if d.year == 2022: growth *= 0.82                                            # post-COVID recovery
    rain = 0.85 if (f["monsoon"] and rng.random() < 0.18) else 1.0               # rainy-day dip
    return m * growth * rain * float(rng.lognormal(0, 0.12))


def simulate_daily(start="2022-01-01", end="2026-12-31", seed=7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    days = pd.date_range(start, end, freq="D").date
    rows = []
    for site in SITES:
        raw = np.array([daily_multiplier(site, d, rng) for d in days])
        # Calibrate so the Apr-2024..Mar-2025 total equals the annual figure
        fy = np.array([dt.date(2024, 4, 1) <= d <= dt.date(2025, 3, 31) for d in days])
        target = ASI_FY2425.get(site) or ESTIMATED_ANNUAL[site]
        scale = target / raw[fy].sum()
        for d, v in zip(days, raw * scale):
            rows.append({"site": site, "date": d, "visitors": int(round(v))})
    return pd.DataFrame(rows)


# Share of the day's visitors present in each hour (06:00–18:00 site hours).
def hourly_profile(site: str, d: dt.date) -> np.ndarray:
    hours = np.arange(6, 19)
    f = features(d)
    if f["hot_season"]:
        w = np.exp(-((hours - 9.5) ** 2) / 4) + 0.9 * np.exp(-((hours - 16.8) ** 2) / 3) + 0.15
    else:
        w = np.exp(-((hours - 11) ** 2) / 6) + 0.8 * np.exp(-((hours - 15.5) ** 2) / 5) + 0.1
    if site in PILGRIM:
        w = w + 0.6 * np.exp(-((hours - 7.5) ** 2) / 2)  # morning pooja crowd
    if f["weekend"]: w = w + 0.25 * np.exp(-((hours - 13) ** 2) / 8)
    return w / w.sum()


PARKING_LOTS = [
    # id, site, name, capacity (assumed), lat, lng, share_of_visitors_arriving_by_car_or_van
    ("p_badami_caves", "badami_caves", "Cave Temples parking", 60, 15.91840, 75.68380, 0.40),
    ("p_badami_museum", "badami_caves", "Museum & Bhutanatha parking", 35, 15.92080, 75.68620, 0.16),
    ("p_banashankari", "banashankari", "Banashankari temple parking", 120, 15.88840, 75.70540, 0.36),
    ("p_mahakuta", "mahakuta", "Mahakuta parking", 35, 15.93370, 75.72210, 0.42),
    ("p_pattadakal", "pattadakal", "Pattadakal monument parking", 70, 15.94930, 75.81560, 0.50),
    ("p_aihole", "aihole", "Aihole Durga temple parking", 45, 16.01970, 75.88300, 0.50),
]
# Capacities and car shares are assumptions (no public data); tuned so weekend and festival peaks fill the lots.
PERSONS_PER_VEHICLE, DWELL_MIN = 2.8, {"badami_caves": 95, "banashankari": 60, "mahakuta": 50, "pattadakal": 110, "aihole": 100}


def simulate_parking(daily: pd.DataFrame, start="2025-01-01", end="2026-12-31", step_min=10, seed=11) -> pd.DataFrame:
    """Occupancy of each lot every `step_min` minutes: arrivals from hourly footfall, departures after dwell time."""
    rng = np.random.default_rng(seed)
    daily = daily.set_index(["site", "date"])["visitors"]
    rows = []
    for lot, site, name, cap, *_ , car_share in PARKING_LOTS:
        occ = 0.0
        queue: list[float] = []
        for d in pd.date_range(start, end, freq="D").date:
            v = daily.get((site, d), 0)
            prof = hourly_profile(site, d)
            dwell = DWELL_MIN[site] / step_min
            occ, queue = 0.0, []
            for h_i, h in enumerate(range(6, 19)):
                for m in range(0, 60, step_min):
                    arrivals = rng.poisson(v * prof[h_i] * car_share / PERSONS_PER_VEHICLE * step_min / 60)
                    queue = [t - 1 for t in queue if t - 1 > 0]
                    free = max(0, cap - len(queue))
                    admitted = min(arrivals, free)
                    queue += list(rng.gamma(4, dwell / 4, size=admitted))
                    rows.append({"lot": lot, "site": site, "ts": dt.datetime(d.year, d.month, d.day, h, m),
                                 "occupied": len(queue), "capacity": cap, "turned_away": int(arrivals - admitted)})
    return pd.DataFrame(rows)


if __name__ == "__main__":
    df = simulate_daily()
    fy = df[(df.date >= dt.date(2024, 4, 1)) & (df.date <= dt.date(2025, 3, 31))].groupby("site").visitors.sum()
    print("FY2024-25 totals (should match ASI for the 3 ASI sites):\n", fy)
    print(df.groupby("site").visitors.describe()[["mean", "min", "max"]].round(0))
