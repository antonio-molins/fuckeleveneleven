import { expect, test, type Page } from '@playwright/test';

const SABOTAGES = ['flee', 'correct', 'paywall', 'portal'];

/** Submits a wish, gets past the paywall if it shows up, and waits for the attempt to settle. */
async function submitWish(page: Page, wish: string, paywallChoice: 'upgrade' | 'decline' = 'decline') {
	const form = page.locator('[data-wish-form]');
	const attempts = Number((await form.getAttribute('data-attempts')) ?? 0);
	await page.locator('[data-wish-input]').fill(wish);
	await page.locator('[data-wish-input]').press('Enter');

	const paywall = page.locator('[data-paywall]');
	if (await paywall.evaluate((d: HTMLDialogElement) => d.open)) {
		await expect(paywall).toContainText('characters over the free tier');
		if (paywallChoice === 'upgrade') {
			await paywall.getByRole('button', { name: 'Upgrade to Wish Pro' }).click();
			await expect(paywall).toContainText('sold out');
			await paywall.getByRole('button', { name: 'Back to wishing' }).click();
		} else {
			await paywall.getByRole('button', { name: 'Keep my wish small' }).click();
		}
	}
	await expect(form).toHaveAttribute('data-attempts', String(attempts + 1));
}

/** Opens the site and, on mobile, taps through the intro so the story is usable. */
async function open(page: Page) {
	await page.goto('./');
	if (await page.locator('html.intro').count()) {
		await page.locator('[data-manifesto]').click();
		await expect(page.locator('html')).not.toHaveClass(/intro/);
	}
}

const activeSabotages = async (page: Page) =>
	((await page.locator('[data-wish-form]').getAttribute('data-sabotage')) ?? '').split(' ');

test('counts down to the next 11:11 somewhere', async ({ page }) => {
	// At 05:12 UTC Kathmandu (+05:45) is 10:57. Whole and half-hour zones hit 11:11 at :11 and :41,
	// so Kathmandu's 05:26 is the soonest anywhere.
	// Start a bit early and freeze at 05:12:00 once any mobile intro is out of the way.
	await page.clock.install({ time: new Date('2026-10-26T05:11:30Z') });
	await open(page);
	await page.clock.pauseAt(new Date('2026-10-26T05:12:00Z'));

	const clock = page.locator('[data-countdown-clock]');
	await expect(page.locator('[data-countdown-city]')).toHaveText('Kathmandu');
	await expect(clock).toHaveText('00:14:00');

	await page.clock.runFor(5_000);
	await expect(clock).toHaveText('00:13:55');
});

test('shows the portal state during an 11:11 minute', async ({ page }) => {
	await page.clock.install({ time: new Date('2026-10-26T05:26:00Z') });
	await open(page);
	await page.clock.pauseAt(new Date('2026-10-26T05:26:20Z'));

	await expect(page.locator('body')).toHaveClass(/is-now/);
	await expect(page.locator('[data-countdown-lead]')).toHaveText('It’s 11:11 am right now in');
	await expect(page.locator('[data-countdown-city]')).toHaveText('Kathmandu');
	await expect(page.locator('[data-countdown-clock]')).toHaveText('00:40');
});

test('never accepts a wish, whatever sabotage is active', async ({ page }) => {
	await open(page);
	const status = page.locator('[data-wish-status]');
	const seen = new Set<string>();

	for (let attempt = 0; attempt < 12; attempt++) {
		(await activeSabotages(page)).forEach((id) => seen.add(id));
		await submitWish(page, 'a pony', attempt % 2 ? 'upgrade' : 'decline');
		await expect(status).not.toBeEmpty();
		await expect(status).not.toContainText(/granted|accepted|success/i);
		await expect(page.locator('[data-wish-input]')).toHaveValue('');
	}

	expect([...seen].every((id) => SABOTAGES.includes(id))).toBe(true);
});

test('rewrites the wish into influencer slop while typing', async ({ page }) => {
	await open(page);
	for (let i = 0; i < 40 && !(await activeSabotages(page)).includes('correct'); i++) await submitWish(page, 'x');
	test.skip(!(await activeSabotages(page)).includes('correct'), 'never rolled "correct"');

	await page.locator('[data-wish-input]').pressSequentially('i want a pony');
	const value = await page.locator('[data-wish-input]').inputValue();
	expect(value).not.toContain('pony');
	expect([...value]).toHaveLength('i want a pony'.length);
});

test('links to Ko-fi, and offers it once a wish has been denied', async ({ page }) => {
	await open(page);
	await expect(page.locator('[data-kofi]')).toHaveAttribute('href', 'https://ko-fi.com/lesselevens');

	const tip = page.locator('[data-wish-tip]');
	await expect(tip).toBeHidden();
	await submitWish(page, 'a pony');
	await expect(tip).toBeVisible();
	await expect(tip.getByRole('link')).toHaveAttribute('href', 'https://ko-fi.com/lesselevens');
});

test('mobile intro writes the manifesto, then the story slides over it', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'mobile', 'the intro only plays on the mobile layout');
	await page.goto('./');

	const html = page.locator('html');
	await expect(html).toHaveClass(/intro/);
	await expect(page.locator('.manifesto-char.is-on').first()).toBeVisible();
	await page.waitForTimeout(800);
	await page.screenshot({ path: testInfo.outputPath('intro-writing.png') });

	await expect(html).not.toHaveClass(/intro/, { timeout: 10_000 });
	expect((await page.locator('.story').boundingBox())!.y).toBeLessThan(50);
	await page.waitForTimeout(1_800);
	await page.screenshot({ path: testInfo.outputPath('intro-landed.png') });
});

test('skips the intro for people who prefer reduced motion', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./');
	await expect(page.locator('html')).not.toHaveClass(/intro/);
	await expect(page.locator('.story')).toBeInViewport();
});

test('has a centered footer with the Ko-fi link', async ({ page }) => {
	await open(page);
	const footer = page.locator('footer');
	await footer.scrollIntoViewIfNeeded();
	await expect(footer.getByRole('link', { name: 'Tip me on Ko-fi' })).toBeVisible();
	await expect(footer).toHaveCSS('text-align', 'center');
});

test('screenshot', async ({ page }, testInfo) => {
	// Start a bit early and freeze at 05:12:00 once any mobile intro is out of the way.
	await page.clock.install({ time: new Date('2026-10-26T05:11:30Z') });
	await open(page);
	await page.clock.pauseAt(new Date('2026-10-26T05:12:00Z'));
	await expect(page.locator('[data-countdown-clock]')).toHaveText('00:14:00');
	await page.clock.runFor(3_000);
	// Let the marker scrawl finish drawing (CSS animations run on real time, not the mocked clock).
	await page.waitForTimeout(2_000);
	await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}.png`), fullPage: true });
});
