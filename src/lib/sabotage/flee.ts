import type { Sabotage } from './types';

const PANIC_RADIUS_PX = 90;
/** How many times it gets away before it lets you catch it: a fresh roll every time it's armed. */
const MIN_DODGES = 2;
const MAX_DODGES = 5;

export const CAUGHT_MESSAGES = [
	'Caught it! All those laps around the story and the universe still says no. Great cardio, though.',
	'You cornered the button. Shame the wish was never in the button.',
	'Finally caught it. Shame wishes don’t care about stamina. Nice sprint, though.',
];
export const SKIPPED_CHASE_MESSAGE = 'Skipping the chase? The universe only rewards hustle. Denied.';

// The submit button refuses to be pressed: it runs from the cursor, a tap or keyboard focus a few
// times (2 to 5, once per approach), then gives up and lets you press it (the wish fails anyway). It sneaks back next to the wish box
// whenever you go back to typing.
export const flee: Sabotage = {
	id: 'flee',
	attach({ form, input, submit }) {
		form.dataset.dodges = '0';
		form.dataset.maxDodges = String(MIN_DODGES + Math.floor(Math.random() * (MAX_DODGES - MIN_DODGES + 1)));
		const arena = form.closest<HTMLElement>('[data-flee-area]') ?? form;
		// While calm, the cursor near it doesn't scare it; the cursor leaving its panic radius ends that.
		// It starts calm when armed right after a click on it (the re-roll after a denied wish): running then
		// would look like the wish bounced it off.
		let calm = submit.matches(':hover');
		// `from` is the viewport point it's running from (cursor or finger). It lands far from both that
		// point and where it was, so a hand still sweeping towards its old spot can't scare it twice.
		const run = (from?: { x: number; y: number }) => {
			if (isCaught(form)) return; // out of breath: you can catch it now
			calm = true; // one dodge per approach: the cursor has to leave before it can scare it again
			form.dataset.dodges = String(Number(form.dataset.dodges) + 1);
			const area = arena.getBoundingClientRect();
			const button = submit.getBoundingClientRect();
			const maxX = Math.max(0, area.width - button.width);
			const maxY = Math.max(0, area.height - button.height);
			const homeX = button.left - area.left - currentShift(submit).x;
			const homeY = button.top - area.top - currentShift(submit).y;
			const was = { x: button.left + button.width / 2, y: button.top + button.height / 2 };
			let spot = { x: 0, y: 0, distance: -1 };
			for (let tries = 0; tries < 12 && spot.distance < 2 * PANIC_RADIUS_PX; tries++) {
				const x = Math.random() * maxX;
				const y = Math.random() * maxY;
				const centre = { x: area.left + x + button.width / 2, y: area.top + y + button.height / 2 };
				const distance = Math.min(
					Math.hypot(centre.x - was.x, centre.y - was.y),
					from ? Math.hypot(centre.x - from.x, centre.y - from.y) : Infinity,
				);
				if (distance > spot.distance) spot = { x, y, distance };
			}
			const x = spot.x - homeX;
			const y = spot.y - homeY;
			const rotation = (Math.random() - 0.5) * 30;
			submit.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
		};

		const goHome = () => {
			submit.style.transform = '';
		};

		const onPointerMove = (event: PointerEvent) => {
			const b = submit.getBoundingClientRect();
			const dx = event.clientX - (b.left + b.width / 2);
			const dy = event.clientY - (b.top + b.height / 2);
			const near = Math.hypot(dx, dy) < PANIC_RADIUS_PX;
			if (calm) calm = near;
			// Hovering the wish box itself never scares it off, so it can come home while you type.
			else if (near && event.target !== input) run({ x: event.clientX, y: event.clientY });
		};
		const onTouch = (event: TouchEvent) => {
			if (isCaught(form)) return; // let the tap through
			event.preventDefault();
			const touch = event.touches[0];
			run(touch && { x: touch.clientX, y: touch.clientY });
		};
		const onFocus = () => run();

		form.classList.add('is-fleeing');
		document.addEventListener('pointermove', onPointerMove);
		submit.addEventListener('focus', onFocus);
		submit.addEventListener('touchstart', onTouch, { passive: false });
		input.addEventListener('focus', goHome);
		return () => {
			input.removeEventListener('focus', goHome);
			form.classList.remove('is-fleeing');
			document.removeEventListener('pointermove', onPointerMove);
			submit.removeEventListener('focus', onFocus);
			submit.removeEventListener('touchstart', onTouch);
			submit.style.transform = '';
			delete form.dataset.dodges;
			delete form.dataset.maxDodges;
		};
	},
	// Only asked once it has run at least once (see WishForm): caught, or skipped by sending with Enter.
	async reject(_wish, { form }) {
		if (!isCaught(form)) return SKIPPED_CHASE_MESSAGE;
		return CAUGHT_MESSAGES[Math.floor(Math.random() * CAUGHT_MESSAGES.length)];
	},
};

/** True once it has used up all its dodges and lets itself be pressed. */
export function isCaught(form: HTMLElement): boolean {
	return form.dataset.maxDodges !== undefined && Number(form.dataset.dodges) >= Number(form.dataset.maxDodges);
}

function currentShift(el: HTMLElement): { x: number; y: number } {
	const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
	return { x: matrix.m41, y: matrix.m42 };
}
