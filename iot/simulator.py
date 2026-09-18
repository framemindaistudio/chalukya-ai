"""
IoT simulator: behaves like the ESP32 nodes when no hardware is connected.
Streams parking occupancy (from the same queue simulation the ML was trained on) and safety-node
temperature/motion to the server every few seconds. Press Ctrl+C to stop.

    python iot/simulator.py                 # normal day
    python iot/simulator.py --fault         # one parking sensor gets stuck at 0 after a minute
    python iot/simulator.py --heat          # safety node reports 41 °C (heat alert)
"""
import argparse
import json
import math
import random
import time
from datetime import datetime
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DAYS = json.loads((ROOT / "ml" / "forecast" / "out" / "parking_days.json").read_text())

ap = argparse.ArgumentParser()
ap.add_argument("--server", default="http://127.0.0.1:8300")
ap.add_argument("--every", type=float, default=5, help="seconds between reports")
ap.add_argument("--fault", action="store_true"); ap.add_argument("--heat", action="store_true")
a = ap.parse_args()

t0 = time.time()
print(f"Streaming to {a.server}/api/iot every {a.every}s (Ctrl+C to stop)")
while True:
    now = datetime.now()
    step = max(0, ((now.hour - DAYS["start_hour"]) * 60 + now.minute) // DAYS["step_min"])
    for lot, info in DAYS["lots"].items():
        series = next(iter(info["days"].values()))
        base = series[min(step, len(series) - 1)] if 6 <= now.hour < 19 else 1
        occ = max(0, min(info["capacity"], base + random.randint(-1, 1)))
        if a.fault and lot == "p_badami_caves" and time.time() - t0 > 60: occ = 0
        requests.post(f"{a.server}/api/iot", json={"node": lot, "occupied": occ, "capacity": info["capacity"], "battery": 3.9}, timeout=5)
    temp = 41.0 if a.heat else 29 + 6 * math.sin((now.hour - 9) / 24 * 2 * math.pi) + random.uniform(-0.5, 0.5)
    for node in ("safety_caves", "safety_lake"):
        requests.post(f"{a.server}/api/iot", json={"node": node, "temp_c": round(temp, 1), "humidity": 35, "motion": random.randint(0, 12)}, timeout=5)
    print(now.strftime("%H:%M:%S"), "sent", len(DAYS["lots"]) + 2, "readings", flush=True)
    time.sleep(a.every)
