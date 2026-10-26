import { describe, expect, it } from 'vitest';
import { brushZigzag, penPoints, SCRIBBLE_HEIGHT, SCRIBBLE_WIDTH } from '../src/lib/scribble';

describe('brushZigzag', () => {
	it('is identical on every build', () => {
		expect(brushZigzag()).toEqual(brushZigzag());
	});

	it('produces a core plus bristles, all closed outlines, and a pen path', () => {
		const { ink, pen } = brushZigzag();
		expect(ink.length).toBeGreaterThan(5);
		for (const d of ink) {
			expect(d.startsWith('M')).toBe(true);
			expect(d.endsWith('Z')).toBe(true);
		}
		expect(pen.startsWith('M')).toBe(true);
	});

	it('keeps the brush and its specks inside the drawing area', () => {
		const inside = ([x, y]: number[]) =>
			x >= 0 && x <= SCRIBBLE_WIDTH && y >= 0 && y <= SCRIBBLE_HEIGHT;
		expect(penPoints().every(inside)).toBe(true);
		expect(brushZigzag().specks.every(inside)).toBe(true);
	});

	it('zig-zags: the pen alternates between climbing and falling', () => {
		const points = penPoints();
		let turns = 0;
		for (let i = 2; i < points.length; i++) {
			const before = points[i - 1][1] - points[i - 2][1];
			const after = points[i][1] - points[i - 1][1];
			if (before * after < 0) turns++;
		}
		expect(turns).toBeGreaterThanOrEqual(6);
	});

	it('slows into the corners, so the ink pools there', () => {
		const points = penPoints();
		const gaps = points.slice(1).map(([x, y], i) => Math.hypot(x - points[i][0], y - points[i][1]));
		expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(5);
	});
});
