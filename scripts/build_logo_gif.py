"""Генерує анімований GIF-логотип для KyivFood (темна тема + акцент)."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 64
RADIUS = 14
N_FRAMES = 20
FRAME_MS = 55
# Палітра як у main.css
BG = (27, 32, 40)
ACCENT = (65, 194, 101)
WARM = (255, 179, 71)


def frame(i: int) -> Image.Image:
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=RADIUS, fill=BG)

    t = i / N_FRAMES
    pulse = 0.5 + 0.5 * math.sin(2 * math.pi * t)

    # М’яке світіне навколо центру
    cx, cy = SIZE // 2, SIZE // 2 + 2
    for k in range(5, 0, -1):
        a = int(25 * pulse + 8 * k)
        rr = int(10 + k * 3 + 4 * pulse)
        bbox = [cx - rr, cy - rr, cx + rr, cy + rr]
        draw.ellipse(bbox, outline=(*ACCENT, min(255, a)), width=1)

    # «Миска» — дуга знизу
    draw.arc([10, 24, 54, 58], start=195, end=345, fill=ACCENT, width=3)

    # Три хвилі «пари» з легким рухом
    for w in range(3):
        phase = (i + w * 5) / N_FRAMES
        y_off = int(6 * math.sin(2 * math.pi * phase))
        x0 = 16 + w * 14
        draw.arc(
            [x0, 6 + y_off, x0 + 8, 18 + y_off],
            start=200,
            end=320,
            fill=(*WARM, 200),
            width=2,
        )

    return im


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out = root / "assets" / "img" / "kyivfood-logo.gif"
    out.parent.mkdir(parents=True, exist_ok=True)

    frames_rgb = [frame(i).convert("RGB") for i in range(N_FRAMES)]
    frames_rgb[0].save(
        out,
        save_all=True,
        append_images=frames_rgb[1:],
        duration=FRAME_MS,
        loop=0,
        optimize=True,
    )
    print("Wrote", out, "bytes=", out.stat().st_size)


if __name__ == "__main__":
    main()
