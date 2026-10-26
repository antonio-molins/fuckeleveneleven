import { describe, expect, it } from 'vitest';
import { inkPath, penPoints, SCRIBBLE_HEIGHT, SCRIBBLE_WIDTH } from '../src/lib/scribble';

describe('crayon strike-through', () => {
	it('is identical on every build', () => {
		expect(penPoints()).toEqual(penPoints());
		expect(inkPath(penPoints())).toEqual(inkPath(penPoints()));
	});

	it('draws a closed ink outline, partial or complete', () => {
		const points = penPoints();
		for (const d of [inkPath(points, 10), inkPath(points)]) {
			expect(d.startsWith('M')).toBe(true);
			expect(d.endsWith('Z')).toBe(true);
		}
	});

	it('keeps the pen inside the drawing area', () => {
		for (const [x, y] of penPoints()) {
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThanOrEqual(SCRIBBLE_WIDTH);
			expect(y).toBeGreaterThanOrEqual(0);
			expect(y).toBeLessThanOrEqual(SCRIBBLE_HEIGHT);
		}
	});

	it('is one stroke that goes right, back left, then right again', () => {
		const points = penPoints();
		let reversals = 0;
		for (let i = 2; i < points.length; i++) {
			const before = points[i - 1][0] - points[i - 2][0];
			const after = points[i][0] - points[i - 1][0];
			if (before * after < 0) reversals++;
		}
		expect(reversals).toBe(2);
	});

	it('moves fast mid-pass and slow at the turns', () => {
		const points = penPoints();
		const gaps = points.slice(1).map(([x, y], i) => Math.hypot(x - points[i][0], y - points[i][1]));
		expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(8);
	});
});
