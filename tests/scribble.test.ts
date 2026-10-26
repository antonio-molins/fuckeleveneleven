import { describe, expect, it } from 'vitest';
import { penPoints, SCRIBBLE_HEIGHT, SCRIBBLE_WIDTH, scratchOut } from '../src/lib/scribble';

describe('scratchOut', () => {
	it('is identical on every build', () => {
		expect(scratchOut()).toEqual(scratchOut());
	});

	it('produces a closed ink outline and a pen path', () => {
		const { ink, pen } = scratchOut();
		expect(ink.startsWith('M')).toBe(true);
		expect(ink.endsWith('Z')).toBe(true);
		expect(pen.startsWith('M')).toBe(true);
	});

	it('keeps the pen inside the drawing area', () => {
		for (const [x, y] of penPoints()) {
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThanOrEqual(SCRIBBLE_WIDTH);
			expect(y).toBeGreaterThanOrEqual(0);
			expect(y).toBeLessThanOrEqual(SCRIBBLE_HEIGHT);
		}
	});

	it('moves slowly at the turns and fast mid-pass, so the ink width varies', () => {
		const points = penPoints();
		const gaps = points.slice(1).map(([x, y], i) => Math.hypot(x - points[i][0], y - points[i][1]));
		expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(5);
	});
});
