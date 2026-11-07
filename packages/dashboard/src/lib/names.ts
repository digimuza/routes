import type { Courier, Package } from "@marsrutai/shared";

const MALE_FIRST = ["Jonas", "Tomas", "Mindaugas", "Darius", "Andrius", "Paulius", "Mantas", "Lukas", "Karolis", "Vytautas", "Marius", "Egidijus"];
const MALE_LAST = ["Petraitis", "Kazlauskas", "Jankauskas", "Stankevičius", "Vasiliauskas", "Žukauskas", "Butkus", "Paulauskas", "Urbonas", "Kavaliauskas", "Navickas", "Rimkus"];
const FEMALE_FIRST = ["Rūta", "Eglė", "Aistė", "Ieva", "Greta", "Laura", "Simona", "Austėja", "Indrė", "Gintarė", "Vaida", "Justina"];
const FEMALE_LAST = ["Žemaitė", "Kazlauskienė", "Petraitytė", "Jankauskaitė", "Butkutė", "Vasiliauskienė", "Urbonaitė", "Navickienė", "Rimkutė", "Stankevičiūtė", "Paulauskaitė", "Žukauskienė"];
const COMPANIES = ["UAB Šviesa", "UAB Medeina", "UAB Baltų kraštas", "MB Ąžuolynas", "UAB Vėtrungė", "UAB Gintarinė", "IĮ Rasa", "UAB Nemunėlis", "UAB Žalgiris prekyba", "UAB Saulėja"];

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export function lithuanianPerson(): string {
  return Math.random() < 0.5 ? `${pick(MALE_FIRST)} ${pick(MALE_LAST)}` : `${pick(FEMALE_FIRST)} ${pick(FEMALE_LAST)}`;
}

/** Lietuviškas vardas, kurio dar nėra tarp kurjerių. */
export function freshCourierName(couriers: Pick<Courier, "name">[]): string {
  const used = new Set(couriers.map((c) => c.name));
  for (let i = 0; i < 50; i++) {
    const n = lithuanianPerson();
    if (!used.has(n)) return n;
  }
  return lithuanianPerson();
}

export function randomRecipient(): string {
  return Math.random() < 0.35 ? pick(COMPANIES) : lithuanianPerson();
}

export function nextPackageId(packages: Pick<Package, "id">[]): string {
  let max = 0;
  for (const p of packages) {
    const m = /^PKG-(\d+)$/.exec(p.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PKG-${String(max + 1).padStart(3, "0")}`;
}

export function nextCourierId(couriers: Pick<Courier, "id">[]): string {
  let max = 0;
  for (const c of couriers) {
    const m = /^C(\d+)$/.exec(c.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `C${String(max + 1).padStart(2, "0")}`;
}

export const randomPhone = () => `+3706${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

export const VEHICLES = ["Furgonas", "Lengvasis automobilis", "Mikroautobusas", "Elektrinis furgonas", "Krovininis dviratis"];

export const fmtLatLng = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
