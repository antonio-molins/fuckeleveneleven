import { describe, expect, it } from 'vitest';
import {
	canonicalZone,
	citiesIn,
	getOffsets,
	headlineZone,
	indexCityCounts,
	listZones,
	meridiem,
	nearestPortal,
	nextElevenEleven,
	parseOffset,
	prettyZone,
	type OffsetGroup,
} from '../src/lib/elevenEleven';

const utc = (iso: string) => Date.parse(`${iso}Z`);
const MIN = 60_000;

describe('parseOffset', () => {
	it.each([
		['GMT', 0],
		['GMT+05:45', 345],
		['GMT-03:00', -180],
		['GMT+12:45', 765],
		['GMT-09:30', -570],
	])('%s -> %i', (input, expected) => expect(parseOffset(input)).toBe(expected));

	it('rejects nonsense', () => expect(() => parseOffset('Mercury retrograde')).toThrow());
});

describe('nextElevenEleven', () => {
	const kathmandu: OffsetGroup = { offsetMinutes: 345, zones: ['Asia/Kathmandu'] };
	const london: OffsetGroup = { offsetMinutes: 0, zones: ['Europe/London'] };
	const saoPaulo: OffsetGroup = { offsetMinutes: -180, zones: ['America/Sao_Paulo'] };

	it('finds a :45 offset', () => {
		// 05:00 UTC = 10:45 in Kathmandu, so 11:11 there is 26 minutes away.
		const next = nextElevenEleven(utc('2026-10-26T05:00:00'), [kathmandu, london]);
		expect(next.groups).toEqual([kathmandu]);
		expect(next.targetUtcMs).toBe(utc('2026-10-26T05:26:00'));
		expect(next.isNow).toBe(false);
	});

	it('counts 23:11 as 11:11', () => {
		const next = nextElevenEleven(utc('2026-10-26T23:00:00'), [london]);
		expect(next.targetUtcMs).toBe(utc('2026-10-26T23:11:00'));
		expect(meridiem(next.targetUtcMs, 0)).toBe('pm');
	});

	it('is "now" for the whole 11:11 minute and not after', () => {
		const groups = [london];
		expect(nextElevenEleven(utc('2026-10-26T11:11:00'), groups).isNow).toBe(true);
		const inside = nextElevenEleven(utc('2026-10-26T11:11:59.999'), groups);
		expect(inside.isNow).toBe(true);
		expect(inside.targetUtcMs).toBe(utc('2026-10-26T11:11:00'));
		const after = nextElevenEleven(utc('2026-10-26T11:12:00'), groups);
		expect(after.isNow).toBe(false);
		expect(after.targetUtcMs).toBe(utc('2026-10-26T23:11:00'));
	});

	it('wraps past midnight UTC', () => {
		// 23:30 UTC = 20:30 in São Paulo; next 11:11 there is 23:11 local = 02:11 UTC next day.
		const next = nextElevenEleven(utc('2026-10-26T23:30:00'), [saoPaulo]);
		expect(next.targetUtcMs).toBe(utc('2026-10-27T02:11:00'));
	});

	it('merges offsets 12 hours apart that hit 11:11 together', () => {
		const pagoPago: OffsetGroup = { offsetMinutes: -660, zones: ['Pacific/Pago_Pago'] };
		const lagos: OffsetGroup = { offsetMinutes: 60, zones: ['Africa/Lagos'] };
		const next = nextElevenEleven(utc('2026-10-26T10:00:00'), [pagoPago, lagos]);
		expect(next.groups).toHaveLength(2);
		expect(next.targetUtcMs).toBe(utc('2026-10-26T10:11:00'));
	});

	it('reports the previous 11:11 anywhere', () => {
		const next = nextElevenEleven(utc('2026-10-26T05:00:00'), [kathmandu, london]);
		// London had 11:11 pm at 23:11 UTC the night before; Kathmandu's 11:11 pm was 17:26 UTC.
		expect(next.previousUtcMs).toBe(utc('2026-10-25T23:11:00'));
	});

	it('refuses an empty planet', () => expect(() => nextElevenEleven(0, [])).toThrow());
});

describe('getOffsets', () => {
	it('respects DST', () => {
		const summer = getOffsets(new Date(utc('2026-07-01T12:00:00')), ['Europe/London']);
		const winter = getOffsets(new Date(utc('2026-01-01T12:00:00')), ['Europe/London']);
		expect(summer[0].offsetMinutes).toBe(60);
		expect(winter[0].offsetMinutes).toBe(0);
	});

	it('groups zones sharing an offset', () => {
		const groups = getOffsets(new Date(utc('2026-01-01T12:00:00')), ['Europe/London', 'Africa/Abidjan', 'Asia/Tokyo']);
		expect(groups).toContainEqual({ offsetMinutes: 0, zones: ['Africa/Abidjan', 'Europe/London'] });
		expect(groups).toContainEqual({ offsetMinutes: 540, zones: ['Asia/Tokyo'] });
	});

	it('keeps the weird offsets that make this site work', () => {
		const offsets = getOffsets(new Date(utc('2026-01-01T12:00:00'))).map((g) => g.offsetMinutes);
		expect(offsets).toEqual(expect.arrayContaining([345, 330, 570]));
	});

	it('drops Etc/ pseudo-zones', () => {
		expect(listZones().some((z) => z.startsWith('Etc/'))).toBe(false);
	});
});

