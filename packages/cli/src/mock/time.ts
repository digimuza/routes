// Laiko zonų pagalbininkai be papildomų priklausomybių (tik Intl).
// Viduje mock algoritmas skaičiuoja "epoch minutėmis" (ms / 60000), kad
// vasaros/žiemos laiko perėjimai būtų teisingi; į Plan rašomas ISO 8601 su vietos poslinkiu.

const MS_PER_MIN = 60_000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(epochMs: number, timeZone: string): WallClock {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(new Date(epochMs))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
    second: parts.second!,
  };
}

/** Zonos poslinkis nuo UTC minutėmis duotu momentu (Vilnius lapkritį: +120). */
export function tzOffsetMinutes(epochMs: number, timeZone: string): number {
  const w = wallClock(epochMs, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const truncated = Math.floor(epochMs / 1000) * 1000;
  return Math.round((asUtc - truncated) / MS_PER_MIN);
}

/** "2026-11-10" + "09:30" vietos laiku -> epoch ms. */
export function zonedTimeToEpochMs(date: string, hhmm: string, timeZone: string): number {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = hhmm.split(":").map(Number) as [number, number];
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Dvi iteracijos pakanka ir prie DST ribos.
  let epoch = naiveUtc - tzOffsetMinutes(naiveUtc, timeZone) * MS_PER_MIN;
  epoch = naiveUtc - tzOffsetMinutes(epoch, timeZone) * MS_PER_MIN;
  return epoch;
}

/** "2026-11-10" + "09:30" vietos laiku -> epoch minutės. */
export function zonedTimeToEpochMin(date: string, hhmm: string, timeZone: string): number {
  return zonedTimeToEpochMs(date, hhmm, timeZone) / MS_PER_MIN;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** epoch ms -> "2026-11-10T09:30:00+02:00" (vietos laikas su poslinkiu). */
export function toZonedIso(epochMs: number, timeZone: string): string {
  const w = wallClock(epochMs, timeZone);
  const off = tzOffsetMinutes(epochMs, timeZone);
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  return (
    `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** epoch minutės -> ISO su poslinkiu. */
export function epochMinToZonedIso(epochMin: number, timeZone: string): string {
  return toZonedIso(Math.round(epochMin * MS_PER_MIN), timeZone);
}
