"""Regenerate the portrait assets from sourena.png.

    python3 tools/make-portrait.py

Writes to assets/img/:
  portrait-map.png   luminance + alpha map that the particle sampler reads
  sourena-cut.webp   background-removed photo (the "raw artifact" reveal)
  sourena.jpg        web-sized photo with its original backdrop (used for link previews)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img"
CROP = (0, 0, 1855, 2318)  # head and shoulders, 4:5

src = Image.open(ROOT / "sourena.png").convert("RGB")
rgb = np.asarray(src).astype(np.float32)

# The backdrop is a flat blue-teal (B-R ~ 45); skin, hair, shirt and vest all sit at or below 0.
blue = rgb[..., 2] - rgb[..., 0]
subject = blue < 24
subject = ndimage.binary_opening(subject, iterations=2)
labels, n = ndimage.label(subject)
sizes = ndimage.sum(subject, labels, range(1, n + 1))
subject = labels == (np.argmax(sizes) + 1)
subject = ndimage.binary_fill_holes(subject)

# Soft edge: a gentle ramp on the colour key, limited to a band around the hard mask.
ramp = np.clip((28.0 - blue) / 16.0, 0.0, 1.0)
band = ndimage.binary_dilation(subject, iterations=4)
alpha = np.where(subject, 1.0, np.where(band, ramp, 0.0))
alpha = ndimage.grey_erosion(alpha, size=(3, 3))
alpha_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))

# Cut-out photo (RGBA) for the reveal; pull the backdrop's blue cast out of the edge band.
edge = ndimage.binary_dilation(subject, iterations=4) & ~ndimage.binary_erosion(subject, iterations=6)
clean = rgb.copy()
clean[..., 2] = np.where(edge, np.minimum(clean[..., 2], clean[..., 0] + 4), clean[..., 2])
clean[..., 1] = np.where(edge, np.minimum(clean[..., 1], clean[..., 0] + 2), clean[..., 1])
cut = Image.fromarray(clean.astype(np.uint8))
cut.putalpha(alpha_img)
cut = cut.crop(CROP)
cut.resize((880, 1100), Image.LANCZOS).save(OUT / "sourena-cut.webp", quality=86, method=6)

# Plain web photo with the original backdrop.
web = src.resize((960, 1441), Image.LANCZOS)
web.save(OUT / "sourena.jpg", quality=84, optimize=True, progressive=True)

# Particle map: contrast-stretched luminance inside the silhouette.
lum = (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]) / 255.0
inside = lum[subject]
lo, hi = np.percentile(inside, 2), np.percentile(inside, 99.5)
lum = np.clip((lum - lo) / (hi - lo), 0, 1) ** 0.9
lum_img = Image.fromarray((lum * 255).astype(np.uint8)).crop(CROP).resize((240, 300), Image.LANCZOS)
a_img = alpha_img.crop(CROP).resize((240, 300), Image.LANCZOS)
Image.merge("LA", (lum_img, a_img)).save(OUT / "portrait-map.png", optimize=True)

print("subject px:", int(subject.sum()), "of", subject.size)
