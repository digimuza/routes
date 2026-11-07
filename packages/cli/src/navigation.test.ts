import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { courierNavLinks, MAX_WAYPOINTS_PER_LINK, PlanSchema, type Plan } from "@marsrutai/shared";

const sample = PlanSchema.parse(
  JSON.parse(readFileSync(new URL("../../shared/fixtures/sample-plan.json", import.meta.url), "utf8")),
);

/** Planas su vienu kurjeriu ir `n` stotelių. */
function planWith(n: number): Plan {
  const p = structuredClone(sample);
  const c = p.dataset.couriers[0]!;
  p.dataset.packages = Array.from({ length: n }, (_, i) => ({
    ...sample.dataset.packages[0]!,
    id: `P${i + 1}`,
    location: { lat: 54.6 + i * 0.001, lng: 25.2 + i * 0.001 },
  }));
  p.routes = [{ ...sample.routes[0]!, courierId: c.id, stops: p.dataset.packages.map((pk, i) => ({ ...sample.routes[0]!.stops[0]!, seq: i + 1, packageId: pk.id })) }];
  return p;
}

const wp = (url: string) => new URL(url).searchParams.get("waypoints")?.split("|") ?? [];

test("Google Maps: trumpas maršrutas – viena nuoroda sandėlis → stotelės → sandėlis", () => {
  const p = planWith(6);
  const [l, ...rest] = courierNavLinks(p, p.dataset.couriers[0]!.id);
  assert.equal(rest.length, 0);
  const u = new URL(l!.url);
  assert.equal(u.origin + u.pathname, "https://www.google.com/maps/dir/");
  assert.equal(u.searchParams.get("api"), "1");
  assert.equal(u.searchParams.get("travelmode"), "driving");
  const depot = p.dataset.depot.location;
  assert.equal(u.searchParams.get("origin"), `${depot.lat.toFixed(6)},${depot.lng.toFixed(6)}`);
  assert.equal(u.searchParams.get("destination"), u.searchParams.get("origin"));
  assert.equal(wp(l!.url).length, 6);
  assert.equal(l!.label, "Stotelės 1–6 ir grįžimas");
});

test("Google Maps: ilgas maršrutas skaidomas, dalys jungiasi, ≤ 9 tarpiniai taškai", () => {
  const p = planWith(25);
  const links = courierNavLinks(p, p.dataset.couriers[0]!.id);
  assert.deepEqual(links.map((l) => [l.fromSeq, l.toSeq]), [[1, 10], [11, 20], [21, 25]]);
  for (const l of links) assert.ok(wp(l.url).length <= MAX_WAYPOINTS_PER_LINK);
  // Antra dalis prasideda ten, kur baigėsi pirma.
  assert.equal(new URL(links[1]!.url).searchParams.get("origin"), new URL(links[0]!.url).searchParams.get("destination"));
  assert.ok(links[2]!.returnsToDepot);
});

test("Google Maps: lygiai 10 stotelių – be atskiros vien grįžimo nuorodos", () => {
  const p = planWith(10);
  const links = courierNavLinks(p, p.dataset.couriers[0]!.id);
  assert.equal(links.length, 1);
  assert.equal(links[0]!.parts, 1);
  assert.equal(links[0]!.label, "Stotelės 1–10");
});

test("Google Maps: kurjeris be stotelių – nuorodų nėra", () => {
  const p = planWith(0);
  assert.deepEqual(courierNavLinks(p, p.dataset.couriers[0]!.id), []);
});
