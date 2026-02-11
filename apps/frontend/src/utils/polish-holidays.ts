/**
 * Polish public holidays utility (frontend)
 * Calculates both fixed and movable (Easter-dependent) holidays for a given year.
 */

export interface Holiday {
  date: Date;
  name: string;
}

/**
 * Calculate Easter Sunday date using the Anonymous Gregorian algorithm.
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

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getPolishHolidays(year: number): Holiday[] {
  const easter = getEasterDate(year);

  return [
    { date: new Date(year, 0, 1), name: 'Nowy Rok' },
    { date: new Date(year, 0, 6), name: 'Trzech Króli' },
    { date: new Date(year, 4, 1), name: 'Święto Pracy' },
    { date: new Date(year, 4, 3), name: 'Święto Konstytucji 3 Maja' },
    { date: new Date(year, 7, 15), name: 'Wniebowzięcie Najświętszej Maryi Panny' },
    { date: new Date(year, 10, 1), name: 'Wszystkich Świętych' },
    { date: new Date(year, 10, 11), name: 'Narodowe Święto Niepodległości' },
    { date: new Date(year, 11, 25), name: 'Boże Narodzenie (pierwszy dzień)' },
    { date: new Date(year, 11, 26), name: 'Boże Narodzenie (drugi dzień)' },
    { date: easter, name: 'Wielkanoc (pierwszy dzień)' },
    { date: addDays(easter, 1), name: 'Poniedziałek Wielkanocny' },
    { date: addDays(easter, 49), name: 'Zielone Świątki' },
    { date: addDays(easter, 60), name: 'Boże Ciało' },
  ];
}

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
