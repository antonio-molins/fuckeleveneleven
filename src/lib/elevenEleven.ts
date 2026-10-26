// Finds the next place on Earth whose local clock reads 11:11 (am or pm).

export interface OffsetGroup {
	offsetMinutes: number;
	zones: string[];
}

export interface NextElevenEleven {
	/** Every offset group hitting 11:11 at that instant (UTC-11 at 11:11 am is UTC+1 at 11:11 pm). */
	groups: OffsetGroup[];
	/** UTC ms when the 11:11 minute starts (in the past while isNow). */
	targetUtcMs: number;
	/** UTC ms of the 11:11 that came before it anywhere, for progress bars. */
	previousUtcMs: number;
	isNow: boolean;
}

const MINUTE_MS = 60_000;
const HALF_DAY_MS = 12 * 60 * MINUTE_MS;
// 11:11 and 23:11 are the same instant modulo 12h, so one target covers both.
const TARGET_MS = (11 * 60 + 11) * MINUTE_MS;

// Used when Intl.supportedValuesOf is missing (Safari < 15.4).
const FALLBACK_ZONES = [
	'Pacific/Pago_Pago', 'Pacific/Honolulu', 'Pacific/Marquesas', 'America/Anchorage',
	'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
	'America/Caracas', 'America/Halifax', 'America/St_Johns', 'America/Sao_Paulo',
	'Atlantic/South_Georgia', 'Atlantic/Azores', 'Europe/London', 'Europe/Paris',
	'Africa/Cairo', 'Europe/Moscow', 'Asia/Tehran', 'Asia/Dubai', 'Asia/Kabul',
	'Asia/Karachi', 'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Yangon',
	'Asia/Bangkok', 'Asia/Shanghai', 'Australia/Eucla', 'Asia/Tokyo', 'Australia/Darwin',
	'Australia/Adelaide', 'Australia/Sydney', 'Australia/Lord_Howe', 'Pacific/Noumea',
	'Pacific/Norfolk', 'Pacific/Auckland', 'Pacific/Chatham', 'Pacific/Tongatapu',
	'Pacific/Kiritimati',
];

// Places people have heard of, preferred as the headline city of an offset group.
const FAMOUS_ZONES = [
	'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'America/Los_Angeles',
	'America/Sao_Paulo', 'Asia/Kolkata', 'Asia/Calcutta', 'Asia/Kathmandu', 'Asia/Katmandu',
	'Australia/Sydney', 'Asia/Shanghai', 'Asia/Dubai', 'America/Argentina/Buenos_Aires',
	'America/Buenos_Aires', 'America/Mexico_City', 'Africa/Lagos', 'Europe/Berlin',
	'Asia/Singapore', 'Pacific/Auckland', 'Pacific/Chatham', 'Australia/Adelaide',
	'Asia/Tehran', 'America/St_Johns', 'Pacific/Honolulu', 'Asia/Jakarta', 'Africa/Cairo',
	'Europe/Moscow', 'Asia/Karachi', 'Asia/Dhaka', 'Australia/Darwin', 'Australia/Eucla',
	'Pacific/Marquesas', 'America/Anchorage', 'America/Chicago', 'America/Denver',
	'Asia/Kabul', 'Asia/Yangon', 'Asia/Rangoon', 'Asia/Bangkok', 'America/Caracas',
	'Atlantic/Azores', 'Pacific/Kiritimati', 'Africa/Nairobi', 'Australia/Lord_Howe',
];

// ICU still ships some legacy names; show the ones people actually use.
const CITY_ALIASES: Record<string, string> = {
	Calcutta: 'Kolkata',
	Katmandu: 'Kathmandu',
	Saigon: 'Ho Chi Minh City',
	Kiev: 'Kyiv',
	Rangoon: 'Yangon',
	Godthab: 'Nuuk',
	'St Johns': 'St. John’s',
};

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** "GMT+05:45" -> 345, "GMT-03:00" -> -180, "GMT" -> 0 */
export function parseOffset(longOffset: string): number {
	const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(longOffset.replace('UTC', 'GMT'));
	if (!match) throw new Error(`Unrecognised offset: ${longOffset}`);
	const [, sign, hours = '0', minutes = '0'] = match;
	const total = Number(hours) * 60 + Number(minutes);
	return sign === '-' ? -total : total;
}

export function offsetOf(zone: string, date: Date): number {
	const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
		.formatToParts(date)
		.find((p) => p.type === 'timeZoneName');
	return parseOffset(part?.value ?? 'GMT');
}

