import { expect, test, type Page } from '@playwright/test';

const SABOTAGES = ['flee', 'correct', 'paywall', 'portal'];

// Keep the suite offline: never load the real analytics script (it would skip localhost anyway).
test.beforeEach(async ({ page }) => {
	await page.route('**://gc.zgo.at/**', (route) => route.abort());
});

/** Submits a wish, gets past the paywall if it shows up, and waits for the attempt to settle. */
async function submitWish(page: Page, wish: string, paywallChoice: 'upgrade' | 'decline' = 'decline') {
	const form = page.locator('[data-wish-form]');
	const attempts = Number((await form.getAttribute('data-attempts')) ?? 0);
	await page.locator('[data-wish-input]').fill(wish);
	await page.locator('[data-wish-input]').press('Enter');

	const paywall = page.locator('[data-paywall]');
	if (await paywall.evaluate((d: HTMLDialogElement) => d.open)) {
		await expect(paywall).toContainText('characters over the free tier');
		await expect(paywall.getByText('sold out')).toBeHidden();
		if (paywallChoice === 'upgrade') {
			await paywall.getByRole('button', { name: 'Upgrade to Wish Pro' }).click();
			await expect(paywall.getByText('sold out')).toBeVisible();
			await expect(paywall.getByText('characters over the free tier')).toBeHidden();
			await paywall.getByRole('button', { name: 'Back to wishing' }).click();
		} else {
			await paywall.getByRole('button', { name: 'Keep my wish small' }).click();
		}
	}
	await expect(form).toHaveAttribute('data-attempts', String(attempts + 1));
}

