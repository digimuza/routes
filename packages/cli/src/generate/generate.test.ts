import { test } from "node:test";
import assert from "node:assert/strict";
import { CitySchema, DatasetSchema, type CityId } from "@marsrutai/shared";
import { datasetProblems } from "../load.js";
import {
  CITIES,
  CITY_DEFS,
  DEFAULT_MIX,
  defaultCouriers,
  emptyScenario,
  generatePackages,
  inCityBounds,
  nextPackageIds,
  nextWeekday,
} from "./index.js";

const CITY_IDS: CityId[] = ["vilnius", "kaunas"];
const distM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const k = Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * k);
};

test("CITIES atitinka CitySchema; sandėlis ir centras ribose", () => {
  assert.deepEqual(CITIES.map((c) => c.id), CITY_IDS);
  for (const c of CITIES) {
    CitySchema.parse(c);
    assert.ok(inCityBounds(c.id, c.depot.location), c.id);
    assert.ok(inCityBounds(c.id, c.center), c.id);
  }
  assert.equal(CITIES[0]!.depot.name, "Sandėlis Kirtimai");
});

test("kuruoti adresai: >= 120, unikalūs, miesto ribose", () => {
  for (const id of CITY_IDS) {
    const addrs = CITY_DEFS[id].addresses;
    assert.ok(addrs.length >= 120, `${id}: ${addrs.length}`);
    assert.equal(new Set(addrs.map((a) => a[0])).size, addrs.length, `${id}: pasikartojantys adresai`);
    for (const [street, lat, lng] of addrs) assert.ok(inCityBounds(id, { lat, lng }), `${id}: ${street}`);
  }
});

for (const city of CITY_IDS) {
  test(`${city}: paketai ribose, <= 40 m nuo kuruoto adreso, validūs`, () => {
    const pkgs = generatePackages({ city, count: 300, mix: DEFAULT_MIX, seed: 3 });
    assert.equal(pkgs.length, 300); // daugiau nei adresų – adresai kartojami
    const addrs = CITY_DEFS[city].addresses;
    const name = CITY_DEFS[city].city.name;
    for (const p of pkgs) {
      assert.ok(inCityBounds(city, p.location), `${p.id} ${p.address}`);
      assert.ok(p.address.endsWith(`, ${name}`), p.address);
      const street = p.address.slice(0, -`, ${name}`.length).replace(/-\d+$/, "");
      const a = addrs.find((x) => x[0] === street);
      assert.ok(a, `nežinomas adresas ${p.address}`);
      assert.ok(distM(p.location, { lat: a[1], lng: a[2] }) <= 40.5, `${p.id} per toli nuo ${street}`);
    }
    const ds = DatasetSchema.parse({ ...emptyScenario(city), packages: pkgs });
    assert.deepEqual(datasetProblems(ds), []);
  });
}

test("tas pats seed → tie patys paketai; kitas seed → kiti", () => {
  const req = { city: "kaunas" as const, count: 30, mix: DEFAULT_MIX, seed: 99 };
  assert.deepEqual(generatePackages(req), generatePackages(req));
  assert.notDeepEqual(generatePackages(req), generatePackages({ ...req, seed: 100 }));
  // be seed – atsitiktinis
  const a = generatePackages({ ...req, seed: undefined });
  const b = generatePackages({ ...req, seed: undefined });
  assert.notDeepEqual(a, b);
});

test("ID nesikerta su esamais", () => {
  assert.deepEqual(nextPackageIds(3, ["PKG-001", "PKG-003", "X"]), ["PKG-002", "PKG-004", "PKG-005"]);
  const existingIds = Array.from({ length: 40 }, (_, i) => `PKG-${String(i + 1).padStart(3, "0")}`);
  const pkgs = generatePackages({ city: "vilnius", count: 20, mix: DEFAULT_MIX, seed: 1, existingIds });
  assert.equal(pkgs[0]!.id, "PKG-041");
  assert.equal(new Set([...existingIds, ...pkgs.map((p) => p.id)]).size, 60);
});

