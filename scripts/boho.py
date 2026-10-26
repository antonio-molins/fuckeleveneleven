# Generates the boho line-art wallpaper used on .story::before in src/styles/global.css.
# Usage: python3 scripts/boho.py [opacity]  -> prints a data URI to paste into the url("...").
# Thin outlines scattered over the whole phone (one 9:16 drawing, no repeating tile, so no rows):
# moon phases, crystals, evil eyes, suns, constellations, crescents with a star, sparkles.
# Placement is seeded Poisson-disk sampling, so it's random-looking but evenly spread and stable.
import math, random, sys, urllib.parse

WIDTH, HEIGHT = 450, 800  # the phone's 9:16
MIN_DISTANCE = 46  # between motif centres
SCALE = 1.3
SEED = 1111


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
# How often each motif turns up: the small sparkles fill the gaps.
WEIGHTS = {'crystal': 3, 'eye': 3, 'sun': 3, 'phases': 2, 'constellation': 2, 'crescent': 3, 'sparkle': 3, 'spark': 4}


def poisson_disk(rand, width, height, radius, tries=30):
    """Bridson's algorithm: evenly spread random points, none closer than `radius`."""
    cell = radius / math.sqrt(2)
    cols, rows = int(width / cell) + 1, int(height / cell) + 1
    grid = [[None] * rows for _ in range(cols)]
    first = (rand.uniform(0, width), rand.uniform(0, height))
    points, active = [first], [first]
    grid[int(first[0] / cell)][int(first[1] / cell)] = first
    while active:
        base = rand.choice(active)
        for _ in range(tries):
            angle, dist = rand.uniform(0, 2 * math.pi), rand.uniform(radius, 2 * radius)
            x, y = base[0] + math.cos(angle) * dist, base[1] + math.sin(angle) * dist
            if not (0 <= x < width and 0 <= y < height):
                continue
            gx, gy = int(x / cell), int(y / cell)
            near = (grid[i][j] for i in range(max(gx - 2, 0), min(gx + 3, cols))
                    for j in range(max(gy - 2, 0), min(gy + 3, rows)) if grid[i][j])
            if all(math.dist((x, y), p) >= radius for p in near):
                grid[gx][gy] = (x, y)
                points.append((x, y))
                active.append((x, y))
                break
        else:
            active.remove(base)
    return points


rand = random.Random(SEED)
names, weights = zip(*WEIGHTS.items())
uses = []
for x, y in poisson_disk(rand, WIDTH, HEIGHT, MIN_DISTANCE):
    name = rand.choices(names, weights)[0]
    angle = rand.uniform(-28, 28)
    scale = SCALE * rand.uniform(0.85, 1.15)
    uses.append(f"<use href='#{name}' transform='translate({x:.0f} {y:.0f}) rotate({angle:.0f}) scale({scale:.2f})'/>")

defs = ''.join(f"<g id='{name}'>{body}</g>" for name, body in MOTIFS.items())
opacity = sys.argv[1] if len(sys.argv) > 1 else 0.1
svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {WIDTH} {HEIGHT}'>"
       "<style>.dot{fill:#3a2547;stroke:none}</style>"
       f"<defs>{defs}</defs>"
       f"<g fill='none' stroke='#3a2547' stroke-width='0.8' stroke-linecap='round' stroke-linejoin='round' opacity='{opacity}'>"
       f"{''.join(uses)}</g></svg>")
print("data:image/svg+xml," + urllib.parse.quote(svg, safe="/:=' .,-()"))
