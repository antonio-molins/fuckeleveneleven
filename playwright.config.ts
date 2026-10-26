import { defineConfig, devices } from '@playwright/test';

const PORT = 4111;

export default defineConfig({
	testDir: 'e2e',
	use: { baseURL: `http://localhost:${PORT}/` },
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } },
	],
	webServer: {
		command: `npm run build && npx astro preview --port ${PORT} --ignore-lock`,
		url: `http://localhost:${PORT}/`,
		reuseExistingServer: !process.env.CI,
	},
});