/** Opens the site and taps through the mobile intro or the desktop reveal, so the whole story shows. */
async function open(page: Page) {
	await page.goto('./');
	if (await page.locator('html.intro, html.reveal').count()) {
		await page.mouse.click(5, 5); // a tap anywhere skips
		await expect(page.locator('html')).not.toHaveClass(/\b(intro|reveal)\b/);
		// On desktop the phone then slides over to its spot; wait so positions are stable.
		await expect.poll(() => page.locator('.story').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
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

	await expect(page.locator('[data-countdown-prep]')).toHaveText('in');

	// The city count reserves its final width from the first frame, then counts up over ~2s.
	const count = page.locator('.jab-count');
	await page.clock.runFor(100);
	const startWidth = (await count.boundingBox())!.width;
	await page.clock.runFor(1_000);
	expect((await count.boundingBox())!.width).toBeCloseTo(startWidth, 0);

	await page.clock.runFor(3_900);
	await expect(clock).toHaveText('00:13:55');
	// Kathmandu is the only +05:45 zone; GeoNames lists 46 cities of 15k+ there, so 45 others.
	await expect(page.locator('[data-countdown-jab]')).toHaveText('and 45 other cities your guru has never been to.', {
		useInnerText: true,
	});
	expect((await count.boundingBox())!.width).toBeCloseTo(startWidth, 0);
});

test('shows the portal state during an 11:11 minute', async ({ page }) => {
	await page.clock.install({ time: new Date('2026-10-26T05:26:00Z') });
	await open(page);
	await page.clock.pauseAt(new Date('2026-10-26T05:26:20Z'));

	await expect(page.locator('body')).toHaveClass(/is-now/);
	await expect(page.locator('[data-countdown-lead]')).toHaveText('It’s 11:11 am right now in');
	await expect(page.locator('[data-countdown-city]')).toHaveText('Kathmandu');
	await expect(page.locator('[data-countdown-clock]')).toHaveText('00:40');
	await expect(page.locator('[data-countdown-prep]')).toHaveText('for');
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

test('rewrites the wish into influencer slop while typing, then owns up to it', async ({ page }) => {
	await open(page);
	for (let i = 0; i < 40 && !(await activeSabotages(page)).includes('correct'); i++) await submitWish(page, 'x');
	test.skip(!(await activeSabotages(page)).includes('correct'), 'never rolled "correct"');

	const input = page.locator('[data-wish-input]');
	await input.pressSequentially('i want a pony');
	const value = await input.inputValue();
	expect(value).not.toContain('pony');
	expect([...value]).toHaveLength('i want a pony'.length);

	// Whatever else is active (and the paywall never gets a say), the rejection is the autocorrect's.
	await input.press('Enter');
	await expect(page.locator('[data-wish-status]')).toHaveText('Your wish was auto-corrected for maximum alignment. You’re welcome.');
	expect(await page.locator('[data-paywall]').evaluate((d: HTMLDialogElement) => d.open)).toBe(false);
});

test('Ko-fi lives in the footer, and a denied wish points down to its coffee link', async ({ page }) => {
	await open(page);
	const kofi = page.locator('a[href*="ko-fi.com"]');
	await expect(kofi).toHaveCount(1);
	await expect(page.locator('.site-footer').getByRole('link', { name: /Ko-fi/ })).toHaveAttribute('href', 'https://ko-fi.com/lesselevens');
	await expect(kofi).toBeVisible();

	const open_ = page.locator('[data-tip-open]');
	const denied = page.locator('[data-tip-denied]');
	await expect(open_).toBeVisible();
	await expect(denied).toBeHidden();
	await submitWish(page, 'a pony');
	await expect(open_).toBeHidden();
	await expect(denied).toBeVisible();
	await expect(denied).toContainText('coffee link below');
	await expect(denied.getByRole('link')).toHaveCount(0);
	await expect(kofi).toHaveCount(1);
});

test('mobile intro: hero first, then the text, then the phone fades in around a hero that never moves', async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name !== 'mobile', 'the intro only plays on the mobile layout');
	// Record every class the <html> element goes through: the fade phase is too short to catch by polling.
	await page.addInitScript(() => {
		const seen: string[] = [];
		(window as unknown as { introPhases: string[] }).introPhases = seen;
		new MutationObserver(() => seen.push(document.documentElement.className)).observe(document, {
			attributes: true,
			subtree: true,
			attributeFilter: ['class'],
		});
	});
	await page.goto('./');

	const html = page.locator('html');
	await expect(html).toHaveClass(/intro/);
	await expect(page.locator('.countdown')).toHaveCSS('opacity', '0');
	const heroBefore = (await page.locator('.hero').boundingBox())!;
	await page.screenshot({ path: testInfo.outputPath('intro-hero.png') });

	await expect(page.locator('.manifesto-char.is-on').first()).toBeVisible({ timeout: 5_000 });
	const textTop = (await page.locator('.manifesto-text').boundingBox())!.y;
	expect(textTop).toBeGreaterThan(heroBefore.y + heroBefore.height);
	await page.waitForTimeout(1_500);
	await page.screenshot({ path: testInfo.outputPath('intro-writing.png') });

	await expect(html).not.toHaveClass(/intro/, { timeout: 15_000 });
	const phases = await page.evaluate(() => (window as unknown as { introPhases: string[] }).introPhases);
	expect(phases.some((c) => /\bintro-landing\b/.test(c))).toBe(true);
	await expect(page.locator('.story')).toBeInViewport({ ratio: 1 });
	const heroAfter = (await page.locator('.hero').boundingBox())!;
	expect(heroAfter.x).toBeCloseTo(heroBefore.x, 0);
	expect(heroAfter.y).toBeCloseTo(heroBefore.y, 0);
	await page.screenshot({ path: testInfo.outputPath('intro-landed.png') });
});

test('with reduced motion, shows the manifesto at once, then the story without sliding', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'mobile', 'the intro only plays on the mobile layout');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./');
	await expect(page.locator('html')).toHaveClass(/intro/);
	await expect(page.locator('.manifesto-char:not(.is-on)')).toHaveCount(0);
	await expect(page.locator('html')).not.toHaveClass(/intro/, { timeout: 6_000 });
	await expect(page.locator('.story')).toBeInViewport();
});

