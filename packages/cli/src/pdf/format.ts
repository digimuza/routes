// Formatavimo pagalbininkai PDF'ui: laikai Vilniaus zonoje, skaičiai, failų vardai.

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function timeFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = timeFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("lt-LT", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    timeFormatters.set(timeZone, f);
  }
  return f;
}

function dateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = dateTimeFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    dateTimeFormatters.set(timeZone, f);
  }
  return f;
}

function parseIso(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO 8601 (su poslinkiu) → "HH:MM" nurodytoje zonoje. */
export function formatTime(iso: string, timeZone: string): string {
  const d = parseIso(iso);
  if (!d) return "—";
  const parts = timeFormatter(timeZone).formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

/** ISO 8601 → "YYYY-MM-DD HH:MM" nurodytoje zonoje. */
export function formatDateTime(iso: string, timeZone: string): string {
  const d = parseIso(iso);
  if (!d) return iso;
  const p = Object.fromEntries(dateTimeFormatter(timeZone).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** Skaičius lietuviškai: kablelis kaip dešimtainis skirtukas. */
export function formatNumber(n: number, maxFractionDigits = 1): string {
  return new Intl.NumberFormat("lt-LT", { maximumFractionDigits: maxFractionDigits }).format(n);
}

/** Minutės → "2 val. 35 min". */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} val.`;
  return `${h} val. ${m} min`;
}

/** "Rūta Žemaitė" → "ruta-zemaite" (diakritikai transliteruojami). */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Failo vardas: courier-01-jonas-petraitis.pdf (indeksas pagal kurjerių tvarką, nuo 1). */
export function courierPdfFileName(index: number, name: string): string {
  const slug = slugify(name) || "kurjeris";
  return `courier-${String(index + 1).padStart(2, "0")}-${slug}.pdf`;
}
