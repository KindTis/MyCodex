const pad2 = (value: number): string => String(value).padStart(2, "0");

export function getLocalDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getRecentLocalDateKeys(now = new Date(), days = 7): string[] {
  const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
