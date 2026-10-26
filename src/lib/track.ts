// Anonymous event counts via GoatCounter (loaded in index.astro; it ignores localhost).
// Only fixed event names ever go out: never pass anything the visitor typed.

declare global {
	interface Window {
		goatcounter?: { count?: (vars: { path: string; title?: string; event?: boolean }) => void };
	}
}

export type TrackedEvent = `wish-denied-${string}` | 'kofi-click' | 'wish-pro-upgrade';

export function track(event: TrackedEvent): void {
	window.goatcounter?.count?.({ path: event, title: event, event: true });
}
