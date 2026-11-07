// Suvestinė (SPEC 6): out/summary.md ir konsolės lentelė.
import type { Plan } from "@marsrutai/shared";

export interface CourierRow {
  courierId: string;
  name: string;
  stops: number;
  km: number;
  hours: number;
  loadKg: number;
  capacityKg: number;
  late: number;
  start: string;
  end: string;
}

const hhmm = (iso: string) => iso.slice(11, 16);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function courierRows(plan: Plan): CourierRow[] {
  const couriers = new Map(plan.dataset.couriers.map((c) => [c.id, c]));
  return plan.routes.map((r) => {
    const c = couriers.get(r.courierId);
    return {
      courierId: r.courierId,
      name: c?.name ?? r.courierId,
      stops: r.stops.length,
      km: r.totalKm,
      hours: round1(r.totalMinutes / 60),
      loadKg: r.totalWeightKg,
      capacityKg: c?.capacityKg ?? 0,
      late: r.stops.filter((s) => s.lateMinutes > 0).length,
      start: r.stops.length ? hhmm(r.start) : "–",
      end: r.stops.length ? hhmm(r.end) : "–",
    };
  });
}

export function summaryMarkdown(plan: Plan): string {
  const { depot, packages } = plan.dataset;
  const m = plan.metrics;
  const pkgById = new Map(packages.map((p) => [p.id, p]));
  const mode = plan.mode === "api" ? "Google Route Optimization API" : "MOCK (lokalus algoritmas)";
  const lines: string[] = [
    `# Maršrutų suvestinė – ${depot.date}`,
    "",
    `- Sandėlis: ${depot.name}, ${depot.address}`,
    `- Režimas: ${mode}`,
    `- Sugeneruota: ${plan.generatedAt}`,
    "",
    "## Kurjeriai",
    "",
    "| Kurjeris | Vardas | Paketai | km | Val. | Pakrauta kg / talpa | Vėluoja | Išvyksta | Grįžta |",
    "|---|---|---:|---:|---:|---:|---:|---|---|",
    ...courierRows(plan).map(
      (r) =>
        `| ${r.courierId} | ${r.name} | ${r.stops} | ${r.km} | ${r.hours} | ${r.loadKg} / ${r.capacityKg} | ${r.late} | ${r.start} | ${r.end} |`,
    ),
    "",
    "## Nepristatyti paketai",
    "",
  ];
  if (plan.skipped.length === 0) lines.push("Visi paketai pristatyti.");
  else {
    lines.push("| Paketas | Prioritetas | Gavėjas | Priežastis |", "|---|---:|---|---|");
    for (const s of plan.skipped) {
      const p = pkgById.get(s.packageId);
      lines.push(`| ${s.packageId} | ${p?.priority ?? "?"} | ${p?.recipient ?? ""} | ${s.reason} |`);
    }
  }
  lines.push(
    "",
    "## Iš viso",
    "",
    `- Paketų: ${packages.length}, pristatyta: ${m.deliveredCount}, nepristatyta: ${m.skippedCount}, vėluoja: ${m.lateCount}`,
    `- Atstumas: ${m.totalKm} km, darbo laikas: ${m.totalHours} h` +
      (m.totalCost !== undefined ? `, kaina: ${m.totalCost}` : ""),
    "",
  );
  return lines.join("\n");
}
