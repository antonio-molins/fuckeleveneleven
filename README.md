# Fuck 11:11

A one-page site making fun of "11:11, make a wish ✨" manifestation content. It counts down to the next place on Earth where the clock reads 11:11, invites you to make a wish, and then makes it impossible to submit one.

No wishes are stored, sent or read. There is no backend.

## Commands

| Command            | Action                                            |
| :----------------- | :------------------------------------------------ |
| `npm install`      | Install dependencies                              |
| `npm run dev`      | Dev server at `localhost:4321`                    |
| `npm run build`    | Static build to `dist/`                           |
| `npm run check`    | Type-check (`astro check`)                        |
| `npm test`         | Unit tests (Vitest)                               |
| `npm run test:e2e` | Browser tests (Playwright, desktop + mobile)      |

First time running e2e: `npx playwright install chromium`.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes to GitHub Pages. The custom domain `fuckeleveneleven.com` is set in the repo's Pages settings (DNS at 101domain) and must match `site` in `astro.config.mjs`.
