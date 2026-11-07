/**
 * Dev-only fetch shim, įjungiamas `?mockApi=1`. Realizuoja packages/shared/src/api.ts kontraktą
 * su netikrais duomenimis, kol packages/server dar nėra. Į produkcinį bundle nepatenka
 * (importuojamas tik po `import.meta.env.DEV` patikros main.tsx).
 */
import {
  courierPdfFileName,
  DatasetSchema,
  GenerateRequestSchema,
  OptimizeRequestSchema,
  PlanSchema,
  type City,
  type CityId,
  type Courier,
  type Dataset,
  type OptimizeResponse,
  type Package,
  type Plan,
  type Priority,
} from "@marsrutai/shared";
import samplePlan from "../../../shared/fixtures/sample-plan.json";
import { COURIER_PALETTE } from "../lib/palette";
import { AUTOSERVICE_NOTES, freshCourierName, randomAutoservice, randomPersonRecipient, randomPhone } from "../lib/names";
import { addRoadGeometry, mockOptimize } from "./mockOptimize";
import { makePdf, makeZip } from "./mockFiles";

const CITIES: City[] = [
  {
    id: "vilnius",
    name: "Vilnius",
    center: { lat: 54.6872, lng: 25.2797 },
    zoom: 12,
    bounds: [
      [54.64, 25.17],
      [54.74, 25.35],
    ],
    depot: { name: "Sandėlis Vilnius", address: "Savanorių pr. 178, Vilnius", location: { lat: 54.672, lng: 25.241 } },
  },
  {
    id: "kaunas",
    name: "Kaunas",
    center: { lat: 54.8985, lng: 23.9036 },
    zoom: 12,
    bounds: [
      [54.865, 23.84],
      [54.94, 24.02],
    ],
    depot: { name: "Sandėlis Kaunas", address: "Pramonės pr. 16, Kaunas", location: { lat: 54.9093, lng: 23.9672 } },
  },
];

const STREETS: Record<CityId, string[]> = {
  vilnius: ["Gedimino pr.", "Konstitucijos pr.", "Ukmergės g.", "Kalvarijų g.", "Antakalnio g.", "Žirmūnų g.", "Savanorių pr.", "Laisvės pr.", "Pylimo g.", "Naugarduko g."],
  kaunas: ["Laisvės al.", "Savanorių pr.", "Vytauto pr.", "Pramonės pr.", "Taikos pr.", "Baltų pr.", "Kęstučio g.", "Jonavos g.", "Veiverių g.", "Partizanų g."],
};

const WINDOWS = [
  ["08:00", "10:00"],
  ["09:00", "12:00"],
  ["10:00", "13:00"],
  ["12:00", "15:00"],
  ["13:00", "17:00"],
  ["14:00", "18:00"],
  ["09:00", "17:00"],
] as const;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const key = (kind: string, city: CityId) => `marsrutai:mock:${kind}:${city}`;
const cityOf = (id: string) => CITIES.find((c) => c.id === id);

function defaultCouriers(): Courier[] {
  const caps = [150, 80, 150, 120, 150, 60, 150, 100, 150, 120];
  const out: Courier[] = [];
  caps.forEach((cap, i) => out.push({
    id: `C${String(i + 1).padStart(2, "0")}`,
    name: freshCourierName(out),
    phone: randomPhone(),
    vehicle: cap <= 80 ? "Lengvasis automobilis" : "Furgonas",
    capacityKg: cap,
    shiftStart: "08:00",
    shiftEnd: "18:00",
    costPerHour: 12,
    costPerKm: 0.3,
    color: COURIER_PALETTE[i],
  }));
  return out;
}

function defaultScenario(city: City): Dataset {
  const base: Dataset = {
    depot: {
      id: `D-${city.id}`,
      name: city.depot.name,
      address: city.depot.address,
      location: city.depot.location,
      date: "2026-11-10",
      timezone: "Europe/Vilnius",
      open: "08:00",
      close: "18:00",
    },
    couriers: defaultCouriers(),
    packages: [],
  };
  if (city.id === "vilnius") {
    const sample = PlanSchema.parse(samplePlan);
    base.packages = sample.dataset.packages;
  }
  return base;
}

