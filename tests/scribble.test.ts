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

	it('is one stroke that scrubs back and forth five times', () => {
		const points = penPoints();
		let reversals = 0;
		for (let i = 2; i < points.length; i++) {
			const before = points[i - 1][0] - points[i - 2][0];
			const after = points[i][0] - points[i - 1][0];
			if (before * after < 0) reversals++;
		}
		expect(reversals).toBe(4);
	});

	it('moves fast mid-pass and slow at the turns', () => {
		const points = penPoints();
		const gaps = points.slice(1).map(([x, y], i) => Math.hypot(x - points[i][0], y - points[i][1]));
		expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(8);
	});
});

describe('turns', () => {
	it('are smooth: the direction never snaps by more than a few degrees between steps', () => {
		const points = penPoints();
		const heading = (i: number) => Math.atan2(points[i + 1][1] - points[i][1], points[i + 1][0] - points[i][0]);
		let sharpest = 0;
		for (let i = 0; i < points.length - 2; i++) {
			let turn = Math.abs(heading(i + 1) - heading(i));
			if (turn > Math.PI) turn = 2 * Math.PI - turn;
			sharpest = Math.max(sharpest, turn);
		}
		// A U-turn sampled over a few steps; two sharp corners in a row would show up as a near-180° snap.
		expect(sharpest).toBeLessThan(Math.PI / 4);
	});
});

describe('zig-zag, not an oval', () => {
	it('each pass crosses the one before it', () => {
		const points = penPoints();
		// Split into passes at the x reversals.
		const passes: [number, number][][] = [[]];
		for (let i = 0; i < points.length; i++) {
			if (i >= 2 && (points[i - 1][0] - points[i - 2][0]) * (points[i][0] - points[i - 1][0]) < 0) passes.push([]);
			passes[passes.length - 1].push(points[i]);
		}
		const heightAt = (pass: [number, number][], x: number) =>
			pass.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best))[1];
		for (let i = 1; i < passes.length; i++) {
			const [a, b] = [passes[i - 1], passes[i]];
			const left = Math.max(Math.min(...a.map((p) => p[0])), Math.min(...b.map((p) => p[0]))) + 20;
			const right = Math.min(Math.max(...a.map((p) => p[0])), Math.max(...b.map((p) => p[0]))) - 20;
			const orderLeft = Math.sign(heightAt(b, left) - heightAt(a, left));
			const orderRight = Math.sign(heightAt(b, right) - heightAt(a, right));
			expect(orderLeft).not.toBe(orderRight);
		}
	});
});
