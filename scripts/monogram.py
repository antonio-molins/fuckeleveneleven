# Generates the luxury-monogram wallpaper used on .story::before in src/styles/global.css.
# Usage: python3 scripts/monogram.py [opacity]  -> prints a data URI to paste into the url("...").

import math, re, sys, urllib.parse

def sparkle(cx, cy, r):
    return f"M{cx} {cy-r}Q{cx} {cy} {cx+r} {cy}Q{cx} {cy} {cx} {cy+r}Q{cx} {cy} {cx-r} {cy}Q{cx} {cy} {cx} {cy-r}Z"

def eleven(cx, cy):
    # Four slanted strokes and a slanted colon: a compact 11:11 monogram.
    strokes = ''.join(f"M{cx+x-0.9:.1f} {cy+5}L{cx+x+0.9:.1f} {cy-5}" for x in (-5.4, -2.9, 2.9, 5.4))
    return (f"<path fill='none' stroke-width='1.7' stroke-linecap='round' d='{strokes}'/>"
            f"<circle cx='{cx+0.35}' cy='{cy-1.9}' r='0.95'/><circle cx='{cx-0.35}' cy='{cy+1.9}' r='0.95'/>")

def flower(cx, cy):
    # Four petals around an open centre.
    petals = ''.join(f"<ellipse cx='{cx+3.6*math.cos(a):.2f}' cy='{cy+3.6*math.sin(a):.2f}' rx='2.3' ry='3.3' transform='rotate({math.degrees(a)+90:.0f} {cx+3.6*math.cos(a):.2f} {cy+3.6*math.sin(a):.2f})'/>"
                     for a in (0, math.pi/2, math.pi, 3*math.pi/2))
    return petals

def diamond(cx, cy):
    return (f"<path fill='none' stroke-width='1.2' stroke-linejoin='round' d='M{cx} {cy-7}L{cx+7} {cy}L{cx} {cy+7}L{cx-7} {cy}Z'/>"
            f"<path d='{sparkle(cx, cy, 4.6)}'/>")

def moon(cx, cy):
    # A solid disc with a crescent moon cut out of it.
    r = 6.4
    disc = f"M{cx-r} {cy}a{r} {r} 0 1 0 {2*r} 0a{r} {r} 0 1 0 {-2*r} 0Z"
    crescent = f"M{cx+1} {cy-4.2}a4.2 4.2 0 1 0 0 8.4a5.5 5.5 0 0 1 0-8.4Z"
    return f"<path fill-rule='evenodd' d='{disc}{crescent}'/>"

# 40x40 tile, half-drop: row one 11:11 and flower; row two (shifted half a step) diamond and moon,
# with the diamond drawn on both edges so it tiles seamlessly.
body = eleven(10, 10) + flower(30, 10) + diamond(0, 30) + diamond(40, 30) + moon(20, 30)
svg = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>"
       f"<g fill='#3a2547' stroke='#3a2547' opacity='{sys.argv[1] if len(sys.argv) > 1 else 0.06}'>{body}</g></svg>")
print("data:image/svg+xml," + urllib.parse.quote(svg, safe="/:=' .,-()"))