describe('naming', () => {
	it.each([
		['Asia/Kathmandu', 'Kathmandu'],
		['Asia/Katmandu', 'Kathmandu'],
		['Asia/Calcutta', 'Kolkata'],
		['America/Argentina/Buenos_Aires', 'Buenos Aires'],
		['America/St_Johns', 'St. John’s'],
	])('%s -> %s', (zone, city) => expect(prettyZone(zone)).toBe(city));

	it('prefers famous zones for the headline', () => {
		expect(headlineZone([{ offsetMinutes: -180, zones: ['America/Araguaina', 'America/Sao_Paulo'] }])).toBe(
			'America/Sao_Paulo',
		);
		expect(headlineZone([{ offsetMinutes: 0, zones: ['Africa/Abidjan'] }])).toBe('Africa/Abidjan');
	});

	it('knows am from pm', () => {
		expect(meridiem(utc('2026-10-26T05:26:00'), 345)).toBe('am');
		expect(meridiem(utc('2026-10-26T05:26:00') + 12 * 60 * MIN, 345)).toBe('pm');
	});
});

describe('city counts', () => {
	it('matches GeoNames zone names to whatever this engine calls them', () => {
		const index = indexCityCounts({ 'Asia/Kolkata': 3786, 'Asia/Kathmandu': 46 });
		const engineKolkata = canonicalZone('Asia/Kolkata')!;
		expect(citiesIn([{ offsetMinutes: 330, zones: [engineKolkata] }], index)).toBe(3786);
		expect(citiesIn([{ offsetMinutes: 330, zones: ['Asia/Kolkata'] }], index)).toBe(3786);
	});

	it('adds up every zone in every group hitting 11:11 together', () => {
		const index = indexCityCounts({ 'Pacific/Pago_Pago': 1, 'Africa/Lagos': 40, 'Africa/Algiers': 60 });
		const groups = [
			{ offsetMinutes: -660, zones: ['Pacific/Pago_Pago'] },
			{ offsetMinutes: 60, zones: ['Africa/Algiers', 'Africa/Lagos'] },
		];
		expect(citiesIn(groups, index)).toBe(101);
	});

	it('counts zones it has no data for as zero', () => {
		expect(citiesIn([{ offsetMinutes: 0, zones: ['Antarctica/Troll'] }], indexCityCounts({}))).toBe(0);
	});

	it('ignores zones the engine does not know', () => {
		expect(canonicalZone('Mars/Olympus_Mons')).toBeNull();
		expect(indexCityCounts({ 'Mars/Olympus_Mons': 3 }).size).toBe(0);
	});
});

describe('nearestPortal', () => {
	const kathmandu: OffsetGroup = { offsetMinutes: 345, zones: ['Asia/Kathmandu'] };
	const london: OffsetGroup = { offsetMinutes: 0, zones: ['Europe/London'] };
	const tokyo: OffsetGroup = { offsetMinutes: 540, zones: ['Asia/Tokyo'] };

	it('says how long ago it passed, to the millisecond', () => {
		// 11:11:11.111 in London, plus 2.345s.
		const nearest = nearestPortal(utc('2026-10-26T11:11:13.456'), [london, kathmandu]);
		expect(nearest.groups).toEqual([london]);
		expect(nearest.offByMs).toBe(2345);
	});

	it('is negative when the nearest one is still coming', () => {
		// 05:26:11.111 UTC is 11:11:11.111 in Kathmandu.
		const nearest = nearestPortal(utc('2026-10-26T05:26:10.000'), [london, kathmandu]);
		expect(nearest.groups).toEqual([kathmandu]);
		expect(nearest.offByMs).toBe(-1111);
	});

	it('counts 23:11:11.111 too, and wraps past midnight', () => {
		// 23:11:11.111 in London, 0.5s late, on a different UTC day from the morning one.
		expect(nearestPortal(utc('2026-10-26T23:11:11.611'), [london]).offByMs).toBe(500);
		// 00:00 UTC: the nearest London portal is 23:11:11.111 the evening before.
		expect(nearestPortal(utc('2026-10-27T00:00:00.000'), [london]).offByMs).toBe(48 * MIN + 48_889);
	});

	it('merges groups whose portal is the same instant', () => {
		const utcMinus11: OffsetGroup = { offsetMinutes: -660, zones: ['Pacific/Niue'] };
		const utcPlus1: OffsetGroup = { offsetMinutes: 60, zones: ['Europe/Paris'] };
		const nearest = nearestPortal(utc('2026-10-26T10:11:12.111'), [utcMinus11, utcPlus1, tokyo]);
		expect(nearest.groups).toEqual([utcMinus11, utcPlus1]);
		expect(nearest.offByMs).toBe(1000);
	});
});