test("prioritetų pasiskirstymas atitinka užklausą", () => {
  const count = 300;
  const share = (mix: { p1: number; p2: number; p3: number }) => {
    const pkgs = generatePackages({ city: "vilnius", count, mix, seed: 7 });
    return [1, 2, 3].map((p) => pkgs.filter((x) => x.priority === p).length / count);
  };
  const s = share({ p1: 20, p2: 45, p3: 35 });
  [0.2, 0.45, 0.35].forEach((want, i) => assert.ok(Math.abs(s[i]! - want) < 0.08, `p${i + 1}: ${s[i]}`));
  assert.deepEqual(share({ p1: 100, p2: 0, p3: 0 }), [1, 0, 0]);
  const t = share({ p1: 0, p2: 50, p3: 50 });
  assert.equal(t[0], 0);
  assert.ok(Math.abs(t[1]! - 0.5) < 0.08);
  assert.throws(() => share({ p1: 0, p2: 0, p3: 0 }), /suma/);
});

test("defaultCouriers ir emptyScenario", () => {
  const vc = defaultCouriers("vilnius");
  assert.equal(vc.length, 10);
  assert.equal(new Set(vc.map((c) => c.color)).size, 10);
  const many = defaultCouriers("kaunas", 14);
  assert.equal(many.length, 14);
  assert.equal(new Set(many.map((c) => c.id)).size, 14);
  assert.deepEqual(many.slice(0, 10).map((c) => c.name), defaultCouriers("kaunas").map((c) => c.name));

  const ds = DatasetSchema.parse(emptyScenario("kaunas", new Date("2026-11-07T10:00:00Z")));
  assert.equal(ds.packages.length, 0);
  assert.equal(ds.couriers.length, 10);
  assert.equal(ds.depot.date, "2026-11-09"); // šeštadienis → pirmadienis
  assert.deepEqual(ds.depot.location, CITY_DEFS.kaunas.city.depot.location);
});

test("nextWeekday: Vilniaus laiku, visada po šiandienos", () => {
  assert.equal(nextWeekday(new Date("2026-11-09T10:00:00Z")), "2026-11-10"); // pirmadienis → antradienis
  assert.equal(nextWeekday(new Date("2026-11-13T10:00:00Z")), "2026-11-16"); // penktadienis → pirmadienis
  // 23:30 UTC sekmadienį = pirmadienis 01:30 Vilniuje → antradienis
  assert.equal(nextWeekday(new Date("2026-11-08T23:30:00Z")), "2026-11-10");
});

test("gavėjai: fiziniai asmenys ir autoservisai; autoservisų langai 08–17, dalis valdoma", () => {
  const pkgs = generatePackages({ city: "kaunas", count: 400, mix: DEFAULT_MIX, seed: 11 });
  const auto = pkgs.filter((p) => p.recipientType === "autoservice");
  const persons = pkgs.filter((p) => p.recipientType === "person");
  assert.equal(auto.length + persons.length, pkgs.length);
  const share = auto.length / pkgs.length;
  assert.ok(share > 0.25 && share < 0.45, `autoservisų dalis ${share}`);
  for (const p of auto) {
    assert.ok(p.window.start >= "08:00" && p.window.end <= "17:00", `${p.id} ${p.window.start}-${p.window.end}`);
    assert.ok(p.weightKg >= 2, `${p.id} ${p.weightKg}`);
    assert.doesNotMatch(p.address, /-\d+, /, "autoservisas be buto numerio");
  }
  for (const p of persons) assert.ok(p.weightKg <= 15, `${p.id} ${p.weightKg}`);
  const none = generatePackages({ city: "vilnius", count: 50, mix: DEFAULT_MIX, seed: 1, autoservicePct: 0 });
  assert.ok(none.every((p) => p.recipientType === "person"));
  const all = generatePackages({ city: "vilnius", count: 50, mix: DEFAULT_MIX, seed: 1, autoservicePct: 100 });
  assert.ok(all.every((p) => p.recipientType === "autoservice"));
});
