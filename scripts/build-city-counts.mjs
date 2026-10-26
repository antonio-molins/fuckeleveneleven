// Builds src/data/cityCounts.json: how many cities of 15,000+ people each IANA time zone has.
// Source: GeoNames cities15000 (CC BY 4.0), https://download.geonames.org/export/dump/cities15000.zip
// Usage: node scripts/build-city-counts.mjs path/to/cities15000.txt
import { readFileSync, writeFileSync } from 'node:fs';

const TIMEZONE_COLUMN = 17;
const [input] = process.argv.slice(2);
if (!input) throw new Error('Usage: node scripts/build-city-counts.mjs path/to/cities15000.txt');

const counts = {};
for (const line of readFileSync(input, 'utf8').split('\n')) {
	const zone = line.split('\t')[TIMEZONE_COLUMN];
	if (zone) counts[zone] = (counts[zone] ?? 0) + 1;
}

const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(new URL('../src/data/cityCounts.json', import.meta.url), `${JSON.stringify(sorted, null, '\t')}\n`);
console.log(`${Object.keys(sorted).length} zones, ${Object.values(sorted).reduce((a, b) => a + b, 0)} cities`);