export function listZones(): string[] {
	const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : FALLBACK_ZONES;
	// Etc/GMT+5 and friends are not places, and you can't manifest in them.
	return zones.filter((z) => z.includes('/') && !z.startsWith('Etc/'));
}

/** Groups zones by their UTC offset at `date` (so DST is respected). */
export function getOffsets(date: Date, zones: string[] = listZones()): OffsetGroup[] {
	const byOffset = new Map<number, string[]>();
	for (const zone of zones) {
		const offset = offsetOf(zone, date);
		byOffset.set(offset, [...(byOffset.get(offset) ?? []), zone]);
	}
	return [...byOffset].map(([offsetMinutes, zs]) => ({ offsetMinutes, zones: zs.sort() }));
}

export function nextElevenEleven(nowMs: number, groups: OffsetGroup[]): NextElevenEleven {
	if (groups.length === 0) throw new Error('No time zones. Earth has been cancelled.');

	const starts = groups.map((group) => {
		const sinceStart = mod(nowMs + group.offsetMinutes * MINUTE_MS - TARGET_MS, HALF_DAY_MS);
		const start = sinceStart < MINUTE_MS ? nowMs - sinceStart : nowMs + HALF_DAY_MS - sinceStart;
		return { group, start };
	});

	const targetUtcMs = Math.min(...starts.map((s) => s.start));
	const previousUtcMs = Math.max(...starts.map((s) => (s.start < targetUtcMs ? s.start : s.start - HALF_DAY_MS)));

	return {
		groups: starts.filter((s) => s.start === targetUtcMs).map((s) => s.group),
		targetUtcMs,
		previousUtcMs,
		isNow: targetUtcMs <= nowMs,
	};
}

/** 11:11:11.111 local (and 23:11:11.111, the same instant modulo 12h): the portal's one open instant. */
const PORTAL_MS = TARGET_MS + 11_111;

export interface NearestPortal {
	/** Every offset group whose portal instant is the nearest one. */
	groups: OffsetGroup[];
	/** How far now is from it: positive if it already passed (missed it), negative if it's still coming. */
	offByMs: number;
}

/** The portal instant anywhere on Earth closest to now, in either direction. */
export function nearestPortal(nowMs: number, groups: OffsetGroup[]): NearestPortal {
	if (groups.length === 0) throw new Error('No time zones. Earth has been cancelled.');

	const candidates = groups.map((group) => {
		const since = mod(nowMs + group.offsetMinutes * MINUTE_MS - PORTAL_MS, HALF_DAY_MS);
		return { group, offByMs: since <= HALF_DAY_MS / 2 ? since : since - HALF_DAY_MS };
	});
	const offByMs = candidates.reduce((best, c) => (Math.abs(c.offByMs) < Math.abs(best) ? c.offByMs : best), Infinity);
	return { groups: candidates.filter((c) => c.offByMs === offByMs).map((c) => c.group), offByMs };
}

export function prettyZone(zone: string): string {
	const city = zone.split('/').pop()!.replaceAll('_', ' ');
	return CITY_ALIASES[city] ?? city;
}

/** The zone to put in the headline: the most famous one, else the first alphabetically. */
export function headlineZone(groups: OffsetGroup[]): string {
	const zones = groups.flatMap((g) => g.zones);
	return FAMOUS_ZONES.find((z) => zones.includes(z)) ?? zones[0];
}

/** "am" or "pm" for a zone's 11:11 at the given instant. */
export function meridiem(targetUtcMs: number, offsetMinutes: number): 'am' | 'pm' {
	return mod(targetUtcMs + offsetMinutes * MINUTE_MS, 2 * HALF_DAY_MS) < HALF_DAY_MS ? 'am' : 'pm';
}

/** The engine's own id for a zone (e.g. Chrome still says Asia/Calcutta for Asia/Kolkata), or null if unknown. */
export function canonicalZone(zone: string): string | null {
	try {
		return new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone;
	} catch {
		return null;
	}
}

/** Re-keys GeoNames per-zone city counts by this engine's zone ids, so they match getOffsets(). */
export function indexCityCounts(counts: Record<string, number>): Map<string, number> {
	const index = new Map<string, number>();
	for (const [zone, count] of Object.entries(counts)) {
		const id = canonicalZone(zone);
		if (id) index.set(id, (index.get(id) ?? 0) + count);
	}
	return index;
}

/** Cities of 15,000+ people across every zone hitting 11:11 together. */
export function citiesIn(groups: OffsetGroup[], index: Map<string, number>): number {
	return groups.flatMap((g) => g.zones).reduce((sum, zone) => sum + (index.get(canonicalZone(zone) ?? zone) ?? 0), 0);
}
