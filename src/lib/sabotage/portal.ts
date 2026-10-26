import { getOffsets, headlineZone, nearestPortal, prettyZone } from '../elevenEleven';
import type { Sabotage } from './types';

const CLOSE_MS = 60_000;

const LATE_SNARK = [
	(city: string, time: string) => `${city}’s portal shut ${time} ago. It didn’t wait, and neither will the universe.`,
	(city: string, time: string) => `You missed ${city}’s portal by ${time}. Were you manifesting a nap?`,
	(city: string, time: string) => `The portal in ${city} closed ${time} ago. Mercury’s in retrograde and so is your timing.`,
];
const EARLY_SNARK = [
	(city: string, time: string) => `${city}’s portal opens in ${time}. Patience is a manifestation too, babe.`,
	(city: string, time: string) => `Way too early. ${city} opens in ${time}. Go hydrate.`,
	(city: string, time: string) => `${city} isn’t open for another ${time}. The universe keeps office hours.`,
];

/**
 * The rejection for a wish sent `offByMs` from the nearest 11:11:11.111 (positive: after it, in `city`).
 * Close calls get the exact miss, to the millisecond; anything a minute or more out gets snark.
 */
export function portalRejection(offByMs: number, city: string, random: () => number = Math.random): string {
	const seconds = (Math.abs(offByMs) / 1000).toFixed(3);
	if (seconds === '0.000') return `You hit 11:11:11.111 in ${city} to the millisecond. The universe still said no.`;
	if (Math.abs(offByMs) < CLOSE_MS) {
		return offByMs > 0
			? `The portal opens at 11:11:11.111 only. You missed ${city}’s by ${seconds}s, babe.`
			: `The portal opens at 11:11:11.111 only. You were ${seconds}s early for ${city}, babe.`;
	}
	const minutes = Math.round(Math.abs(offByMs) / 60_000);
	const time = minutes === 1 ? '1 minute' : `${minutes} minutes`;
	const lines = offByMs > 0 ? LATE_SNARK : EARLY_SNARK;
	return lines[Math.floor(random() * lines.length)](city, time);
}

// Wishes are only accepted at exactly 11:11:11.111 somewhere. You were never going to make it.
export const portal: Sabotage = {
	id: 'portal',
	async reject() {
		const now = Date.now();
		const nearest = nearestPortal(now, getOffsets(new Date(now)));
		return portalRejection(nearest.offByMs, prettyZone(headlineZone(nearest.groups)));
	},
};
