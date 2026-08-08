export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

const COUNTRY_CODE_TZ: Record<string, string> = {
  '62': 'Asia/Jakarta',        // Indonesia
  '60': 'Asia/Kuala_Lumpur',   // Malaysia
  '65': 'Asia/Singapore',      // Singapore
  '91': 'Asia/Kolkata',        // India
  '63': 'Asia/Manila',         // Philippines
  '66': 'Asia/Bangkok',        // Thailand
  '84': 'Asia/Ho_Chi_Minh',    // Vietnam
  '855': 'Asia/Phnom_Penh',    // Cambodia
  '856': 'Asia/Vientiane',     // Laos
  '95': 'Asia/Yangon',         // Myanmar
  '86': 'Asia/Shanghai',       // China
  '81': 'Asia/Tokyo',          // Japan
  '82': 'Asia/Seoul',          // South Korea
  '886': 'Asia/Taipei',        // Taiwan
  '852': 'Asia/Hong_Kong',     // Hong Kong
  '853': 'Asia/Macau',         // Macau
  '880': 'Asia/Dhaka',         // Bangladesh
  '92': 'Asia/Karachi',        // Pakistan
  '94': 'Asia/Colombo',        // Sri Lanka
  '977': 'Asia/Kathmandu',     // Nepal
  '975': 'Asia/Thimphu',       // Bhutan
  '960': 'Indian/Maldives',    // Maldives
  '61': 'Australia/Sydney',    // Australia
  '64': 'Pacific/Auckland',    // New Zealand
  '971': 'Asia/Dubai',         // UAE
  '966': 'Asia/Riyadh',        // Saudi Arabia
  '972': 'Asia/Jerusalem',     // Israel
  '974': 'Asia/Qatar',         // Qatar
  '965': 'Asia/Kuwait',        // Kuwait
  '968': 'Asia/Muscat',        // Oman
  '973': 'Asia/Bahrain',       // Bahrain
  '962': 'Asia/Amman',         // Jordan
  '963': 'Asia/Damascus',      // Syria
  '964': 'Asia/Baghdad',       // Iraq
  '98': 'Asia/Tehran',         // Iran
  '90': 'Europe/Istanbul',     // Turkey
  '7': 'Europe/Moscow',        // Russia
  '380': 'Europe/Kyiv',        // Ukraine
  '48': 'Europe/Warsaw',       // Poland
  '49': 'Europe/Berlin',       // Germany
  '44': 'Europe/London',       // UK
  '33': 'Europe/Paris',        // France
  '34': 'Europe/Madrid',       // Spain
  '39': 'Europe/Rome',         // Italy
  '31': 'Europe/Amsterdam',    // Netherlands
  '32': 'Europe/Brussels',     // Belgium
  '41': 'Europe/Zurich',       // Switzerland
  '43': 'Europe/Vienna',       // Austria
  '45': 'Europe/Copenhagen',   // Denmark
  '46': 'Europe/Stockholm',    // Sweden
  '47': 'Europe/Oslo',         // Norway
  '358': 'Europe/Helsinki',    // Finland
  '351': 'Europe/Lisbon',      // Portugal
  '353': 'Europe/Dublin',      // Ireland
  '30': 'Europe/Athens',       // Greece
  '1': 'America/New_York',     // US/Canada (default)
  '52': 'America/Mexico_City', // Mexico
  '55': 'America/Sao_Paulo',   // Brazil
  '54': 'America/Argentina/Buenos_Aires', // Argentina
  '56': 'America/Santiago',    // Chile
  '57': 'America/Bogota',      // Colombia
  '51': 'America/Lima',        // Peru
  '58': 'America/Caracas',     // Venezuela
  '27': 'Africa/Johannesburg', // South Africa
  '20': 'Africa/Cairo',        // Egypt
  '234': 'Africa/Lagos',       // Nigeria
  '212': 'Africa/Casablanca',  // Morocco
};

