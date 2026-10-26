# Generates the boho line-art wallpaper used on .story::before in src/styles/global.css.
# Usage: python3 scripts/boho.py [opacity]  -> prints a data URI to paste into the url("...").
# Thin outlines scattered at loose angles over a large tile, like a manifestation-journal cover:
# moon phases, a crystal, an evil eye, a sun, a constellation, a crescent with a star, sparkles.
import math, sys, urllib.parse

TILE = 120
SCALE = 1.35  # motif size within the tile; with the 7em tile in CSS, larger and closer together


def sparkle(r):
    return f"M0 {-r}Q0 0 {r} 0Q0 0 0 {r}Q0 0 {-r} 0Q0 0 0 {-r}Z"


def place(x, y, angle, body):
    return f"<g transform='translate({x} {y}) rotate({angle}) scale({SCALE})'>{body}</g>"


def moon_phases():
    # New, waxing crescent, half, gibbous, full: circles with the lit part outlined inside.
    parts = []
    for i, lit in enumerate([0, 0.35, 0.5, 0.75, 1]):
        cx = (i - 2) * 7.5
        parts.append(f"<circle cx='{cx}' cy='0' r='2.8'/>")
        if 0 < lit < 1:
            rx = abs(2.8 * (1 - 2 * lit)) or 0.01
            sweep = 1 if lit > 0.5 else 0
            parts.append(f"<path d='M{cx} -2.8A{rx:.2f} 2.8 0 0 {sweep} {cx} 2.8'/>")
        if lit == 1:
            parts.append(f"<circle cx='{cx}' cy='0' r='1.2'/>")
    return ''.join(parts)


def crystal():
    return ("<path d='M0 -10L4.5 -5L4.5 6L0 10L-4.5 6L-4.5 -5Z'/>"
            "<path d='M-4.5 -5L0 -2L4.5 -5M0 -2L0 10'/>")


def evil_eye():
    return ("<path d='M-10 0Q0 -8 10 0Q0 8 -10 0Z'/>"
            "<circle r='3.6'/><circle r='1.5'/>")


def sun():
    rays = ''.join(
        f"<path d='M{5.5 * math.cos(a):.2f} {5.5 * math.sin(a):.2f}L{8.5 * math.cos(a):.2f} {8.5 * math.sin(a):.2f}'/>"
        for a in (i * math.pi / 6 for i in range(12)))
    return f"<circle r='3.8'/>{rays}"


def constellation():
    stars = [(-11, 4), (-5, -3), (1, -1), (6, -7), (11, 2)]
    lines = 'M' + 'L'.join(f"{x} {y}" for x, y in stars)
    dots = ''.join(f"<circle cx='{x}' cy='{y}' r='0.9' class='dot'/>" for x, y in stars)
    return f"<path d='{lines}' stroke-dasharray='1.2 1.6'/>{dots}"


def crescent_and_star():
    return ("<path d='M2 -8A8 8 0 1 0 2 8A6.2 6.2 0 1 1 2 -8Z'/>"
            f"<g transform='translate(7 -6)'><path d='{sparkle(2.6)}'/></g>")


body = ''.join([
    place(22, 22, 14, crystal()),
    place(74, 17, -6, evil_eye()),
    place(58, 56, 0, moon_phases()),
    place(103, 50, 0, sun()),
    place(24, 80, -12, constellation()),
    place(92, 96, 20, crescent_and_star()),
    place(52, 102, 0, f"<path d='{sparkle(4)}'/>"),
    place(110, 14, 0, f"<path d='{sparkle(2.4)}'/>"),
    place(8, 50, 0, f"<path d='{sparkle(2)}'/>"),
])

opacity = sys.argv[1] if len(sys.argv) > 1 else 0.1
svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {TILE} {TILE}'>"
       "<style>.dot{fill:#3a2547;stroke:none}</style>"
       f"<g fill='none' stroke='#3a2547' stroke-width='0.75' stroke-linecap='round' stroke-linejoin='round' opacity='{opacity}'>"
       f"{body}</g></svg>")
print("data:image/svg+xml," + urllib.parse.quote(svg, safe="/:=' .,-()"))