test('desktop reveal: the phone starts centred, slides over as the text writes itself out, then the sticker flies in', async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'the reveal only plays on the desktop layout');
	// Outside any 11:11 minute (Kathmandu's 05:26 is next), so the jab shows a city count to hold back.
	await page.clock.install({ time: new Date('2026-10-26T05:12:00Z') });
	await page.goto('./');
	const html = page.locator('html');
	const sticker = page.locator('.countdown-sticker');
	const storyCentre = async () => {
		const b = (await page.locator('.story').boundingBox())!;
		return b.x + b.width / 2;
	};
	const pageCentre = page.viewportSize()!.width / 2;
	await expect(html).toHaveClass(/\breveal\b/);
	await expect(page.locator('[data-wish-input]')).toBeVisible(); // the rest of the phone is there from the start
	await expect(sticker).toHaveCSS('opacity', '0');
	expect(Math.abs((await storyCentre()) - pageCentre)).toBeLessThan(2);

	await expect(page.locator('.manifesto-text')).toHaveClass(/is-typing/, { timeout: 8_000 });
	await expect(sticker).toHaveCSS('opacity', '0'); // still hidden while the text writes
	await expect(page.locator('.jab-count > :not(.jab-count-final)')).toHaveText('0'); // and the cities wait to count
	await page.waitForTimeout(800);
	expect(await storyCentre()).toBeLessThan(pageCentre - 100); // moved over to make room
	await page.screenshot({ path: testInfo.outputPath('reveal-writing.png') });

	await expect(html).not.toHaveClass(/\breveal\b/, { timeout: 15_000 });
	await expect(sticker).toHaveCSS('opacity', '1');
	await expect(page.locator('.manifesto-char:not(.is-on)')).toHaveCount(0);
	await page.waitForTimeout(250);
	await page.screenshot({ path: testInfo.outputPath('reveal-flying.png') });
	await page.waitForTimeout(2_500);
	await page.screenshot({ path: testInfo.outputPath('reveal-done.png') });
});

test('desktop reveal: a click shows everything at once', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'the reveal only plays on the desktop layout');
	await page.goto('./');
	await expect(page.locator('html')).toHaveClass(/\breveal\b/);
	await page.mouse.click(5, 5);
	await expect(page.locator('html')).not.toHaveClass(/\breveal\b/);
	await expect(page.locator('.countdown-sticker')).toHaveCSS('opacity', '1');
	await expect(page.locator('.countdown-jab')).toHaveCSS('opacity', '1');
	await expect(page.locator('.manifesto-text')).toBeVisible();
});

test('after the intro, the manifesto stays covered and the footer sits below the story', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'mobile', 'the intro only plays on the mobile layout');
	await open(page);
	await expect(page.locator('[data-manifesto]')).toHaveCSS('opacity', '0');

	const story = (await page.locator('.story').boundingBox())!;
	const footer = (await page.locator('footer').boundingBox())!;
	const viewport = page.viewportSize()!;
	expect(story.width / story.height).toBeCloseTo(9 / 16, 2);
	expect(story.x).toBeGreaterThanOrEqual(15);
	expect(story.y + story.height).toBeLessThanOrEqual(footer.y);
	expect(footer.y + footer.height).toBeLessThanOrEqual(viewport.height);
});

test('reveals the page only once the display fonts are in', async ({ page }) => {
	await page.goto('./');
	await expect(page.locator('html')).not.toHaveClass(/fonts-loading/);
	const loaded = await page.evaluate(() =>
		['italic 300 1em "Cormorant Garamond"', '1em "Permanent Marker"'].every((f) => document.fonts.check(f)),
	);
	expect(loaded).toBe(true);
});

test('an empty wish is denied too', async ({ page }) => {
	await open(page);
	await page.locator('[data-wish-input]').press('Enter');
	await expect(page.locator('[data-wish-status]')).toHaveText('Empty wishes are a premium feature.');
	await expect(page.locator('[data-tip-denied]')).toBeVisible();
	await expect(page.locator('[data-tip-open]')).toBeHidden();
});

