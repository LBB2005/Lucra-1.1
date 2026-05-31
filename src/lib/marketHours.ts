// US equity market session status, evaluated in America/New_York regardless of
// the viewer's local timezone. Regular session only (09:30–16:00 ET, Mon–Fri).
//
// Note: this does not account for exchange holidays — it answers "is the regular
// session clock open right now", which is enough to stop the UI claiming the
// market is "Open" on a weekend.

export interface MarketStatus {
  open: boolean;
  label: "Open" | "Closed";
}

export function usMarketStatus(now: Date = new Date()): MarketStatus {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday"); // "Mon", "Tue", … "Sat", "Sun"
  const hour = parseInt(get("hour"), 10) % 24; // Intl can emit "24" at midnight
  const minute = parseInt(get("minute"), 10);

  const isWeekday = weekday !== "Sat" && weekday !== "Sun";
  const minutesIntoDay = hour * 60 + minute;
  const open = isWeekday && minutesIntoDay >= 9 * 60 + 30 && minutesIntoDay < 16 * 60;

  return { open, label: open ? "Open" : "Closed" };
}
