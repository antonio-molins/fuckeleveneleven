# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Fuck 11:11": a static, single-page Astro site parodying "11:11, make a wish" influencers. It counts down to the next place where the local clock reads 11:11, and the wish box can never accept a wish. There is no backend by design, and wish text must never leave the browser (no fetch, analytics or storage of it).

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run check`: `astro check` (TypeScript + Astro diagnostics)
- `npm test`: Vitest unit tests in `tests/`. Single test: `npx vitest run tests/elevenEleven.test.ts -t "wraps past midnight"`
- `npm run test:e2e`: Playwright (desktop + Pixel 7) against a built `astro preview` on port 4111. Single test: `npx playwright test -g "portal state" --project=desktop`
- Astro 7 auto-backgrounds `astro dev`/`astro preview` when it detects an agent. Use `astro preview stop` / `status` / `logs` to manage it. The Playwright config passes `--ignore-lock` to keep its server in the foreground; don't remove it.

## Architecture

- `src/lib/elevenEleven.ts`: pure timezone math, fully unit-tested.
  - `getOffsets()` groups IANA zones by their current UTC offset (via `Intl` `longOffset`, so DST is respected).
  - `nextElevenEleven()` treats 11:11 and 23:11 as one target modulo 12h, and returns the soonest start. All offset groups that tie are merged; zones 12h apart hit 11:11 together.
  - `isNow` holds for the whole 11:11 minute.
  - ICU returns legacy names (`Asia/Calcutta`, `Asia/Katmandu`), which `prettyZone` aliases.
- `src/components/Countdown.astro`: client script ticks every 250ms. It regroups offsets whenever the target changes, toggles `body.is-now`, and drives the story progress bar through the `--progress` CSS variable.
- `src/lib/sabotage/`: each sabotage implements `Sabotage` from `types.ts`.
  - `attach(els)` provides live mischief and returns a cleanup function.
  - `reject(wish, els)` resolves to the rejection message.
  - `pickSabotages()` picks a random 1–3, and never `flee` under `prefers-reduced-motion`.
- `src/components/WishForm.astro`: on every submit it always rejects, then re-rolls the sabotages. It exposes `data-sabotage` (active ids) and `data-attempts` (incremented once a submit fully settles) for e2e tests to wait on.
- Visual concept: a pastel influencer Instagram story (Cormorant Garamond italic), vandalised in Permanent Marker. Fonts are self-hosted through `@fontsource`; don't add external font or CDN requests. Tokens are at the top of `src/styles/global.css`.

## Gotchas

- Served at the root of `fuckeleveneleven.com` (custom domain on this repo's GitHub Pages project site; `antonio-molins.github.io/fuckeleveneleven` redirects there). Asset links still go through `import.meta.env.BASE_URL` so a base path can come back without edits.
- Mobile intro (`html.intro`, set by the inline script in `index.astro`): the inline script must stay *after* the viewport meta. Before that tag is parsed, mobile browsers report a ~980px layout width and the intro never starts.
- In e2e, use the `open(page)` helper. It taps through the mobile intro. Tests asserting exact countdown values install the clock a little early and `pauseAt` the target time after `open`, because the intro takes real seconds.
- In e2e, `page.clock` mocks JS time, but CSS animations run on real time. The hero scrawl animates in over about 1.6s, so wait before screenshots.
- When picking a fixed time for a "which city is next" test, remember that whole and half-hour offsets hit 11:11 at :11 and :41 UTC past the hour, and +x:45 offsets hit it at :26.
