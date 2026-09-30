"""Reproducibly sample the original procedural lunar sky into a 2:1 panorama.

Source: playable/src/scene.mjs:111-158 and this port's legacy_purple_sky.gdshader.
The bitmap avoids noisy sky-shader artifacts on Intel UHD GL Compatibility.
Run with the Codex bundled Python environment (NumPy + Pillow).
"""

from pathlib import Path

import numpy as np
from PIL import Image


WIDTH = 2048
HEIGHT = 1024
SEED = 20260927
OUT = Path(__file__).with_name("legacy_purple_panorama.png")


def hash3(p):
    phase = p[..., 0] * 127.1 + p[..., 1] * 311.7 + p[..., 2] * 74.7
    value = np.sin(phase) * 43758.5453
    return value - np.floor(value)


def noise3(p):
    cell = np.floor(p)
    f = p - cell
    f = f * f * (3.0 - 2.0 * f)
    x, y, z = f[..., 0], f[..., 1], f[..., 2]

    def corner(dx, dy, dz):
        return hash3(cell + np.array([dx, dy, dz], dtype=np.float64))

    a = corner(0, 0, 0) * (1 - x) + corner(1, 0, 0) * x
    b = corner(0, 1, 0) * (1 - x) + corner(1, 1, 0) * x
    c = corner(0, 0, 1) * (1 - x) + corner(1, 0, 1) * x
    d = corner(0, 1, 1) * (1 - x) + corner(1, 1, 1) * x
    return (a * (1 - y) + b * y) * (1 - z) + (c * (1 - y) + d * y) * z


def fbm(p):
    result = np.zeros(p.shape[:2], dtype=np.float64)
    amplitude = 0.5
    for _ in range(5):
        result += amplitude * noise3(p)
        p = p * 2.07 + np.array([13.2, 4.1, 8.2])
        amplitude *= 0.5
    return result


def smoothstep(edge0, edge1, value):
    t = np.clip((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def render_rows(y0, y1):
    yy, xx = np.mgrid[y0:y1, 0:WIDTH]
    longitude = (xx + 0.5) / WIDTH * (2.0 * np.pi) - np.pi
    latitude = (0.5 - (yy + 0.5) / HEIGHT) * np.pi
    d = np.stack(
        (np.cos(latitude) * np.sin(longitude),
         np.sin(latitude),
         -np.cos(latitude) * np.cos(longitude)),
        axis=-1,
    )
    # Stretch the source's horizon gradient across the equator. A hard h=0
    # clamp becomes a horizontal color seam in Godot's equirectangular sky.
    h = smoothstep(-0.12, 0.35, d[..., 1])
    t = np.power(h, 0.9)[..., None]
    horizon = np.array([0.25, 0.14, 0.20])
    zenith = np.array([0.018, 0.024, 0.069])
    color = horizon * (1.0 - t) + zenith * t
    band = np.maximum(0.0, 1.0 - np.abs(d[..., 1] * 0.85 + d[..., 0] * 0.31 - 0.39) * 2.8) ** 3
    cloud = fbm(d * 7.0)
    detail = fbm(d * 24.0)
    color += (band * cloud**2)[..., None] * np.array([0.42, 0.12, 0.35])
    color += (band * detail**4)[..., None] * np.array([0.32, 0.25, 0.56])

    # Original ringed celestial body, sampled in angular sky coordinates.
    # Godot PanoramaSkyMaterial faces the equirect seam toward camera -Z;
    # rotate the original sky-body bearing by half a turn in bitmap space.
    center = np.array([-0.32, 0.29, 1.0])
    center /= np.linalg.norm(center)
    right = np.cross(np.array([0.0, 1.0, 0.0]), center)
    right /= np.linalg.norm(right)
    up = np.cross(center, right)
    front = d @ center
    disc_x = (d @ right) / np.maximum(front, 0.7)
    disc_y = (d @ up) / np.maximum(front, 0.7)
    distance = np.hypot(disc_x, disc_y)
    tilted_x = disc_x * 0.94 + disc_y * 0.34
    tilted_y = -disc_x * 0.34 + disc_y * 0.94
    ring_radius = np.hypot(tilted_x, tilted_y / 0.42)
    ring = (1.0 - smoothstep(0.145, 0.149, ring_radius)) * smoothstep(0.113, 0.118, ring_radius)
    outer = (1.0 - smoothstep(0.202, 0.207, ring_radius)) * smoothstep(0.153, 0.159, ring_radius)
    ring_mix = np.maximum(ring * 0.48, outer * 0.33) * (front > 0.7)
    color = color * (1.0 - ring_mix[..., None]) + np.array([0.48, 0.32, 0.48]) * ring_mix[..., None]
    body_mix = (1.0 - smoothstep(0.109, 0.114, distance)) * (front > 0.7)
    stripes = 0.5 + 0.5 * np.sin(disc_y * 112.0 + np.sin(disc_x * 30.0) * 1.2)
    body_color = np.array([0.40, 0.31, 0.47]) * (1.0 - stripes[..., None]) + np.array([0.58, 0.49, 0.62]) * stripes[..., None]
    body_color *= np.clip(0.82 + disc_x * -2.8 + disc_y * 3.1, 0.32, 1.0)[..., None]
    color = color * (1.0 - body_mix[..., None]) + body_color * body_mix[..., None]
    # PanoramaSkyMaterial in the target OpenGL Compatibility renderer displays
    # these channels like the source shader's direct COLOR output. Writing an
    # extra sRGB encoding made the sky washed out and stars oversized.
    return (np.clip(color, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8)


def add_original_star_points(image):
    rng = np.random.default_rng(SEED)
    # Sparse pinpoints survive Godot's panorama filtering better than a field
    # of soft five-pixel discs. The browser used 1,600 3D points on a full dome.
    for _ in range(700):
        longitude = rng.uniform(-np.pi, np.pi)
        elevation = rng.uniform(0.04, 0.98)
        latitude = np.arcsin(elevation)
        x = int((longitude + np.pi) / (2.0 * np.pi) * WIDTH)
        y = int((0.5 - latitude / np.pi) * HEIGHT)
        intensity = rng.uniform(0.18, 0.48)
        for dy in range(-1, 2):
            py = y + dy
            if py < 0 or py >= HEIGHT:
                continue
            for dx in range(-1, 2):
                px = (x + dx) % WIDTH
                weight = intensity * np.exp(-(dx * dx + dy * dy) / 0.75)
                image[py, px] = np.clip(image[py, px].astype(np.float64) + np.array([170, 186, 225]) * weight, 0, 255)


def main():
    pixels = np.empty((HEIGHT, WIDTH, 3), dtype=np.uint8)
    for start in range(0, HEIGHT, 64):
        stop = min(start + 64, HEIGHT)
        pixels[start:stop] = render_rows(start, stop)
        print(f"sky rows {stop}/{HEIGHT}", flush=True)
    add_original_star_points(pixels)
    Image.fromarray(pixels, "RGB").save(OUT, optimize=True)
    print(OUT)


if __name__ == "__main__":
    main()
