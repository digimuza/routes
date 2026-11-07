// Laiko pagalbinės funkcijos be išorinių priklausomybių (Intl).

/** Laiko zonos poslinkis minutėmis (vietinis − UTC) duotu momentu, pvz. +120 Vilniuje lapkritį. */
export function tzOffsetMinutes(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/** Vietinė data ("YYYY-MM-DD") + "HH:MM" laiko zonoje → UTC milisekundės. */
export function localToUtcMs(date: string, hhmm: string, timeZone: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(":").map(Number) as [number, number];
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  // Dviejų žingsnių korekcija teisingai veikia ir šalia DST perėjimų.
  let utc = naive - tzOffsetMinutes(naive, timeZone) * 60_000;
  utc = naive - tzOffsetMinutes(utc, timeZone) * 60_000;
  return utc;
}

/** Vietinė data + "HH:MM" → RFC3339 UTC, pvz. "2026-11-10T06:00:00Z". */
export function localToRfc3339(date: string, hhmm: string, timeZone: string): string {
  return new Date(localToUtcMs(date, hhmm, timeZone)).toISOString().replace(".000Z", "Z");
}

/** UTC momentas → ISO 8601 su vietiniu poslinkiu, pvz. "2026-11-10T09:00:00+02:00". */
export function toLocalIso(utcMs: number, timeZone: string): string {
  const secMs = Math.round(utcMs / 1000) * 1000;
  const off = tzOffsetMinutes(secMs, timeZone);
  const local = new Date(secMs + off * 60_000).toISOString().slice(0, 19);
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  return `${local}${sign}${oh}:${om}`;
}

/** Protobuf JSON trukmė "123.5s" → sekundės. */
export function parseDurationSec(d: string | undefined | null): number {
  if (!d) return 0;
  const m = /^(-?\d+(?:\.\d+)?)s$/.exec(d);
  if (!m) throw new Error(`Netinkamas trukmės formatas: ${d}`);
  return Number(m[1]);
}

/** Sekundės → protobuf JSON trukmė "300s". */
export function durationStr(seconds: number): string {
  return `${Math.round(seconds)}s`;
}
