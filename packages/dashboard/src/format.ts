import type { Plan } from "@marsrutai/shared";

export function makeTimeFormatter(timeZone: string) {
  const fmt = new Intl.DateTimeFormat("lt-LT", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  return (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : fmt.format(d);
  };
}

/** Minutės nuo vidurnakčio vietos laiku (laiko juostai). */
export function makeMinuteOfDay(timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  return (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return NaN;
    const [h, m] = fmt.format(d).split(":").map(Number);
    return h * 60 + m;
  };
}

export function formatDateTime(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("lt-LT", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

const num1 = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const num0 = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 0 });
const eur = new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const fmtNum = (n: number) => num0.format(n);
export const fmtKm = (km: number) => `${num1.format(km)} km`;
export const fmtHours = (h: number) => `${num1.format(h)} val.`;
export const fmtKg = (kg: number) => num0.format(kg);
export const fmtEur = (v: number) => eur.format(v);
export const minToHours = (m: number) => m / 60;
export const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;
export const toMinutes = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

export type PlanIndex = ReturnType<typeof indexPlan>;

export function indexPlan(plan: Plan) {
  const packages = new Map(plan.dataset.packages.map((p) => [p.id, p]));
  const couriers = new Map(plan.dataset.couriers.map((c, i) => [c.id, { courier: c, index: i }]));
  const routes = new Map(plan.routes.map((r) => [r.courierId, r]));
  const stopOf = new Map<string, { courierId: string; seq: number }>();
  for (const r of plan.routes) for (const s of r.stops) stopOf.set(s.packageId, { courierId: r.courierId, seq: s.seq });
  return { packages, couriers, routes, stopOf };
}