const SORTED_COUNTRY_CODES = Object.keys(COUNTRY_CODE_TZ).sort((a, b) => b.length - a.length) as (keyof typeof COUNTRY_CODE_TZ)[];

export function inferTimezoneFromPhone(jid: string): string {
  const digits = jid.replace(/\D/g, '');
  if (!digits) return DEFAULT_TIMEZONE;
  for (const code of SORTED_COUNTRY_CODES) {
    if (digits.startsWith(code)) return COUNTRY_CODE_TZ[code]!;
  }
  return DEFAULT_TIMEZONE;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface TzParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

function getTzParts(date: Date, tz: string): TzParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);

  const values: Record<string, string> = {};
  for (const part of parts) {
    values[part.type] = part.value;
  }

  return {
    year: Number(values['year']),
    month: Number(values['month']),
    day: Number(values['day']),
    hour: Number(values['hour']),
    minute: Number(values['minute']),
    second: Number(values['second']),
    weekday: new Date(Date.UTC(Number(values['year']), Number(values['month']) - 1, Number(values['day']))).getUTCDay(),
  };
}

function offsetMsAt(date: Date, tz: string): number {
  const p = getTzParts(date, tz);
  const wallClock = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallClock - date.getTime();
}

function localDateToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, tz: string): Date {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = offsetMsAt(new Date(wallClock), tz);
  return new Date(wallClock - offset);
}

export function startOfDay(tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): Date {
  const p = getTzParts(now, tz);
  return localDateToUtc(p.year, p.month, p.day, 0, 0, 0, tz);
}

export function startOfWeek(tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): Date {
  const p = getTzParts(now, tz);
  const diff = (p.weekday + 6) % 7;
  return localDateToUtc(p.year, p.month, p.day - diff, 0, 0, 0, tz);
}

export function startOfMonth(tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): Date {
  const p = getTzParts(now, tz);
  return localDateToUtc(p.year, p.month, 1, 0, 0, 0, tz);
}

export function startOfLastMonth(tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): Date {
  const p = getTzParts(now, tz);
  const firstDayCurrentMonth = localDateToUtc(p.year, p.month, 1, 0, 0, 0, tz);
  const pPrev = getTzParts(firstDayCurrentMonth, tz);
  return localDateToUtc(pPrev.year, pPrev.month - 1, 1, 0, 0, 0, tz);
}

export function endOfLastMonth(tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): Date {
  const p = getTzParts(now, tz);
  const firstDayCurrentMonth = localDateToUtc(p.year, p.month, 1, 0, 0, 0, tz);
  return new Date(firstDayCurrentMonth.getTime() - 1);
}

export function startOfYear(tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): Date {
  const p = getTzParts(now, tz);
  return localDateToUtc(p.year, 1, 1, 0, 0, 0, tz);
}

export function parseLocalDate(isoDate: string, tz: string = DEFAULT_TIMEZONE): Date {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(isoDate);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return localDateToUtc(year, month, day, 0, 0, 0, tz);
}

export function formatDateTime(date: Date, tz: string = DEFAULT_TIMEZONE, lang: 'id' | 'en', options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-US', { timeZone: tz, ...options }).format(date);
}

export function formatDateShort(date: Date, tz: string = DEFAULT_TIMEZONE, lang: 'id' | 'en'): string {
  return formatDateTime(date, tz, lang, { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function formatTimeShort(date: Date, tz: string = DEFAULT_TIMEZONE, lang: 'id' | 'en'): string {
  return formatDateTime(date, tz, lang, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateLong(date: Date, tz: string = DEFAULT_TIMEZONE, lang: 'id' | 'en'): string {
  return formatDateTime(date, tz, lang, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function getDateContext(tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  const p = getTzParts(now, tz);
  const weekdayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][p.weekday];
  return `Current date: ${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')} (${weekdayName})`;
}
