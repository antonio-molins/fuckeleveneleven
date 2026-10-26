import type { Sabotage } from './types';

// Wishes are only accepted at exactly 11:11:11.111. You were never going to make it.
export const portal: Sabotage = {
	id: 'portal',
	attach({ form }) {
		form.classList.add('is-portal');
		return () => form.classList.remove('is-portal');
	},
	async reject() {
		const missedBy = (Math.random() * 0.9 + 0.01).toFixed(3);
		return `The portal is open at 11:11:11.111 only. You missed it by ${missedBy}s, babe.`;
	},
};
