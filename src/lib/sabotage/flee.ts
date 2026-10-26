import type { Sabotage } from './types';

const PANIC_RADIUS_PX = 90;

// The submit button refuses to be pressed: it runs from the cursor, a tap or keyboard focus.
// It sneaks back next to the wish box whenever you go back to typing, ready to run again.
export const flee: Sabotage = {
	id: 'flee',
	attach({ form, input, submit }) {
		const arena = form.closest<HTMLElement>('[data-flee-area]') ?? form;
		const run = () => {
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
		};
	},
};

function currentShift(el: HTMLElement): { x: number; y: number } {
	const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
	return { x: matrix.m41, y: matrix.m42 };
}