test('the fleeing button comes back when you go back to the wish box', async ({ page }) => {
	await open(page);
	const form = page.locator('[data-wish-form]');
	for (let i = 0; i < 40 && !(await activeSabotages(page)).includes('flee'); i++) await submitWish(page, 'x');
	test.skip(!(await activeSabotages(page)).includes('flee'), 'never rolled "flee"');

	const submit = page.locator('[data-wish-submit]');
	await page.locator('[data-wish-input]').fill('a pony');
	await submit.focus(); // keyboard focus makes it run
	await expect(submit).not.toHaveAttribute('style', /^$|transform: none/);
	await expect(form).toHaveClass(/is-fleeing/);

	await page.locator('[data-wish-input]').focus();
	await expect.poll(() => submit.evaluate((el) => el.style.transform)).toBe('');
});

test('the fleeing button runs a random number of times, once per approach, then denies the wish anyway', async ({ page }) => {
	await open(page);
	for (let i = 0; i < 40 && !(await activeSabotages(page)).includes('flee'); i++) await submitWish(page, 'x');
	test.skip(!(await activeSabotages(page)).includes('flee'), 'never rolled "flee"');

	await page.locator('[data-wish-input]').fill('a pony');
	const form = page.locator('[data-wish-form]');
	const submit = page.locator('[data-wish-submit]');
	const maxDodges = Number(await form.getAttribute('data-max-dodges'));
	expect(maxDodges).toBeGreaterThanOrEqual(2);
	expect(maxDodges).toBeLessThanOrEqual(5);
	const centre = async () => {
		const b = (await submit.boundingBox())!;
		return [b.x + b.width / 2, b.y + b.height / 2] as const;
	};
	// Sweep in like a real mouse (many moves in a row) so a dodge still in flight can't be spent twice.
	const approach = async () => {
		const [x, y] = await centre();
		await page.mouse.move(x < page.viewportSize()!.width / 2 ? x + 140 : x - 140, y); // from whichever side is on screen
		await page.mouse.move(x, y, { steps: 12 });
		return [x, y] as const;
	};
	for (let dodge = 1; dodge <= maxDodges; dodge++) {
		await approach();
		await page.waitForTimeout(300); // let it finish running
		await expect(form).toHaveAttribute('data-dodges', String(dodge));
	}

	const [x, y] = await approach();
	await page.waitForTimeout(300);
	expect(await centre()).toEqual([x, y]); // too tired to run
	await page.mouse.click(x, y);

	const paywall = page.locator('[data-paywall]');
	if (await paywall.evaluate((d: HTMLDialogElement) => d.open)) await paywall.getByRole('button', { name: 'Keep my wish small' }).click();
	await expect(page.locator('[data-wish-status]')).toHaveText(/Caught it|cornered the button|Nice sprint/);
});

test('a button that starts fleeing right after you clicked it waits until the cursor has left', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'hovering needs a mouse');
	await open(page);
	const form = page.locator('[data-wish-form]');
	const submit = page.locator('[data-wish-submit]');
	const input = page.locator('[data-wish-input]');
	// Click send (from a calm button) until the re-roll after that click arms the chase.
	for (let i = 0; i < 60; i++) {
		if ((await activeSabotages(page)).includes('flee')) {
			await submitWish(page, 'x'); // Enter, so the cursor isn't involved
			continue;
		}
		const attempts = Number(await form.getAttribute('data-attempts'));
		await input.fill('a pony');
		const b = (await submit.boundingBox())!;
		await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
		const paywall = page.locator('[data-paywall]');
		if (await paywall.evaluate((d: HTMLDialogElement) => d.open)) await paywall.getByRole('button', { name: 'Keep my wish small' }).click();
		await expect(form).toHaveAttribute('data-attempts', String(attempts + 1));
		if ((await activeSabotages(page)).includes('flee') && (await submit.evaluate((el) => el.matches(':hover')))) break;
	}
	test.skip(!(await activeSabotages(page)).includes('flee'), 'never rolled "flee" right after a click');
	await input.fill('a pony'); // something to chase

	// Wiggling over it doesn't scare it.
	const b = (await submit.boundingBox())!;
	const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
	await page.mouse.move(x + 4, y + 2, { steps: 4 });
	await page.mouse.move(x - 3, y - 1, { steps: 4 });
	await page.waitForTimeout(300);
	await expect(form).toHaveAttribute('data-dodges', '0');

	// Once the cursor has left, coming back does.
	await page.mouse.move(x - 300, y - 200, { steps: 6 });
	await page.mouse.move(x, y, { steps: 12 });
	await expect(form).toHaveAttribute('data-dodges', '1');
});

