# Generates the 180x180 apple-touch-icon (app icon for Add to Home Screen).
import math
from PIL import Image, ImageDraw
S = 180; K = 4; W = S * K
img = Image.new('RGB', (W, W))
d = ImageDraw.Draw(img)
for y in range(W):  # dusk gradient
    t = y / W
    d.line([(0, y), (W, y)], fill=(int(18 + 40 * t), int(14 + 20 * t), int(48 + 30 * t)))
# swelling ground: layered low-poly hills
layers = [((70, 200, 120), 0.62, 0.10), ((52, 160, 98), 0.70, 0.13), ((38, 120, 80), 0.80, 0.08)]
for col, base, amp in layers:
    pts = [(0, W)]
    for i in range(9):
        x = i / 8 * W
        bump = math.exp(-((i / 8 - 0.5) ** 2) / 0.05)
        y = W * (base - amp * bump - 0.02 * ((i * 37) % 3))
        pts.append((x, y))
    pts.append((W, W)); d.polygon(pts, fill=col)
# crystal rising from the swell
cx, top = W * 0.5, W * 0.16
crystal = [(cx, top), (cx + W * 0.13, W * 0.42), (cx, W * 0.62), (cx - W * 0.13, W * 0.42)]
d.polygon(crystal, fill=(90, 170, 255))
d.polygon([(cx, top), (cx + W * 0.13, W * 0.42), (cx, W * 0.62)], fill=(150, 210, 255))
d.polygon([(cx, top), (cx - W * 0.05, W * 0.40), (cx, W * 0.62)], fill=(200, 235, 255))
img.resize((S, S), Image.LANCZOS).save('/home/claude/moba/tools/assets/icon-180.png', optimize=True)
