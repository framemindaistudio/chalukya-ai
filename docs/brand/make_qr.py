"""QR code for the live app, with the Chalukya AI mark in the centre. Writes SVG (print) and PNG.
High error correction (H, 30%) leaves room for the logo tile; the result is decoded to check it scans.
Run: .venv\\Scripts\\python docs\\brand\\make_qr.py
"""
import io, re
from pathlib import Path
import qrcode
from PIL import Image, ImageDraw

URL = "https://chalukya-ai.vercel.app"
DARK, LIGHT = "#1F5E57", "#FFFFFF"
HERE = Path(__file__).parent
OUT = HERE / "qr"; OUT.mkdir(exist_ok=True)

qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, border=4)
qr.add_data(URL); qr.make(fit=True)
m = qr.get_matrix()                      # includes the quiet zone
n = len(m)
tile = round(n * 0.24) | 1               # odd module count, about 24% of the width (6% of the area)
t0 = (n - tile) // 2

# ── SVG: one path for the modules, a white rounded tile, the exact logo paths inside it ──
logo = (HERE / "logo" / "chalukya-ai-logo.svg").read_text(encoding="utf8")
logo = re.sub(r"<metadata>.*?</metadata>", "", logo, flags=re.S)
paths = "".join(p for p in re.findall(r"<path[^>]*/>", logo) if 'fill="none"' not in p)
d = "".join(f"M{x} {y}h1v1h-1z" for y, row in enumerate(m) for x, v in enumerate(row)
            if v and not (t0 - 1 <= x <= t0 + tile and t0 - 1 <= y <= t0 + tile))
pad = tile * 0.16
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges">'
       f'<rect width="{n}" height="{n}" fill="{LIGHT}"/><path fill="{DARK}" d="{d}"/>'
       f'<rect x="{t0 - 0.5}" y="{t0 - 0.5}" width="{tile + 1}" height="{tile + 1}" rx="{tile * 0.26}" fill="{LIGHT}" stroke="{DARK}" stroke-width="0.35"/>'
       f'<svg x="{t0 + pad}" y="{t0 + pad}" width="{tile - 2 * pad}" height="{tile - 2 * pad}" viewBox="455 310 1137 1431" shape-rendering="geometricPrecision">{paths}</svg>'
       f'</svg>')
(OUT / "chalukya-ai-qr.svg").write_text(svg, encoding="utf8")

# ── PNG at print resolution: the same layout drawn with Pillow plus the 4K logo export ──
S = 40                                    # px per module
img = Image.new("RGB", (n * S, n * S), LIGHT); dr = ImageDraw.Draw(img)
for y, row in enumerate(m):
    for x, v in enumerate(row):
        if v and not (t0 - 1 <= x <= t0 + tile and t0 - 1 <= y <= t0 + tile):
            dr.rectangle((x * S, y * S, (x + 1) * S - 1, (y + 1) * S - 1), fill=DARK)
a, b = int((t0 - 0.5) * S), int((t0 + tile + 0.5) * S)
dr.rounded_rectangle((a, a, b, b), radius=int(tile * 0.26 * S), fill=LIGHT, outline=DARK, width=max(2, int(0.35 * S)))
mark = Image.open(HERE / "logo" / "chalukya-ai-logo-3840.png").convert("RGBA").crop((854, 582, 2986, 3264))
h = int((tile - 2 * pad) * S); w = int(h * mark.width / mark.height)
mark = mark.resize((w, h), Image.LANCZOS)
img.paste(mark, ((n * S - w) // 2, (n * S - h) // 2), mark)
img.save(OUT / "chalukya-ai-qr.png")
img.resize((600, 600), Image.LANCZOS).save(OUT / "chalukya-ai-qr-600.png")
print(f"{n}x{n} modules (version {qr.version}), logo tile {tile} modules")
