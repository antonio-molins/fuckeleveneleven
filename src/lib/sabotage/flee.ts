import type { Sabotage } from './types';

const PANIC_RADIUS_PX = 90;
/** How many times it gets away before it lets you catch it. */
export const DODGES = 2;

export const CAUGHT_MESSAGES = [
	'Caught it! Two laps around the story and the universe still says no. Great cardio, though.',
	'You cornered the button. Shame the wish was never in the button.',
	'Third time’s the charm? Not for wishes. Nice sprint, though.',
];
export const SKIPPED_CHASE_MESSAGE = 'Skipping the chase? The universe only rewards hustle. Denied.';

// The submit button refuses to be pressed: it runs from the cursor, a tap or keyboard focus, twice,
// then gives up and lets you press it (the wish fails anyway). It sneaks back next to the wish box
// whenever you go back to typing.
export const flee: Sabotage = {
	id: 'flee',
	attach({ form, input, submit }) {
		form.dataset.dodges = '0';
		const arena = form.closest<HTMLElement>('[data-flee-area]') ?? form;
		const run = () => {
			const dodges = Number(form.dataset.dodges);
			if (dodges >= DODGES) return; // out of breath: you can catch it now
			form.dataset.dodges = String(dodges + 1);
			const area = arena.getBoundingClientRect();
			const button = submit.getBoundingClientRect();
			const maxX = Math.max(0, area.width - button.width);
			const maxY = Math.max(0, area.height - button.height);
			const homeX = button.left - area.left - currentShift(submit).x;
			const homeY = button.top - area.top - currentShift(submit).y;
			const x = Math.random() * maxX - homeX;
			const y = Math.random() * maxY - homeY;
			const rotation = (Math.random() - 0.5) * 30;
			submit.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
		};

		const goHome = () => {
			submit.style.transform = '';
		};

		const onPointerMove = (event: PointerEvent) => {
			// Hovering the wish box itself never scares it off, so it can come home while you type.
			if (event.target === input) return;
			const b = submit.getBoundingClientRect();
			const dx = event.clientX - (b.left + b.width / 2);
			const dy = event.clientY - (b.top + b.height / 2);
			if (Math.hypot(dx, dy) < PANIC_RADIUS_PX) run();
		};
		const onTouch = (event: Event) => {
			if (Number(form.dataset.dodges) >= DODGES) return; // let the tap through
			event.preventDefault();
			run();
		};

		form.classList.add('is-fleeing');
		arena.addEventListener('pointermove', onPointerMove);
		submit.addEventListener('focus', run);
		submit.addEventListener('touchstart', onTouch, { passive: false });
		input.addEventListener('focus', goHome);
		return () => {
			input.removeEventListener('focus', goHome);
			form.classList.remove('is-fleeing');
			arena.removeEventListener('pointermove', onPointerMove);
			submit.removeEventListener('focus', run);
			submit.removeEventListener('touchstart', onTouch);
			submit.style.transform = '';
			delete form.dataset.dodges;
		};
	},
	async reject(_wish, { form }) {
		if (Number(form.dataset.dodges) < DODGES) return SKIPPED_CHASE_MESSAGE;
		return CAUGHT_MESSAGES[Math.floor(Math.random() * CAUGHT_MESSAGES.length)];
	},
};

function currentShift(el: HTMLElement): { x: number; y: number } {
	const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
	return { x: matrix.m41, y: matrix.m42 };
}
