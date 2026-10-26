# Generates the boho line-art wallpaper used on .story::before in src/styles/global.css.
# Usage: python3 scripts/boho.py [opacity]  -> prints a data URI to paste into the url("...").
# Thin outlines like a manifestation-journal cover: moon phases, crystals, evil eyes, suns,
# constellations, crescents with a star, sparkles. A fixed tile arrangement repeated over the whole
# phone (one 9:16 drawing), with every copy nudged and tilted independently (seeded), so it keeps a
# loose rhythm without the stiff rows a repeating CSS tile would give.
import math, random, sys, urllib.parse

WIDTH, HEIGHT = 450, 800  # the phone's 9:16; the story is 1/0.045 = 22.2em wide
TILE = 450 * 7 / (1 / 0.045)  # a 7em tile, in drawing units
JITTER = 7  # max position nudge, in drawing units
MAX_TILT = 10  # degrees either way
SEED = 1111

# The tile arrangement, in a 120-unit tile: (x, y, motif, size).
LAYOUT = [
    (22, 22, 'crystal', 1), (74, 17, 'eye', 1), (58, 56, 'phases', 1), (103, 50, 'sun', 1),
    (24, 80, 'constellation', 1), (92, 96, 'crescent', 1), (52, 102, 'sparkle', 1),
    (110, 14, 'spark', 1), (8, 50, 'spark', 0.83),
]
MOTIF_SCALE = 1.35 * TILE / 120


def sparkle(r):
    return f"M0 {-r}Q0 0 {r} 0Q0 0 0 {r}Q0 0 {-r} 0Q0 0 0 {-r}Z"


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


MOTIFS = {
    'crystal': "<path d='M0 -10L4.5 -5L4.5 6L0 10L-4.5 6L-4.5 -5Z'/><path d='M-4.5 -5L0 -2L4.5 -5M0 -2L0 10'/>",
    'eye': "<path d='M-10 0Q0 -8 10 0Q0 8 -10 0Z'/><circle r='3.6'/><circle r='1.5'/>",
    'sun': "<circle r='3.8'/>" + ''.join(
        f"<path d='M{5.5 * math.cos(a):.2f} {5.5 * math.sin(a):.2f}L{8.5 * math.cos(a):.2f} {8.5 * math.sin(a):.2f}'/>"
        for a in (i * math.pi / 6 for i in range(12))),
    'phases': moon_phases(),
    'constellation': "<path d='M-11 4L-5 -3L1 -1L6 -7L11 2' stroke-dasharray='1.2 1.6'/>" + ''.join(
        f"<circle cx='{x}' cy='{y}' r='0.9' class='dot'/>" for x, y in [(-11, 4), (-5, -3), (1, -1), (6, -7), (11, 2)]),
    'crescent': f"<path d='M2 -8A8 8 0 1 0 2 8A6.2 6.2 0 1 1 2 -8Z'/><path transform='translate(7 -6)' d='{sparkle(2.6)}'/>",
    'sparkle': f"<path d='{sparkle(4)}'/>",
    'spark': f"<path d='{sparkle(2.4)}'/>",
}
rand = random.Random(SEED)
uses = []
for row in range(math.ceil(HEIGHT / TILE)):
    for col in range(math.ceil(WIDTH / TILE)):
        for x, y, name, size in LAYOUT:
            px = col * TILE + x * TILE / 120 + rand.uniform(-JITTER, JITTER)
            py = row * TILE + y * TILE / 120 + rand.uniform(-JITTER, JITTER)
            angle = rand.uniform(-MAX_TILT, MAX_TILT)
            uses.append(f"<use href='#{name}' transform='translate({px:.0f} {py:.0f}) rotate({angle:.0f}) scale({MOTIF_SCALE * size:.2f})'/>")

defs = ''.join(f"<g id='{name}'>{body}</g>" for name, body in MOTIFS.items())
opacity = sys.argv[1] if len(sys.argv) > 1 else 0.1
svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {WIDTH} {HEIGHT}'>"
       "<style>.dot{fill:#3a2547;stroke:none}</style>"
       f"<defs>{defs}</defs>"
       f"<g fill='none' stroke='#3a2547' stroke-width='0.75' stroke-linecap='round' stroke-linejoin='round' opacity='{opacity}'>"
       f"{''.join(uses)}</g></svg>")
print("data:image/svg+xml," + urllib.parse.quote(svg, safe="/:=' .,-()"))
