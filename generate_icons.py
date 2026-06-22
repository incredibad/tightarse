#!/usr/bin/env python3
"""Generate PWA icons as PNGs using only stdlib."""
import struct
import zlib
import math

def write_png(filename, pixels, size):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(c[4:]) & 0xFFFFFFFF)

    raw = b""
    for row in pixels:
        flat = []
        for px in row:
            flat.extend(px)
        raw += b"\x00" + bytes(flat)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")

    with open(filename, "wb") as f:
        f.write(png)

def make_icon(size):
    pixels = [[[0, 0, 0] for _ in range(size)] for _ in range(size)]

    bg = (22, 163, 74)    # #16a34a
    fg = (255, 255, 255)  # white

    r_outer = size / 2
    corner_r = size * 0.22  # rounded corner radius

    def in_rounded_rect(x, y):
        cx, cy = size / 2, size / 2
        dx = abs(x - cx) - (r_outer - corner_r)
        dy = abs(y - cy) - (r_outer - corner_r)
        if dx <= 0 and dy <= 0:
            return True
        if dx > 0 and dy > 0:
            return math.sqrt(dx*dx + dy*dy) <= corner_r
        return (dx <= 0 or dy <= 0) and (dx <= corner_r and dy <= corner_r)

    # Dollar sign parameters
    pad = size * 0.16
    bar_w = size * 0.07
    cx = size / 2

    # Vertical bar
    bar_x1 = cx - bar_w / 2
    bar_x2 = cx + bar_w / 2
    bar_y1 = pad * 0.7
    bar_y2 = size - pad * 0.7

    # S-curve: two arcs
    # Top arc: center at (cx, pad*1.45), outer radius r_arc, inner r_arc - stroke_w
    # Bottom arc: center at (cx, size - pad*1.45)
    arc_r = (size - pad * 2.9) * 0.28
    stroke_w = size * 0.065
    arc_r_inner = arc_r - stroke_w

    top_cy = pad * 1.6
    bot_cy = size - pad * 1.6

    def in_top_arc(x, y):
        # Right half of top arc (clockwise from 0 to pi)
        dx, dy = x - cx, y - top_cy
        dist = math.sqrt(dx*dx + dy*dy)
        if not (arc_r_inner <= dist <= arc_r):
            return False
        # Only the left half (angle 90..270)
        return dx <= 0 or (dy < 0)

    def in_bottom_arc(x, y):
        dx, dy = x - cx, y - bot_cy
        dist = math.sqrt(dx*dx + dy*dy)
        if not (arc_r_inner <= dist <= arc_r):
            return False
        return dx >= 0 or (dy > 0)

    for row in range(size):
        for col in range(size):
            x, y = col + 0.5, row + 0.5
            if not in_rounded_rect(x, y):
                continue
            pixels[row][col] = list(bg)

            # Draw dollar sign in white
            in_bar = bar_x1 <= x <= bar_x2 and bar_y1 <= y <= bar_y2

            # Super-sample arcs for smoother edges
            samples = 3
            arc_hits = 0
            for si in range(samples):
                for sj in range(samples):
                    sx = col + (si + 0.5) / samples
                    sy = row + (sj + 0.5) / samples
                    if in_top_arc(sx, sy) or in_bottom_arc(sx, sy):
                        arc_hits += 1
            arc_alpha = arc_hits / (samples * samples)

            if in_bar or arc_alpha > 0:
                if in_bar and arc_alpha > 0:
                    pixels[row][col] = list(fg)
                elif in_bar:
                    pixels[row][col] = list(fg)
                else:
                    # Blend arc with background
                    a = arc_alpha
                    pixels[row][col] = [
                        int(fg[i] * a + bg[i] * (1 - a)) for i in range(3)
                    ]

    return pixels

for size, name in [(192, "frontend/public/icons/icon-192.png"), (512, "frontend/public/icons/icon-512.png")]:
    print(f"Generating {name} ({size}x{size})...")
    pixels = make_icon(size)
    write_png(name, pixels, size)
    print(f"  Done.")

print("Icons generated.")
