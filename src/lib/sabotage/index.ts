import { correct } from './correct';
import { flee } from './flee';
import { paywall } from './paywall';
import { portal } from './portal';
import type { Sabotage } from './types';

export type { Sabotage, WishElements, Cleanup } from './types';

export const ALL_SABOTAGES: Sabotage[] = [flee, correct, paywall, portal];

/** Fallback when the active sabotages had nothing to say about the submit. */
export const GENERIC_REJECTIONS = [
	'Wish received and forwarded to the universe’s spam folder.',
	'This wish is not aligned with your highest self. Try a more expensive one.',
	'Your wish has been added to the waitlist. You are number 11,111.',
];

/**
 * A random set of 1–2 sabotages, each equally likely. None from the previous round (`previous`) comes
 * back right away, so every retry feels different. Fleeing is skipped for reduced motion.
 */
export function pickSabotages(
	rng: () => number = Math.random,
	{ reducedMotion = false, previous = [] as Sabotage['id'][] } = {},
): Sabotage[] {
	const pool = ALL_SABOTAGES.filter((s) => !previous.includes(s.id) && !(reducedMotion && s.id === 'flee'));
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	const count = 1 + Math.floor(rng() * Math.min(2, pool.length));
	return pool.slice(0, count);
}