test('the chase only speaks up once the button has actually run', async ({ page }) => {
	await open(page);
	const chaseLines = /went around it|manifestation technique|Shortcuts don’t manifest|Caught it|cornered the button|Nice sprint/;
	const status = page.locator('[data-wish-status]');
	const form = page.locator('[data-wish-form]');
	const submit = page.locator('[data-wish-submit]');
	const rollFlee = async () => {
		for (let i = 0; i < 40 && !(await activeSabotages(page)).includes('flee'); i++) await submitWish(page, 'x');
		test.skip(!(await activeSabotages(page)).includes('flee'), 'never rolled "flee"');
	};

	// Sent with Enter before it ever moved: whoever answers, it isn't the chase.
	for (let round = 0; round < 3; round++) {
		await rollFlee();
		await submitWish(page, 'a pony');
		await expect(status).not.toHaveText(chaseLines);
	}

	// Scared off once, then skipped with Enter: now the chase calls it out.
	await rollFlee();
	await page.locator('[data-wish-input]').fill('a pony');
	const b = (await submit.boundingBox())!;
	await page.mouse.move(b.x + b.width / 2 - 140, b.y + b.height / 2);
	await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
	await expect(form).toHaveAttribute('data-dodges', '1');
	await page.locator('[data-wish-input]').press('Enter');
	await expect(status).toHaveText(/went around it|manifestation technique|Shortcuts don’t manifest/);
});

test('the button only runs once there is a wish to chase', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'hovering needs a mouse');
	await open(page);
	for (let i = 0; i < 40 && !(await activeSabotages(page)).includes('flee'); i++) await submitWish(page, 'x');
	test.skip(!(await activeSabotages(page)).includes('flee'), 'never rolled "flee"');

	const form = page.locator('[data-wish-form]');
	const submit = page.locator('[data-wish-submit]');
	const b = (await submit.boundingBox())!;
	const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
	await page.mouse.move(x - 140, y);
	await page.mouse.move(x, y, { steps: 12 });
	await page.waitForTimeout(300);
	await expect(form).toHaveAttribute('data-dodges', '0'); // empty box: nothing to run with

	await page.mouse.click(x, y);
	await expect(page.locator('[data-wish-status]')).toHaveText('Empty wishes are a premium feature.');
});

test('a caught button goes home after an empty wish too', async ({ page }) => {
	await open(page);
	for (let i = 0; i < 40 && !(await activeSabotages(page)).includes('flee'); i++) await submitWish(page, 'x');
	test.skip(!(await activeSabotages(page)).includes('flee'), 'never rolled "flee"');

	const form = page.locator('[data-wish-form]');
	const submit = page.locator('[data-wish-submit]');
	const input = page.locator('[data-wish-input]');
	const attempts = Number(await form.getAttribute('data-attempts'));
	await input.fill('a pony');
	for (let i = 0; i < 6; i++) {
		const b = (await submit.boundingBox())!;
		await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
		await page.waitForTimeout(250);
	}
	// Erase the wish without focusing the box (which would call the button home).
	await input.evaluate((el: HTMLInputElement) => (el.value = ''));
	const b = (await submit.boundingBox())!;
	await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);

	await expect(page.locator('[data-wish-status]')).toHaveText('Empty wishes are a premium feature.');
	await expect(form).toHaveAttribute('data-attempts', String(attempts + 1));
	await expect.poll(() => submit.evaluate((el) => el.style.transform)).toBe('');
});

