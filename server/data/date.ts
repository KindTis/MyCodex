const pad2 = (value: number): string => String(value).padStart(2, "0");

export function getLocalDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function isValidLocalDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function getRecentLocalDateKeys(now = new Date(), days = 7): string[] {
  const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() - (days - 1 - index));
    return getLocalDateKey(date);
  });
}

export function getLocalDateKeysForWeekOffset(now = new Date(), weekOffset = 0, days = 7): string[] {
  const safeOffset = Number.isInteger(weekOffset) && weekOffset > 0 ? weekOffset : 0;
  const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  anchor.setDate(anchor.getDate() - safeOffset * days);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() - (days - 1 - index));
    return getLocalDateKey(date);
  });
}

export function epochSecondsToIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return null;
  }

  return new Date(seconds * 1000).toISOString();
}
