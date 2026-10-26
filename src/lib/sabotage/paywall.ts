import type { Sabotage } from './types';

export const FREE_TIER_CHARACTERS = 0;

// On submit: a premium-tier upsell. Every button leads back to where you started.
export const paywall: Sabotage = {
	id: 'paywall',
	reject(wish, { paywall: dialog }) {
		const overBy = [...wish].length - FREE_TIER_CHARACTERS;
		dialog.querySelector('[data-over-by]')!.textContent = String(overBy);
		dialog.querySelector('[data-paywall-step="pitch"]')!.removeAttribute('hidden');
		dialog.querySelector('[data-paywall-step="sold-out"]')!.setAttribute('hidden', '');

		return new Promise((resolve) => {
			const onClick = (event: Event) => {
				const action = (event.target as HTMLElement).closest('[data-paywall-action]')?.getAttribute('data-paywall-action');
				if (action === 'upgrade') {
					dialog.querySelector('[data-paywall-step="pitch"]')!.setAttribute('hidden', '');
					dialog.querySelector('[data-paywall-step="sold-out"]')!.removeAttribute('hidden');
				} else if (action) {
					dialog.close();
				}
			};
			dialog.addEventListener('click', onClick);
			dialog.addEventListener(
				'close',
				() => {
					dialog.removeEventListener('click', onClick);
					resolve('Wish saved to drafts. Drafts are not monitored by the universe.');
				},
				{ once: true },
			);
			dialog.showModal();
		});
	},
};
