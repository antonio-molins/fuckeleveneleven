// A crayon strike-through: one long stroke, right, back left, right again, nearly flat.
// The pen is sampled at even steps in *time*, easing in and out of every pass, so the points bunch up
// at the turns and spread out mid-pass. Revealing them one per time step therefore draws fast through
// the middle and slow into each change of direction, and perfect-freehand (which reads pressure from
// speed) makes the ink thicker exactly where the pen slows down to turn.
import { getStroke } from 'perfect-freehand';

type Point = [number, number];

export const SCRIBBLE_WIDTH = 320;
export const SCRIBBLE_HEIGHT = 90;

// Each pass: from, to, and how much it bows away from a straight line.
const PASSES: [Point, Point, number][] = [
	[[4, 49], [306, 41], -1.5],
	[[300, 46], [22, 51], 1.5],
	[[28, 44], [316, 36], -1],
];
const STEPS_PER_PASS = 40;
const TURN_STEPS = 4;

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

/** The pen's position at even time steps. Spacing encodes speed: tight at the turns, wide mid-pass. */
export function penPoints(seed = 1111): Point[] {
	const points: Point[] = [];
	PASSES.forEach(([from, to, bow], i) => {
		for (let k = i === 0 ? 0 : 1; k <= STEPS_PER_PASS; k++) {
			const u = easeInOut(k / STEPS_PER_PASS);
			points.push([lerp(from[0], to[0], u), lerp(from[1], to[1], u) + Math.sin(Math.PI * u) * bow]);
		}
		const next = PASSES[i + 1];
		if (next) {
			// A short hook round the turn, still slow.
			for (let k = 1; k <= TURN_STEPS; k++) {
				const t = k / (TURN_STEPS + 1);
				points.push([lerp(to[0], next[0][0], t), lerp(to[1], next[0][1], easeInOut(t))]);
			}
		}
	});
	const wobble = smoothNoise(seeded(seed), 18);
	return points.map(([x, y], i) => [x, y + (wobble(i / points.length) - 0.5) * 2.4]);
}

/** The ink outline for the first `count` pen points (all of them when the stroke is finished). */
export function inkPath(points: Point[], count = points.length): string {
	const done = count >= points.length;
	const outline = getStroke(points.slice(0, Math.max(2, count)), {
		size: 5.4,
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