test('talks to no outside host except GoatCounter', async ({ page }) => {
	const hosts = new Set<string>();
	page.on('request', (request) => hosts.add(new URL(request.url()).hostname));
	await open(page);
	for (let i = 0; i < 3; i++) await submitWish(page, 'a pony');
	for (const host of hosts) expect(['localhost', 'gc.zgo.at']).toContain(host);
});

test('analytics events never include the wish', async ({ page }) => {
	await page.addInitScript(() => {
		const sent: unknown[] = [];
		(window as unknown as { sent: unknown[] }).sent = sent;
		window.goatcounter = { count: (vars) => sent.push(vars) };
	});
	await open(page);
	for (let i = 0; i < 5; i++) await submitWish(page, 'my secret pony');
	await page.locator('[data-wish-input]').press('Enter'); // an empty one too

	const sent = await page.evaluate(() => (window as unknown as { sent: { path: string }[] }).sent);
	expect(sent.length).toBeGreaterThanOrEqual(6);
	for (const event of sent) expect(event.path).toMatch(/^wish-denied-(flee|correct|paywall|portal|generic|empty)$/);
	expect(JSON.stringify(sent)).not.toMatch(/secret|pony/);
});

test('the icon-only send button still has a name', async ({ page }) => {
	await open(page);
	await expect(page.getByRole('button', { name: 'Send wish' })).toBeVisible();
});

test('the rejection toast clears itself after a few seconds', async ({ page }) => {
	await open(page);
	const status = page.locator('[data-wish-status]');
	await submitWish(page, '');
	await expect(status).toHaveText('Empty wishes are a premium feature.');
	await page.waitForTimeout(1500);
	await expect(status).not.toBeEmpty();
	await expect(status).toBeEmpty({ timeout: 4000 });
});

test('keeps the wish box still when wishes get rejected', async ({ page }) => {
	await open(page);
	const input = page.locator('[data-wish-input]');
	const before = (await input.boundingBox())!;
	for (let i = 0; i < 3; i++) {
		await submitWish(page, 'a pony');
		const after = (await input.boundingBox())!;
		expect(after.y).toBeCloseTo(before.y, 0);
	}
});

test('has a footer with the no-backend note: one centred row on desktop, notes beside the coffee on mobile', async ({
	page,
}, testInfo) => {
	await open(page);
	const footer = page.locator('footer');
	await footer.scrollIntoViewIfNeeded();
	await expect(footer).toContainText('No wishes are stored, sent or read.');
	const notes = (await page.locator('.site-footer-notes').boundingBox())!;
	const kofi = (await page.locator('.site-footer-kofi a').boundingBox())!;
	if (testInfo.project.name === 'desktop') {
		await expect(footer).toHaveCSS('justify-content', 'center');
		expect(Math.abs(notes.y + notes.height / 2 - (kofi.y + kofi.height / 2))).toBeLessThan(4); // one row
	} else {
		expect(kofi.x).toBeGreaterThan(notes.x + notes.width); // the coffee sits to the right
		expect(Math.abs(kofi.height - notes.height)).toBeLessThan(6); // as tall as the notes
		expect(kofi.height).toBeLessThan(70); // which stay three lines, so the pill never balloons

		// Narrower phones stack them instead: the coffee on top, the notes centred below.
		await page.setViewportSize({ width: 390, height: 844 });
		const narrowNotes = (await page.locator('.site-footer-notes').boundingBox())!;
		const narrowKofi = (await page.locator('.site-footer-kofi a').boundingBox())!;
		expect(narrowKofi.y + narrowKofi.height).toBeLessThanOrEqual(narrowNotes.y + 1);
		await expect(footer).toHaveCSS('text-align', 'center');
	}
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
