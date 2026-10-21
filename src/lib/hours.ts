export type Day =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface HoursEntry {
  day: Day;
  closed: boolean;
  open?: string | null;
  close?: string | null;
}

const WEEK: Day[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/** schema.org day names, keyed by our stored value. */
const SCHEMA_DAY: Record<Day, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

/** Monday-first, regardless of the order the rows sit in the file. */
export function sortHours<T extends { day: Day }>(hours: readonly T[]): T[] {
  return [...hours].sort((a, b) => WEEK.indexOf(a.day) - WEEK.indexOf(b.day));
}

export function formatDay(day: Day): string {
  return SCHEMA_DAY[day];
}

/** "10:30" -> "10:30 am", "20:00" -> "8 pm", "12:00" -> "12 pm". */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "10:30 am – 8 pm", or "Closed". */
export function formatHours(entry: HoursEntry): string {
  if (entry.closed || !entry.open || !entry.close) return "Closed";
  return `${formatTime(entry.open)} – ${formatTime(entry.close)}`;
}

const SHORT: Record<Day, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export interface HoursSummary {
  days: string;
  time: string;
}

/**
 * Compact form for the header strip and footer: consecutive days with identical times
 * collapse into one row, and closed days gather into a single trailing row.
 *
 *   [{ days: "Tue–Sat", time: "10:30 am – 8 pm" }, { days: "Mon & Sun", time: "Closed" }]
 */
export function summarizeHours(hours: readonly HoursEntry[]): HoursSummary[] {
  const sorted = sortHours(hours);
  const rows: HoursSummary[] = [];
  const closed: Day[] = [];
  let run: HoursEntry[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const first = SHORT[run[0].day];
    const last = SHORT[run[run.length - 1].day];
    rows.push({
      days: run.length === 1 ? first : `${first}–${last}`,
      time: formatHours(run[0]),
    });
    run = [];
  };

  for (const entry of sorted) {
    if (entry.closed || !entry.open || !entry.close) {
      flush();
      closed.push(entry.day);
      continue;
    }
    const prev = run[run.length - 1];
    if (prev && (prev.open !== entry.open || prev.close !== entry.close)) flush();
    run.push(entry);
  }
  flush();

  if (closed.length > 0) {
    rows.push({ days: closed.map((d) => SHORT[d]).join(" & "), time: "Closed" });
  }
  return rows;
}

/**
 * schema.org openingHoursSpecification. Closed days are omitted rather than emitted
 * with opens/closes of 00:00, which Google reads as open around the clock.
 */
export function toOpeningHoursSpecification(hours: readonly HoursEntry[]) {
  return sortHours(hours)
    .filter((entry) => !entry.closed && entry.open && entry.close)
    .map((entry) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${SCHEMA_DAY[entry.day]}`,
      opens: entry.open,
      closes: entry.close,
    }));
}