function loadScenario(city: City): Dataset {
  const raw = localStorage.getItem(key("scenario", city.id));
  if (raw) {
    const p = DatasetSchema.safeParse(JSON.parse(raw));
    if (p.success) return p.data;
  }
  const ds = defaultScenario(city);
  localStorage.setItem(key("scenario", city.id), JSON.stringify(ds));
  return ds;
}

function jitter(c: City) {
  const [[s, w], [n, e]] = c.bounds;
  // daugiau taškų arčiau centro, kad atrodytų kaip tikras miestas
  const r = () => (Math.random() + Math.random()) / 2;
  return { lat: +(s + (n - s) * r()).toFixed(5), lng: +(w + (e - w) * r()).toFixed(5) };
}

const AUTO_WINDOWS: Record<Priority, (readonly [string, string])[]> = {
  1: [["08:00", "10:00"], ["08:00", "11:00"], ["09:00", "11:00"]],
  2: [["08:00", "12:00"], ["10:00", "14:00"], ["12:00", "16:00"]],
  3: [["08:00", "17:00"], ["13:00", "17:00"], ["10:00", "17:00"]],
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Atsitiktiniai paketai (atitinka serverio generatoriaus taisykles): autoservisai – langai 08:00–17:00,
 * skubūs (1) ryte, sunkesnės detalės 2–30 kg, dirbtuvių pastabos; fiziniai asmenys – smulkūs 0,5–15 kg.
 */
function generate(
  city: City,
  count: number,
  mix: { p1: number; p2: number; p3: number },
  existing: string[],
  autoservicePct: number,
): Package[] {
  const total = mix.p1 + mix.p2 + mix.p3 || 1;
  let n = 0;
  for (const id of existing) {
    const m = /^PKG-(\d+)$/.exec(id);
    if (m) n = Math.max(n, Number(m[1]));
  }
  const out: Package[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random() * total;
    const priority: Priority = r < mix.p1 ? 1 : r < mix.p1 + mix.p2 ? 2 : 3;
    const auto = Math.random() * 100 < autoservicePct;
    const options = auto ? AUTO_WINDOWS[priority] : WINDOWS;
    const [start, end] = options[Math.floor(Math.random() * options.length)];
    const streets = STREETS[city.id];
    out.push({
      id: `PKG-${String(++n).padStart(3, "0")}`,
      recipient: auto ? randomAutoservice() : randomPersonRecipient(),
      recipientType: auto ? "autoservice" : "person",
      address: `${streets[Math.floor(Math.random() * streets.length)]} ${1 + Math.floor(Math.random() * 120)}, ${city.name}`,
      location: jitter(city),
      priority,
      window: { start, end },
      weightKg: auto ? Math.round(2 + Math.random() * 28) : round1(0.5 + Math.random() * 14.5),
      serviceMinutes: auto ? 10 : 5,
      ...(auto ? { note: AUTOSERVICE_NOTES[Math.floor(Math.random() * AUTOSERVICE_NOTES.length)] } : {}),
    });
  }
  return out;
}

const blobUrls = new Map<CityId, string[]>();

function filesFor(city: CityId, plan: Plan): OptimizeResponse {
  for (const u of blobUrls.get(city) ?? []) URL.revokeObjectURL(u);
  const urls: string[] = [];
  const files = plan.dataset.couriers.map((c, i) => {
    const r = plan.routes.find((x) => x.courierId === c.id);
    const lines = [
      `MOCK - ${c.name}`,
      `Data ${plan.dataset.depot.date}, ${plan.dataset.depot.name}`,
      `Stoteles: ${r?.stops.length ?? 0}, ${r?.totalKm ?? 0} km`,
      ...(r?.stops ?? []).slice(0, 30).map((s) => `${s.seq}. ${s.packageId}  ${s.arrival.slice(11, 16)}`),
    ];
    return { courier: c, name: courierPdfFileName(i, c.name), data: makePdf(lines) };
  });
  const pdfs = files.map((f) => {
    const url = URL.createObjectURL(new Blob([f.data as BlobPart], { type: "application/pdf" }));
    urls.push(url);
    return { courierId: f.courier.id, url };
  });
  const zipUrl = URL.createObjectURL(
    new Blob([makeZip(files.map((f) => ({ name: f.name, data: f.data }))) as BlobPart], { type: "application/zip" }),
  );
  urls.push(zipUrl);
  blobUrls.set(city, urls);
  return { plan, pdfs, planUrl: `/out/${city}/plan.json`, zipUrl, durationMs: 0 };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fail = (status: number, error: string, details?: unknown) => json({ error, details }, status);

async function handle(url: URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const cityParam = url.searchParams.get("city") ?? "";
  const body = () => (init?.body ? JSON.parse(String(init.body)) : undefined);
  await delay(120 + Math.random() * 180);

  if (url.pathname === "/api/cities" && method === "GET") return json({ cities: CITIES });

  if (url.pathname === "/api/scenario") {
    const city = cityOf(cityParam);
    if (!city) return fail(400, `Nežinomas miestas: ${cityParam}`);
    if (method === "GET") return json(loadScenario(city));
    if (method === "PUT") {
      const p = DatasetSchema.safeParse(body());
      if (!p.success) return fail(400, "Scenarijus neatitinka schemos.", p.error.issues);
      localStorage.setItem(key("scenario", city.id), JSON.stringify(p.data));
      return json(p.data);
    }
  }

  if (url.pathname === "/api/generate" && method === "POST") {
    const p = GenerateRequestSchema.safeParse(body());
    if (!p.success) return fail(400, "Netinkama generavimo užklausa.", p.error.issues);
    const city = cityOf(p.data.city)!;
    return json({ packages: generate(city, p.data.count, p.data.mix, p.data.existingIds ?? [], p.data.autoservicePct ?? 35) });
  }

  if (url.pathname === "/api/optimize" && method === "POST") {
    const p = OptimizeRequestSchema.safeParse(body());
    if (!p.success) return fail(400, "Netinkama optimizavimo užklausa.", p.error.issues);
    const city = cityOf(p.data.city)!;
    const ds = loadScenario(city);
    if (ds.packages.length === 0) return fail(400, "Scenarijuje nėra paketų.");
    if (ds.couriers.length === 0) return fail(400, "Scenarijuje nėra kurjerių.");
    const t0 = performance.now();
    await delay(p.data.mode === "api" ? 1200 : 400);
    const plan = mockOptimize(ds);
    await addRoadGeometry(plan);
    // fetch shim visada skaičiuoja lokaliai, todėl planas sąžiningai pažymimas "mock"
    localStorage.setItem(key("plan", city.id), JSON.stringify(plan));
    return json({ ...filesFor(city.id, plan), durationMs: Math.round(performance.now() - t0) });
  }

  if (url.pathname === "/api/plan" && method === "GET") {
    const city = cityOf(cityParam);
    if (!city) return fail(400, `Nežinomas miestas: ${cityParam}`);
    const raw = localStorage.getItem(key("plan", city.id));
    const parsed = raw ? PlanSchema.safeParse(JSON.parse(raw)) : null;
    if (!parsed?.success) return fail(404, "Planas dar nesudarytas.");
    return json(filesFor(city.id, parsed.data));
  }

  return fail(404, `Mock API nežino ${method} ${url.pathname}`);
}

export function installMockApi() {
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.origin);
    if (url.origin === window.location.origin && url.pathname.startsWith("/api/")) {
      try {
        return await handle(url, init);
      } catch (e) {
        return fail(500, "Mock API klaida.", String(e));
      }
    }
    return real(input, init);
  };
  console.info("[marsrutai] Mock API įjungtas (?mockApi=1). Duomenys saugomi localStorage.");
}
