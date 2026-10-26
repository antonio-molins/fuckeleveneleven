// A crayon strike-through: one long stroke scrubbing right and left across the words, nearly flat.
// The pen is sampled at even steps in *time*, easing in and out of every pass, so the points bunch up
// at the turns and spread out mid-pass. Revealing them one per time step therefore draws fast through
// the middle and slow into each change of direction, and perfect-freehand (which reads pressure from
// speed) makes the ink thicker exactly where the pen slows down to turn.
import { getStroke } from 'perfect-freehand';

type Point = [number, number];

export const SCRIBBLE_WIDTH = 320;
export const SCRIBBLE_HEIGHT = 90;

const PASSES = 5; // right, left, right, left, right
const STEPS_PER_PASS = 34;
const TURN_STEPS = 10;
const CENTRE_X = 160;
const HALF_SPAN = 146;
// Height where the stroke starts, then where each pass ends. Rightward passes climb steeply and leftward
// ones come back nearly flat, and every turn drops just below the pass it ends, so each pass crosses the
// one before it (a zig-zag scratch-out, not an oval). Centred on the body of the lowercase letters.
const HEIGHTS = [60, 42, 50, 44, 47, 38];
const TURN_RADIUS = 2.5;
const EASE_FLOOR = 0.15; // keeps a little speed at the end of a pass, so it flows into the turn

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

// mulberry32: tiny seeded PRNG, so the stroke is identical on every build.
function seeded(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// Smooth 1D value noise in [0, 1]: a hand's slow wobble, not jitter.
function smoothNoise(rand: () => number, knots: number) {
	const values = Array.from({ length: knots + 1 }, rand);
	return (t: number) => {
		const x = Math.min(Math.max(t, 0), 1) * knots;
		const i = Math.min(Math.floor(x), knots - 1);
		return lerp(values[i], values[i + 1], easeInOut(x - i));
	};
}

/**
 * The pen's position at even time steps, as one continuous zig-zag. Each pass eases out of one turn and
 * into the next (fast in the middle, slow at the ends, slightly curved); each turn is a single small
 * semicircle, taken slowly, so it reads as a tight rounded hairpin and the ink pools there.
 * Random reach at each end, a slow drift and a slight wobble keep it from looking mechanical.
 */
export function penPoints(seed = 1111): Point[] {
	const rand = seeded(seed);
	const ends = Array.from({ length: PASSES + 1 }, (_, i) => CENTRE_X + (i % 2 ? 1 : -1) * (HALF_SPAN + (rand() - 0.5) * 16));
	const bows = Array.from({ length: PASSES }, () => (rand() - 0.5) * 3);
	const drift = smoothNoise(rand, 6);
	const wobble = smoothNoise(rand, 30);
	const raw: Point[] = [];

	for (let pass = 0; pass < PASSES; pass++) {
		const rightward = pass % 2 === 0;
		const from = pass === 0 ? HEIGHTS[0] : HEIGHTS[pass] + 2 * TURN_RADIUS;
		const to = HEIGHTS[pass + 1];
		for (let k = pass === 0 ? 0 : 1; k <= STEPS_PER_PASS; k++) {
			const linear = k / STEPS_PER_PASS;
			const u = (1 - EASE_FLOOR) * easeInOut(linear) + EASE_FLOOR * linear;
			raw.push([lerp(ends[pass], ends[pass + 1], u), lerp(from, to, u) + bows[pass] * Math.sin(Math.PI * u) ** 2]);
		}
		if (pass < PASSES - 1) {
			// Round the end and drop below: clockwise on the right, anticlockwise on the left.
			const direction = rightward ? 1 : -1;
			for (let j = 1; j < TURN_STEPS; j++) {
				const angle = -Math.PI / 2 + (direction * Math.PI * j) / TURN_STEPS;
				raw.push([ends[pass + 1] + TURN_RADIUS * Math.cos(angle), to + TURN_RADIUS + TURN_RADIUS * Math.sin(angle)]);
			}
		}
	}

	return raw.map(([x, y], i) => {
		const t = i / (raw.length - 1);
		return [x, y + (drift(t) - 0.5) * 3 + (wobble(t) - 0.5) * 1.2];
	});
}

/** The ink outline for the first `count` pen points (all of them when the stroke is finished). */
export function inkPath(points: Point[], count = points.length): string {
	const done = count >= points.length;
	const outline = getStroke(points.slice(0, Math.max(2, count)), {
		size: 6.2,
		thinning: 0.7,
		smoothing: 0.6,
		streamline: 0.35,
		simulatePressure: true,
		start: { taper: 50 },
		end: { taper: done ? 70 : 0 },
		last: done,
	});
	if (outline.length < 4) return '';
	// From the perfect-freehand README: outline points to a smooth closed SVG path.
	const avg = (a: number, b: number) => ((a + b) / 2).toFixed(2);
	const [a, b, c] = outline;
	let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0])},${avg(b[1], c[1])} T`;
	for (let i = 2; i < outline.length - 1; i++) d += `${avg(outline[i][0], outline[i + 1][0])},${avg(outline[i][1], outline[i + 1][1])} `;
	return `${d}Z`;
}
