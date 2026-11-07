import type { Plan } from "@marsrutai/shared";

export function makeTimeFormatter(timeZone: string) {
  const fmt = new Intl.DateTimeFormat("lt-LT", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : fmt.format(d);
  };
}

export function formatDateTime(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("lt-LT", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

const num1 = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const num0 = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 0 });
const eur = new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR" });

export const fmtKm = (km: number) => `${num1.format(km)} km`;
export const fmtHours = (h: number) => `${num1.format(h)} val.`;
export const fmtKg = (kg: number) => num0.format(kg);
export const fmtEur = (v: number) => eur.format(v);

/** Valandos iš minučių. */
export const minToHours = (m: number) => m / 60;

export type PlanIndex = ReturnType<typeof indexPlan>;

/** Greitos paieškos žemėlapiai pagal id. */
export function indexPlan(plan: Plan) {
  const packages = new Map(plan.dataset.packages.map((p) => [p.id, p]));
  const couriers = new Map(plan.dataset.couriers.map((c, i) => [c.id, { courier: c, index: i }]));
  const routes = new Map(plan.routes.map((r) => [r.courierId, r]));
  return { packages, couriers, routes };
}
