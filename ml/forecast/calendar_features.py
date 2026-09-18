"""
Calendar knowledge for Bagalkot tourism: public holidays, festivals, school vacations,
ASI free-entry days and seasons. Shared by the simulator, the models and the API.
Festival dates follow the Hindu lunisolar calendar, so they are listed per year.
"""
from __future__ import annotations

import datetime as dt
import math

D = dt.date

DIWALI = {2022: D(2022, 10, 24), 2023: D(2023, 11, 12), 2024: D(2024, 11, 1), 2025: D(2025, 10, 20), 2026: D(2026, 11, 8), 2027: D(2027, 10, 29)}
DASARA = {2022: D(2022, 10, 5), 2023: D(2023, 10, 24), 2024: D(2024, 10, 12), 2025: D(2025, 10, 2), 2026: D(2026, 10, 20), 2027: D(2027, 10, 9)}
UGADI = {2022: D(2022, 4, 2), 2023: D(2023, 3, 22), 2024: D(2024, 4, 9), 2025: D(2025, 3, 30), 2026: D(2026, 3, 19), 2027: D(2027, 4, 7)}
SHIVARATRI = {2022: D(2022, 3, 1), 2023: D(2023, 2, 18), 2024: D(2024, 3, 8), 2025: D(2025, 2, 26), 2026: D(2026, 2, 15), 2027: D(2027, 3, 6)}
GANESHA = {2022: D(2022, 8, 31), 2023: D(2023, 9, 19), 2024: D(2024, 9, 7), 2025: D(2025, 8, 27), 2026: D(2026, 9, 14), 2027: D(2027, 9, 4)}
# Banada Hunnime (Pushya full moon): start of the Banashankari jatre
BANASHANKARI_JATRE = {2022: D(2022, 1, 17), 2023: D(2023, 1, 6), 2024: D(2024, 1, 25), 2025: D(2025, 1, 13), 2026: D(2026, 1, 3), 2027: D(2027, 1, 22)}

FIXED_HOLIDAYS = [(1, 1), (1, 26), (5, 1), (8, 15), (10, 2), (11, 1), (12, 25), (4, 14)]


def _near(d: dt.date, table: dict, before: int, after: int) -> bool:
    f = table.get(d.year)
    if f is None: return False
    return -before <= (d - f).days <= after


def features(d: dt.date) -> dict:
    """Numeric calendar features for one date (no knowledge of visitor numbers)."""
    doy = d.timetuple().tm_yday
    fixed = (d.month, d.day) in FIXED_HOLIDAYS or d in (DIWALI.get(d.year), DASARA.get(d.year), UGADI.get(d.year), SHIVARATRI.get(d.year), GANESHA.get(d.year))
    sankranti = d.month == 1 and d.day in (14, 15)
    # Long weekend: a holiday on Mon/Fri, or a weekend next to one
    long_weekend = any(
        ((d + dt.timedelta(days=k)).month, (d + dt.timedelta(days=k)).day) in FIXED_HOLIDAYS and (d + dt.timedelta(days=k)).weekday() in (0, 4)
        for k in range(-2, 3)) and d.weekday() >= 4 or (fixed and d.weekday() in (0, 4))
    summer_vac = (d.month == 4 and d.day >= 10) or (d.month == 5 and d.day <= 28)
    dasara_vac = _near(d, DASARA, 12, 4)
    xmas_vac = (d.month == 12 and d.day >= 23) or (d.month == 1 and d.day <= 1)
    heritage_free = (d.month == 4 and d.day == 18) or (d.month == 11 and 19 <= d.day <= 25)  # World Heritage Day / Week
    return {
        "dow": d.weekday(), "month": d.month, "doy_sin": math.sin(2 * math.pi * doy / 365.25), "doy_cos": math.cos(2 * math.pi * doy / 365.25),
        "weekend": int(d.weekday() >= 5), "holiday": int(fixed or sankranti), "long_weekend": int(bool(long_weekend)),
        "diwali_window": int(_near(d, DIWALI, 2, 4)), "dasara_window": int(_near(d, DASARA, 3, 1)),
        "jatre": int(_near(d, BANASHANKARI_JATRE, 1, 14)), "jatre_peak": int(_near(d, BANASHANKARI_JATRE, 0, 2)),
        "shivaratri": int(_near(d, SHIVARATRI, 0, 1)),
        "school_vacation": int(summer_vac or dasara_vac or xmas_vac), "heritage_free_entry": int(heritage_free),
        "monsoon": int(d.month in (6, 7, 8, 9)), "hot_season": int(d.month in (3, 4, 5)),
        "year_idx": d.year - 2022,
    }


def label(d: dt.date) -> str | None:
    """Human-readable reason a date is special (shown in the app next to the forecast)."""
    f = features(d)
    if f["jatre_peak"]: return "Banashankari jatre (peak)"
    if f["jatre"]: return "Banashankari jatre"
    if f["diwali_window"]: return "Deepavali holidays"
    if f["dasara_window"]: return "Dasara"
    if f["heritage_free_entry"]: return "World Heritage Day/Week"
    if f["shivaratri"]: return "Maha Shivaratri"
    if f["holiday"]: return "Public holiday"
    if f["long_weekend"]: return "Long weekend"
    if f["school_vacation"]: return "School vacation"
    return None
