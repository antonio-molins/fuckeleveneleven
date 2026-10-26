import { describe, expect, it } from 'vitest';
import { SLOP, slopFor } from '../src/lib/sabotage/correct';
import { pickSabotages } from '../src/lib/sabotage';

// Small deterministic PRNG (mulberry32) so failures are reproducible.
function seeded(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

describe('pickSabotages', () => {
	it('always picks 1–3 distinct sabotages', () => {
		for (let seed = 0; seed < 500; seed++) {
			const ids = pickSabotages(seeded(seed)).map((s) => s.id);
			expect(ids.length).toBeGreaterThanOrEqual(1);
			expect(ids.length).toBeLessThanOrEqual(3);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('eventually uses every sabotage', () => {
		const seen = new Set<string>();
		for (let seed = 0; seed < 200; seed++) pickSabotages(seeded(seed)).forEach((s) => seen.add(s.id));
		expect([...seen].sort()).toEqual(['correct', 'flee', 'paywall', 'portal']);
	});

	it('never makes the button run away from people who asked for less motion', () => {
		for (let seed = 0; seed < 200; seed++) {
			expect(pickSabotages(seeded(seed), { reducedMotion: true }).map((s) => s.id)).not.toContain('flee');
		}
	});
});

describe('slopFor', () => {
	it('matches the typed length exactly', () => {
		for (const n of [0, 1, 11, 111]) expect([...slopFor(n)].length).toBe(n);
	});

	it('starts with the chosen slop line', () => {
		expect(slopFor(10, 1)).toBe(SLOP[1].slice(0, 10));
	});

	it('does not split emoji into broken surrogates', () => {
		const text = slopFor(40);
		expect(text).toBe(text.normalize());
		expect(text.includes('�')).toBe(false);
		expect([...text].every((c) => !/^[\uD800-\uDFFF]$/.test(c))).toBe(true);
	});
});
