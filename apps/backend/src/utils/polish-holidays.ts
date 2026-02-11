/**
 * Polish public holidays utility
 * Calculates both fixed and movable (Easter-dependent) holidays for a given year.
 */

export interface Holiday {
  date: Date;
  name: string;
}

/**
 * Calculate Easter Sunday date using the Anonymous Gregorian algorithm.
 * Valid for the Gregorian calendar (1583+).
 */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

/**
 * Add days to a date (returns new Date).
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get all Polish public holidays for a given year.
 * Includes both fixed holidays and movable Easter-dependent holidays.
 */
export function getPolishHolidays(year: number): Holiday[] {
  const easter = getEasterDate(year);

  return [
    // Fixed holidays
    { date: new Date(year, 0, 1), name: 'Nowy Rok' },
    { date: new Date(year, 0, 6), name: 'Trzech Króli' },
    { date: new Date(year, 4, 1), name: 'Święto Pracy' },
    { date: new Date(year, 4, 3), name: 'Święto Konstytucji 3 Maja' },
    { date: new Date(year, 7, 15), name: 'Wniebowzięcie Najświętszej Maryi Panny' },
    { date: new Date(year, 10, 1), name: 'Wszystkich Świętych' },
    { date: new Date(year, 10, 11), name: 'Narodowe Święto Niepodległości' },
    { date: new Date(year, 11, 25), name: 'Boże Narodzenie (pierwszy dzień)' },
    { date: new Date(year, 11, 26), name: 'Boże Narodzenie (drugi dzień)' },

    // Movable holidays (Easter-dependent)
    { date: easter, name: 'Wielkanoc (pierwszy dzień)' },
    { date: addDays(easter, 1), name: 'Poniedziałek Wielkanocny' },
    { date: addDays(easter, 49), name: 'Zielone Świątki' },
    { date: addDays(easter, 60), name: 'Boże Ciało' },
  ];
}

/**
 * Check if a given date is a Polish public holiday.
 * Compares year, month, and day only (ignores time).
 */
export function isPolishHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getPolishHolidays(year);
  return holidays.some(
    (h) =>
      h.date.getFullYear() === date.getFullYear() &&
      h.date.getMonth() === date.getMonth() &&
      h.date.getDate() === date.getDate()
  );
}

/**
 * Get the holiday name for a given date, or null if not a holiday.
 */
export function getHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  const holidays = getPolishHolidays(year);
  const holiday = holidays.find(
    (h) =>
      h.date.getFullYear() === date.getFullYear() &&
      h.date.getMonth() === date.getMonth() &&
      h.date.getDate() === date.getDate()
  );
  return holiday ? holiday.name : null;
}

/**
 * Get holidays in a date range (inclusive).
 */
export function getHolidaysInRange(startDate: Date, endDate: Date): Holiday[] {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const holidays: Holiday[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const yearHolidays = getPolishHolidays(year);
    for (const holiday of yearHolidays) {
      if (holiday.date >= startDate && holiday.date <= endDate) {
        holidays.push(holiday);
      }
    }
  }

  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
}
