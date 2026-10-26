// A hand-drawn scratch-out, generated at build time.
// The pen path simulates a hand scrubbing back and forth (easing into each turn, looping round it,
// wobbling slightly), then slashing out. perfect-freehand turns it into a variable-width ink outline:
// where the pen is fast the ink thins, where it slows at the turns it pools.
import { getStroke } from 'perfect-freehand';

type Point = [number, number];

export const SCRIBBLE_WIDTH = 320;
export const SCRIBBLE_HEIGHT = 90;

// Each leg: from, to, and how much it bows away from a straight line.
const LEGS: [Point, Point, number][] = [
	[[8, 66], [306, 22], -7],
	[[304, 30], [14, 74], 8],
	[[16, 64], [300, 32], -6],
	[[298, 42], [118, 70], 6],
];
const SLASH_END: Point = [316, 6];
const PEN_SIZE = 8;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
const quad = (a: Point, c: Point, b: Point, t: number): Point => [
	(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0],
	(1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1],
];

// mulberry32: tiny seeded PRNG, so the scribble is identical on every build.
function seeded(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// Smooth 1D value noise in [0, 1], for a hand's slow wobble rather than jitter.
function smoothNoise(rand: () => number, knots: number) {
	const values = Array.from({ length: knots + 1 }, rand);
	return (t: number) => {
		const x = Math.min(t, 1) * knots;
		const i = Math.floor(x);
		const f = easeInOut(x - i);
		return lerp(values[i], values[Math.min(i + 1, knots)], f);
	};
}

/** The centreline of the pen's movement. Point spacing encodes speed: dense is slow, sparse is fast. */
export function penPoints(seed = 1111): Point[] {
	const points: Point[] = [];
	LEGS.forEach(([from, to, bow], i) => {
		const samples = Math.round(Math.abs(to[0] - from[0]) / 7);
		for (let k = 0; k <= samples; k++) {
			const u = easeInOut(k / samples);
			points.push([lerp(from[0], to[0], u), lerp(from[1], to[1], u) + Math.sin(Math.PI * u) * bow]);
		}
		const next = LEGS[i + 1];
		if (next) {
			// Loop round the turn, overshooting outwards, slowly.
			const direction = Math.sign(to[0] - from[0]);
			const control: Point = [to[0] + direction * 14, (to[1] + next[0][1]) / 2];
			for (let k = 1; k < 8; k++) points.push(quad(to, control, next[0], k / 8));
		}
	});

	// The final slash: few, far-apart points, i.e. fast and thin.
	const last = points[points.length - 1];
	for (let k = 1; k <= 8; k++) {
		const t = k / 8;
		points.push([lerp(last[0], SLASH_END[0], t), lerp(last[1], SLASH_END[1], t * t)]);
	}

	const wobble = smoothNoise(seeded(seed), 24);
	return points.map(([x, y], i) => [x, y + (wobble(i / points.length) - 0.5) * 4]);
}

// From the perfect-freehand README: outline points to a smooth closed SVG path.
function svgPathFromStroke(points: number[][]): string {
	if (points.length < 4) return '';
	const avg = (a: number, b: number) => ((a + b) / 2).toFixed(2);
	const [a, b, c] = points;
	let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0])},${avg(b[1], c[1])} T`;
	for (let i = 2; i < points.length - 1; i++) d += `${avg(points[i][0], points[i + 1][0])},${avg(points[i][1], points[i + 1][1])} `;
	return `${d}Z`;
}

export function scratchOut(seed = 1111): { ink: string; pen: string } {
	const points = penPoints(seed);
	const outline = getStroke(points, {
		size: PEN_SIZE,
		thinning: 0.65,
		smoothing: 0.6,
		streamline: 0.45,
		simulatePressure: true,
		start: { taper: 24 },
		end: { taper: 70 },
	});
	return {
		ink: svgPathFromStroke(outline),
		pen: `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`,
	};
}
