import { describe, expect, it } from 'vitest';
import { SLOP, slopFor } from '../src/lib/sabotage/correct';
import { pickSabotages } from '../src/lib/sabotage';
import { portalRejection } from '../src/lib/sabotage/portal';

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
	it('always picks 1–2 distinct sabotages', () => {
		for (let seed = 0; seed < 500; seed++) {
			const ids = pickSabotages(seeded(seed)).map((s) => s.id);
			expect(ids.length).toBeGreaterThanOrEqual(1);
			expect(ids.length).toBeLessThanOrEqual(2);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('picks every sabotage about equally often', () => {
		const counts: Record<string, number> = {};
		const rng = seeded(42);
		const rounds = 20_000;
		for (let i = 0; i < rounds; i++) for (const s of pickSabotages(rng)) counts[s.id] = (counts[s.id] ?? 0) + 1;
		const shares = Object.values(counts).map((n) => n / rounds);
		expect(Object.keys(counts)).toHaveLength(4);
		for (const share of shares) expect(share).toBeCloseTo(0.375, 1); // 1.5 picks per round over 4 sabotages
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

describe('pickSabotages after a chase', () => {
	it('never rolls fleeing twice in a row', () => {
		for (let seed = 0; seed < 500; seed++) {
			expect(pickSabotages(seeded(seed), { justFled: true }).map((s) => s.id)).not.toContain('flee');
		}
	});
});

describe('portalRejection', () => {
	it('gives the exact miss when it was close', () => {
		expect(portalRejection(2345, 'London')).toBe('The portal opens at 11:11:11.111 only. You missed London’s by 2.345s, babe.');
		expect(portalRejection(-87, 'Kathmandu')).toBe('The portal opens at 11:11:11.111 only. You were 0.087s early for Kathmandu, babe.');
		expect(portalRejection(59_999, 'London')).toContain('59.999s');
	});

	it('has a line for hitting it exactly', () => {
		expect(portalRejection(0, 'Tokyo')).toBe('You hit 11:11:11.111 in Tokyo to the millisecond. The universe still said no.');
	});

	it('gets snarky, in minutes, when it was far', () => {
		for (let seed = 0; seed < 20; seed++) {
			const late = portalRejection(7 * 60_000 + 20_000, 'London', seeded(seed));
			expect(late).toContain('7 minutes');
			expect(late).not.toMatch(/\d\.\d{3}s/);
			expect(portalRejection(-61_000, 'Kathmandu', seeded(seed))).toContain('1 minute');
			expect(portalRejection(-61_000, 'Kathmandu', seeded(seed))).not.toContain('minutes');
		}
	});
});
