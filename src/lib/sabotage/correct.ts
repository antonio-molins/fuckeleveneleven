import type { Sabotage } from './types';

export const SLOP = [
	'manifest abundance ✨ ',
	'link in bio 🔗 ',
	'use code WISH11 for 11% off ',
	'protect your energy 🌙 ',
	'my morning routine (5am, cold plunge) ',
	'the universe is my business partner ',
	'not sponsored (sponsored) ',
	'raise your vibration, raise your prices ',
];

/** Whatever you typed, as long as you typed it: the first `length` characters of the slop. */
export function slopFor(length: number, offset = 0): string {
	const text = SLOP.slice(offset).concat(SLOP.slice(0, offset)).join('');
	const chars = [...text];
	let out = '';
	for (let i = 0; i < length; i++) out += chars[i % chars.length];
	return out;
}

// Every keystroke is "aligned" into influencer copy. Length is all you get to keep.
export const correct: Sabotage = {
	id: 'correct',
	attach({ input }) {
		const offset = Math.floor(Math.random() * SLOP.length);
		const onInput = () => {
			input.value = slopFor([...input.value].length, offset);
		};
		input.addEventListener('input', onInput);
		return () => input.removeEventListener('input', onInput);
	},
	async reject() {
		return 'Your wish was auto-corrected for maximum alignment. You’re welcome.';
	},
};
