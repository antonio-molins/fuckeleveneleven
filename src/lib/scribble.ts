// A dry-brush zig-zag strike-through, generated at build time.
// The pen path is a progressive zig-zag across the words: the brush eases into every corner (so ink
// pools there) and rushes through the middle of each stroke. The ink is a solid core plus several thin
// "bristles" offset alongside it; some run dry early or skip, leaving streaks along the stroke.
// perfect-freehand turns every one of those lines into a variable-width outline.
import { getStroke } from 'perfect-freehand';

type Point = [number, number];

export const SCRIBBLE_WIDTH = 320;
export const SCRIBBLE_HEIGHT = 90;

const CORNERS = 8; // number of zig-zag strokes
const TOP = 26;
const BOTTOM = 64;
const SAMPLES_PER_STROKE = 14;
const BRISTLES = 7;
const BRUSH_WIDTH = 9; // total spread of the bristles, in viewBox units

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

/** The centreline of the brush. Point spacing encodes speed: dense at the corners, sparse mid-stroke. */
export function penPoints(seed = 1111): Point[] {
	const rand = seeded(seed);
	const corners: Point[] = Array.from({ length: CORNERS + 1 }, (_, i) => [
		lerp(8, 300, i / CORNERS) + (rand() - 0.5) * 18,
		(i % 2 ? TOP : BOTTOM) + (rand() - 0.5) * 12,
	]);

	const points: Point[] = [corners[0]];
	for (let c = 1; c < corners.length; c++) {
		const [from, to] = [corners[c - 1], corners[c]];
		for (let k = 1; k <= SAMPLES_PER_STROKE; k++) {
			const u = easeInOut(k / SAMPLES_PER_STROKE);
			points.push([lerp(from[0], to[0], u), lerp(from[1], to[1], u)]);
		}
	}
	// A quick flick off the last corner, out past the words.
	const last = points[points.length - 1];
	for (let k = 1; k <= 4; k++) points.push([last[0] + k * 4.5, last[1] - k * 4]);
	return points;
}

function normals(points: Point[]): Point[] {
	return points.map((_, i) => {
		const [a, b] = [points[Math.max(0, i - 1)], points[Math.min(points.length - 1, i + 1)]];
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
		return [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
	});
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

export interface Brushstroke {
	/** Filled outlines: the core and every bristle. */
	ink: string[];
	/** Small ink specks thrown off at the corners: [x, y, r]. */
	specks: [number, number, number][];
	/** The centreline, for the mask that draws the stroke on. */
	pen: string;
}

export function brushZigzag(seed = 1111): Brushstroke {
	const rand = seeded(seed * 7 + 3);
	const points = penPoints(seed);
	const normal = normals(points);
	const ink: string[] = [];

	ink.push(
		svgPathFromStroke(
			getStroke(points, { size: 7, thinning: 0.55, smoothing: 0.5, streamline: 0.3, start: { taper: 10 }, end: { taper: 40 } }),
		),
	);

	for (let b = 0; b < BRISTLES; b++) {
		const offset = lerp(-BRUSH_WIDTH / 2, BRUSH_WIDTH / 2, b / (BRISTLES - 1)) + (rand() - 0.5);
		const edge = Math.abs(offset) / (BRUSH_WIDTH / 2); // 0 in the middle, 1 at the edges
		const shifted = points.map(([x, y], i): Point => [x + normal[i][0] * offset, y + normal[i][1] * offset]);
		// Outer bristles start late and run dry sooner; some skip for a stretch.
		const start = Math.floor(rand() * 6 * edge);
		const end = shifted.length - Math.floor(rand() * shifted.length * 0.3 * edge);
		const skipAt = rand() < edge * 0.8 ? Math.floor(lerp(start, end, 0.2 + rand() * 0.6)) : -1;
		const segments = skipAt > 0 ? [shifted.slice(start, skipAt), shifted.slice(skipAt + 6, end)] : [shifted.slice(start, end)];
		for (const segment of segments) {
			if (segment.length < 4) continue;
			const outline = getStroke(segment, {
				size: lerp(2.8, 1.4, edge),
				thinning: 0.5,
				smoothing: 0.5,
				streamline: 0.3,
				start: { taper: 6 },
				end: { taper: 24 },
			});
			ink.push(svgPathFromStroke(outline));
		}
	}

	const specks: [number, number, number][] = [];
	for (let c = SAMPLES_PER_STROKE; c < points.length; c += SAMPLES_PER_STROKE) {
		if (rand() < 0.5) continue;
		const [x, y] = points[c];
		specks.push([x + (rand() - 0.5) * 14, y + (rand() - 0.5) * 12, 0.6 + rand() * 1.1]);
	}

	return { ink, specks, pen: `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}` };
}
