export interface WishElements {
	form: HTMLFormElement;
	input: HTMLInputElement;
	submit: HTMLButtonElement;
	paywall: HTMLDialogElement;
}

export type Cleanup = () => void;

export interface Sabotage {
	id: 'flee' | 'correct' | 'paywall' | 'portal';
	/** Live mischief while the user is trying (fleeing, rewriting, etc.). */
	attach?(els: WishElements): Cleanup;
	/** Handles a submit attempt and resolves to the rejection message to show. */
	reject?(wish: string, els: WishElements): Promise<string>;
}
