/**
 * Deterministic synthetic dataset generator.
 *
 *   npm run gen-data                 # seed 42
 *   npm run gen-data -- --seed 7
 *
 * Writes data/normal.json (~70 packages) and data/overload.json (~140 packages,
 * heavier, total weight exceeds fleet capacity so some priority-3 packages get skipped).
 * Same seed → byte-identical output. No Math.random.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Courier, Dataset, Depot, Package, Priority } from "@marsrutai/shared";
import { findRepoRoot, parseDataset } from "../src/load.js";

// ---------------------------------------------------------------- PRNG

/** mulberry32: tiny, fast, deterministic 32-bit PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  float(): number {
    return this.next();
  }
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [v, w] of items) {
      r -= w;
      if (r < 0) return v;
    }
    return items[items.length - 1]![0];
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }
}

/** Derive independent sub-seeds so changing one dataset doesn't shift the other. */
function subSeed(seed: number, label: string): number {
  let h = (2166136261 ^ seed) >>> 0; // FNV-1a over label, mixed with seed
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// ---------------------------------------------------------------- Static data

const DATE = "2026-11-10";

const DEPOT: Depot = {
  id: "D1",
  name: "Sandėlis Kirtimai",
  address: "Savanorių pr. 178, Vilnius",
  location: { lat: 54.6665, lng: 25.235 },
  date: DATE,
  timezone: "Europe/Vilnius",
  open: "08:00",
  close: "18:00",
};

/** City bounds all package points must stay within. */
const BOUNDS = { minLat: 54.63, maxLat: 54.76, minLng: 25.15, maxLng: 25.45 };

type Addr = readonly [street: string, lat: number, lng: number, area: string];

/** Curated real Vilnius street addresses with approximate coordinates. */
const ADDRESSES: readonly Addr[] = [
  // Senamiestis
  ["Pilies g. 22", 54.6832, 25.2896, "Senamiestis"],
  ["Didžioji g. 31", 54.68, 25.2876, "Senamiestis"],
  ["Vokiečių g. 18", 54.68, 25.2834, "Senamiestis"],
  ["Totorių g. 7", 54.6855, 25.2795, "Senamiestis"],
  ["Vilniaus g. 25", 54.6845, 25.281, "Senamiestis"],
  ["Trakų g. 12", 54.68, 25.2805, "Senamiestis"],
  ["Rūdninkų g. 14", 54.679, 25.283, "Senamiestis"],
  ["Šv. Ignoto g. 8", 54.6829, 25.2846, "Senamiestis"],
  ["Universiteto g. 4", 54.6828, 25.2875, "Senamiestis"],
  ["Aušros Vartų g. 12", 54.6752, 25.2893, "Senamiestis"],
  ["Aušros Vartų g. 5", 54.677, 25.288, "Senamiestis"],
  ["Subačiaus g. 5", 54.677, 25.292, "Senamiestis"],
  ["Bokšto g. 6", 54.6795, 25.2925, "Senamiestis"],
  ["Literatų g. 3", 54.682, 25.2908, "Senamiestis"],
  ["Islandijos g. 4", 54.6838, 25.2817, "Senamiestis"],
  ["Stiklių g. 7", 54.6811, 25.2857, "Senamiestis"],
  ["Dominikonų g. 11", 54.6827, 25.2855, "Senamiestis"],
  ["Šv. Jono g. 3", 54.6823, 25.288, "Senamiestis"],
  ["Mėsinių g. 5", 54.68, 25.286, "Senamiestis"],
  ["Odminių g. 3", 54.685, 25.287, "Senamiestis"],
  ["Pranciškonų g. 3", 54.679, 25.2845, "Senamiestis"],
  ["Ligoninės g. 3", 54.6785, 25.2805, "Senamiestis"],
  ["Šv. Mykolo g. 9", 54.682, 25.2915, "Senamiestis"],
  ["Vingrių g. 5", 54.6815, 25.279, "Senamiestis"],
  ["Gedimino pr. 9", 54.6872, 25.2797, "Senamiestis"],
  // Naujamiestis
  ["J. Basanavičiaus g. 26", 54.6815, 25.27, "Naujamiestis"],
  ["Mindaugo g. 25", 54.676, 25.271, "Naujamiestis"],
  ["Mindaugo g. 11", 54.678, 25.275, "Naujamiestis"],
  ["Kauno g. 16", 54.6745, 25.277, "Naujamiestis"],
  ["Vytenio g. 9", 54.678, 25.264, "Naujamiestis"],
  ["Vytenio g. 50", 54.674, 25.26, "Naujamiestis"],
  ["Naugarduko g. 42", 54.6775, 25.269, "Naujamiestis"],
  ["Naugarduko g. 84", 54.674, 25.262, "Naujamiestis"],
  ["Algirdo g. 31", 54.679, 25.269, "Naujamiestis"],
  ["Švitrigailos g. 11", 54.6768, 25.264, "Naujamiestis"],
  ["Pamėnkalnio g. 7", 54.6838, 25.2733, "Naujamiestis"],
  ["A. Vienuolio g. 4", 54.6875, 25.273, "Naujamiestis"],
  ["Pylimo g. 21", 54.68, 25.2775, "Naujamiestis"],
  ["Geležinkelio g. 6", 54.6718, 25.28, "Naujamiestis"],
  ["Panerių g. 28", 54.6705, 25.27, "Naujamiestis"],
  ["Sodų g. 4", 54.673, 25.282, "Naujamiestis"],
  ["Gedimino pr. 34", 54.688, 25.2742, "Naujamiestis"],
  ["Gedimino pr. 50", 54.6893, 25.268, "Naujamiestis"],
  ["A. Goštauto g. 8", 54.6893, 25.271, "Naujamiestis"],
  ["Tauro g. 12", 54.683, 25.269, "Naujamiestis"],
  ["Smolensko g. 10", 54.6695, 25.264, "Naujamiestis"],
  ["Gerosios Vilties g. 1", 54.674, 25.254, "Naujamiestis"],
  ["Savanorių pr. 28", 54.6745, 25.256, "Naujamiestis"],
  ["K. Kalinausko g. 2", 54.6825, 25.2745, "Naujamiestis"],
  // Šnipiškės
  ["Konstitucijos pr. 7", 54.6965, 25.276, "Šnipiškės"],
  ["Konstitucijos pr. 26", 54.699, 25.266, "Šnipiškės"],
  ["Upės g. 9", 54.6948, 25.277, "Šnipiškės"],
  ["Kalvarijų g. 11", 54.6965, 25.281, "Šnipiškės"],
  ["Lvovo g. 25", 54.6985, 25.272, "Šnipiškės"],
  ["Rinktinės g. 5", 54.6965, 25.2895, "Šnipiškės"],
  ["Šeimyniškių g. 21", 54.699, 25.283, "Šnipiškės"],
  ["Krokuvos g. 6", 54.701, 25.277, "Šnipiškės"],
  ["Giedraičių g. 3", 54.7, 25.288, "Šnipiškės"],
  ["Kernavės g. 10", 54.7025, 25.284, "Šnipiškės"],
  // Žirmūnai
  ["Žirmūnų g. 68", 54.708, 25.301, "Žirmūnai"],
  ["Žirmūnų g. 139", 54.721, 25.299, "Žirmūnai"],
  ["Žirmūnų g. 2", 54.6995, 25.297, "Žirmūnai"],
  ["Kareivių g. 6", 54.718, 25.293, "Žirmūnai"],
  ["Tuskulėnų g. 35", 54.707, 25.293, "Žirmūnai"],
  ["Minties g. 1", 54.7, 25.302, "Žirmūnai"],
  ["Apkasų g. 20", 54.706, 25.299, "Žirmūnai"],
  ["Kalvarijų g. 98", 54.709, 25.283, "Žirmūnai"],
  ["Kalvarijų g. 131", 54.714, 25.281, "Žirmūnai"],
  ["Verkių g. 29", 54.713, 25.287, "Žirmūnai"],
  ["S. Žukausko g. 22", 54.713, 25.296, "Žirmūnai"],
  ["Žalgirio g. 90", 54.704, 25.278, "Žirmūnai"],
  ["Šiaurės g. 4", 54.7155, 25.3015, "Žirmūnai"],
  ["Lazdynų Pelėdos g. 6", 54.711, 25.3, "Žirmūnai"],
  ["P. Vileišio g. 18", 54.7035, 25.307, "Žirmūnai"],
  // Baltupiai
  ["Baltupio g. 24", 54.7312, 25.281, "Baltupiai"],
  ["Didlaukio g. 47", 54.7312, 25.265, "Baltupiai"],
  ["Kalvarijų g. 204", 54.727, 25.288, "Baltupiai"],
  ["Trinapolio g. 9", 54.736, 25.287, "Baltupiai"],
  ["Jeruzalės g. 15", 54.741, 25.29, "Baltupiai"],
  ["Akademijos g. 2", 54.733, 25.268, "Baltupiai"],
  ["Baltupio g. 2", 54.7285, 25.2775, "Baltupiai"],
  ["Ateities g. 10", 54.734, 25.266, "Baltupiai"],
  // Antakalnis
  ["Antakalnio g. 17", 54.693, 25.307, "Antakalnis"],
  ["Antakalnio g. 57", 54.699, 25.315, "Antakalnis"],
  ["Antakalnio g. 94", 54.703, 25.322, "Antakalnis"],
  ["Antakalnio g. 124", 54.707, 25.329, "Antakalnis"],
  ["Šilo g. 5", 54.6935, 25.319, "Antakalnis"],
  ["Tramvajų g. 7", 54.7005, 25.327, "Antakalnis"],
  ["L. Sapiegos g. 5", 54.693, 25.311, "Antakalnis"],
  ["Kovo 11-osios g. 28", 54.7065, 25.32, "Antakalnis"],
  ["Žolyno g. 13", 54.7085, 25.334, "Antakalnis"],
  ["Saulėtekio al. 11", 54.7225, 25.338, "Antakalnis"],
  ["Pranciškaus Skorinos g. 3", 54.701, 25.32, "Antakalnis"],
  ["Pamiškės g. 9", 54.6975, 25.3225, "Antakalnis"],
  // Užupis
  ["Užupio g. 15", 54.681, 25.2975, "Užupis"],
  ["Paupio g. 28", 54.6785, 25.299, "Užupis"],
  ["Paupio g. 3", 54.6775, 25.2975, "Užupis"],
  ["Krivių g. 15", 54.678, 25.303, "Užupis"],
  ["Polocko g. 23", 54.68, 25.304, "Užupis"],
  ["Malūnų g. 3", 54.6815, 25.295, "Užupis"],
  ["Filaretų g. 20", 54.682, 25.3065, "Užupis"],
  ["Kriaušių g. 9", 54.6795, 25.3005, "Užupis"],
  // Žvėrynas
  ["Vytauto g. 21", 54.694, 25.258, "Žvėrynas"],
  ["Birutės g. 28", 54.6925, 25.251, "Žvėrynas"],
  ["Kęstučio g. 45", 54.6915, 25.256, "Žvėrynas"],
  ["Liubarto g. 6", 54.696, 25.259, "Žvėrynas"],
  ["Latvių g. 25", 54.6955, 25.254, "Žvėrynas"],
  ["A. Mickevičiaus g. 32", 54.6935, 25.262, "Žvėrynas"],
  ["Sėlių g. 32", 54.698, 25.252, "Žvėrynas"],
  ["Traidenio g. 18", 54.6945, 25.2555, "Žvėrynas"],
  // Viršuliškės
  ["Viršuliškių g. 40", 54.708, 25.218, "Viršuliškės"],
  ["Viršuliškių g. 85", 54.7055, 25.228, "Viršuliškės"],
  ["Viršuliškių g. 22", 54.7065, 25.222, "Viršuliškės"],
  ["Vilkpėdės g. 4", 54.6795, 25.249, "Naujamiestis"],
  ["Bistryčios g. 7", 54.7095, 25.2235, "Viršuliškės"],
  // Karoliniškės
  ["L. Asanavičiūtės g. 23", 54.688, 25.21, "Karoliniškės"],
  ["L. Asanavičiūtės g. 38", 54.69, 25.2195, "Karoliniškės"],
  ["Sausio 13-osios g. 4", 54.6855, 25.217, "Karoliniškės"],
  ["Mykolo Paco g. 5", 54.6925, 25.2135, "Karoliniškės"],
  ["Laisvės pr. 3", 54.6905, 25.208, "Karoliniškės"],
  // Lazdynai
  ["Architektų g. 19", 54.672, 25.207, "Lazdynai"],
  ["Architektų g. 76", 54.667, 25.199, "Lazdynai"],
  ["Erfurto g. 22", 54.674, 25.2115, "Lazdynai"],
  ["Lazdynų g. 31", 54.6765, 25.2, "Lazdynai"],
  ["Rygos g. 23", 54.681, 25.2, "Lazdynai"],
  ["Jonažolių g. 6", 54.6705, 25.214, "Lazdynai"],
  // Šeškinė
  ["Šeškinės g. 12", 54.709, 25.242, "Šeškinė"],
  ["Šeškinės g. 40", 54.7165, 25.247, "Šeškinė"],
  ["Dūkštų g. 21", 54.717, 25.239, "Šeškinė"],
  ["Gelvonų g. 25", 54.724, 25.242, "Šeškinė"],
  ["Ozo g. 18", 54.7095, 25.263, "Šeškinė"],
  ["Ozo g. 25", 54.714, 25.269, "Šeškinė"],
  ["Ukmergės g. 126", 54.7055, 25.258, "Šeškinė"],
  ["Kurklių g. 5", 54.7205, 25.2445, "Šeškinė"],
  // Fabijoniškės
  ["Fabijoniškių g. 59", 54.733, 25.245, "Fabijoniškės"],
  ["Fabijoniškių g. 96", 54.738, 25.241, "Fabijoniškės"],
  ["S. Stanevičiaus g. 30", 54.73, 25.238, "Fabijoniškės"],
  ["S. Nėries g. 39", 54.735, 25.252, "Fabijoniškės"],
  ["Ukmergės g. 282", 54.731, 25.23, "Fabijoniškės"],
  ["Bajorų kel. 2", 54.7405, 25.2585, "Fabijoniškės"],
  // Pašilaičiai
  ["Gabijos g. 61", 54.724, 25.228, "Pašilaičiai"],
  ["Gabijos g. 90", 54.729, 25.22, "Pašilaičiai"],
  ["Ąžuolyno g. 7", 54.73, 25.22, "Pašilaičiai"],
  ["Medeinos g. 8", 54.733, 25.221, "Pašilaičiai"],
  ["Perkūnkiemio g. 6", 54.73, 25.205, "Pašilaičiai"],
  ["Pašilaičių g. 10", 54.7265, 25.2135, "Pašilaičiai"],
  // Justiniškės
  ["Justiniškių g. 14", 54.715, 25.218, "Justiniškės"],
  ["Justiniškių g. 64", 54.72, 25.214, "Justiniškės"],
  ["Taikos g. 40", 54.716, 25.208, "Justiniškės"],
  ["Laisvės pr. 60", 54.717, 25.201, "Justiniškės"],
  ["Rygiškių Jono g. 7", 54.7125, 25.2105, "Justiniškės"],
  // Pilaitė
  ["Pilaitės pr. 16", 54.711, 25.184, "Pilaitė"],
  ["Pilaitės pr. 31", 54.7075, 25.1885, "Pilaitė"],
  ["Tolminkiemio g. 10", 54.714, 25.183, "Pilaitė"],
  ["Įsruties g. 4", 54.706, 25.181, "Pilaitė"],
  ["Karaliaučiaus g. 7", 54.709, 25.178, "Pilaitė"],
  ["Vydūno g. 9", 54.7125, 25.1905, "Pilaitė"],
  // Naujoji Vilnia
  ["Parko g. 9", 54.693, 25.42, "Naujoji Vilnia"],
  ["Parko g. 31", 54.696, 25.424, "Naujoji Vilnia"],
  ["Pergalės g. 12", 54.695, 25.416, "Naujoji Vilnia"],
  ["Kalvelių g. 41", 54.688, 25.407, "Naujoji Vilnia"],
  ["Linksmoji g. 5", 54.689, 25.402, "Naujoji Vilnia"],
  ["Plytinės g. 27", 54.697, 25.431, "Naujoji Vilnia"],
  ["Dariaus ir Girėno g. 8", 54.6905, 25.412, "Naujoji Vilnia"],
];

const COURIER_PEOPLE: readonly (readonly [name: string, vehicle: string, capacityKg: number])[] = [
  ["Tomas Kazlauskas", "Furgonas VW Caddy", 150],
  ["Agnė Jankauskienė", "Furgonas Renault Kangoo", 150],
  ["Mantas Petrauskas", "Lengvasis Škoda Octavia Combi", 80],
  ["Rūta Vasiliauskienė", "Furgonas Citroën Berlingo", 150],
  ["Lukas Stankevičius", "Furgonas Ford Transit Connect", 150],
  ["Eglė Butkutė", "Lengvasis Toyota Corolla TS", 80],
  ["Darius Žukauskas", "Furgonas VW Caddy", 150],
  ["Justė Urbonaitė", "Furgonas Peugeot Partner", 150],
  ["Giedrius Paulauskas", "Lengvasis Škoda Fabia Combi", 80],
  ["Mindaugas Šimkus", "Furgonas Renault Kangoo", 150],
];

/** 10 visually distinct, map-friendly colours (tab10-like, no grey which is reserved for p3). */
const COURIER_COLORS = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#17becf", "#808000", "#000075",
] as const;

/** Couriers (0-based index) whose shift starts at 09:00. */
const LATE_START = new Set([4, 8]);

const MALE_FIRST = ["Jonas", "Petras", "Andrius", "Paulius", "Vytautas", "Žygimantas", "Arūnas", "Kęstutis", "Rimantas", "Šarūnas", "Donatas", "Algirdas", "Gintaras", "Marius", "Vilius"];
const FEMALE_FIRST = ["Aistė", "Ieva", "Gabija", "Neringa", "Rasa", "Jūratė", "Laura", "Simona", "Dalia", "Živilė", "Inga", "Goda", "Austėja", "Vaida", "Lina"];
/** [male, married female, unmarried female] surname forms. */
const SURNAMES: readonly (readonly [string, string, string])[] = [
  ["Kazlauskas", "Kazlauskienė", "Kazlauskaitė"],
  ["Petrauskas", "Petrauskienė", "Petrauskaitė"],
  ["Jankauskas", "Jankauskienė", "Jankauskaitė"],
  ["Stankevičius", "Stankevičienė", "Stankevičiūtė"],
  ["Vasiliauskas", "Vasiliauskienė", "Vasiliauskaitė"],
  ["Žukauskas", "Žukauskienė", "Žukauskaitė"],
  ["Butkus", "Butkienė", "Butkutė"],
  ["Paulauskas", "Paulauskienė", "Paulauskaitė"],
  ["Urbonas", "Urbonienė", "Urbonaitė"],
  ["Kavaliauskas", "Kavaliauskienė", "Kavaliauskaitė"],
  ["Navickas", "Navickienė", "Navickaitė"],
  ["Ramanauskas", "Ramanauskienė", "Ramanauskaitė"],
  ["Savickas", "Savickienė", "Savickaitė"],
  ["Žemaitis", "Žemaitienė", "Žemaitytė"],
  ["Šimkus", "Šimkienė", "Šimkutė"],
  ["Mačiulis", "Mačiulienė", "Mačiulytė"],
  ["Grigas", "Grigienė", "Grigaitė"],
  ["Černiauskas", "Černiauskienė", "Černiauskaitė"],
];
const COMPANIES = [
  "UAB „Baltijos sprendimai“", "UAB „Šiaurės vėjas“", "UAB „Gintarinė prekyba“", "UAB „Vilniaus logistika“",
  "UAB „Žalias kodas“", "UAB „Neries technologijos“", "UAB „Medžio dirbtuvės“", "UAB „Kavos namai“",
  "UAB „Ąžuolo baldai“", "UAB „Senamiesčio vaistinė“", "UAB „Saulės energija“", "UAB „Rūtos gėlės“",
  "UAB „Tikslus apskaitos centras“", "UAB „Debesų sistemos“", "UAB „Švarūs langai“", "UAB „Knygų kampas“",
  "UAB „Pilies spaustuvė“", "UAB „Žirmūnų odontologija“", "UAB „Dviračių centras“", "UAB „Lino namai“",
  "MB „Užupio keramika“", "MB „Šviežia duona“", "VšĮ „Jaunimo erdvė“", "UAB „Elektros taškas“",
];
const NOTES_PERSON = ["Skambinti prieš atvykstant", "Palikti prie durų", "Durų kodas 1234#", "Neveikia skambutis, skambinti telefonu", "Laiptinė iš kiemo pusės", "Trapus siuntinys"];
const NOTES_COMPANY = ["Palikti pas administratorių", "Pristatyti į registratūrą", "Įvažiavimas iš kiemo pusės", "Skambinti prieš atvykstant", "Trapus siuntinys", "Krovimo rampa nr. 2"];

// ---------------------------------------------------------------- Helpers

const round = (x: number, d: number) => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const phone = (rng: Rng) => `+3706${String(rng.int(0, 9_999_999)).padStart(7, "0")}`;

/** Jitter a point uniformly within a disc of `maxMeters`. */
function jitter(rng: Rng, lat: number, lng: number, maxMeters: number) {
  const r = maxMeters * Math.sqrt(rng.float());
  const theta = rng.float() * 2 * Math.PI;
  const dLat = (r * Math.cos(theta)) / 111_320;
  const dLng = (r * Math.sin(theta)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: round(lat + dLat, 6), lng: round(lng + dLng, 6) };
}

function makeCouriers(rng: Rng): Courier[] {
  return COURIER_PEOPLE.map(([name, vehicle, capacityKg], i) => ({
    id: `C${String(i + 1).padStart(2, "0")}`,
    name,
    phone: phone(rng),
    vehicle,
    capacityKg,
    shiftStart: LATE_START.has(i) ? "09:00" : "08:00",
    shiftEnd: "18:00",
    costPerHour: round(11.5 + rng.float(), 1),
    costPerKm: round(0.25 + rng.float() * 0.1, 2),
    color: COURIER_COLORS[i]!,
  }));
}

function makeWindow(rng: Rng, priority: Priority): { start: string; end: string } {
  const H = 60;
  if (priority === 1) {
    const [s, e] = rng.weighted<readonly [number, number]>([
      [[9 * H, 11 * H], 4],
      [[10 * H, 12 * H], 4],
      [[8 * H + 30, 10 * H + 30], 2],
      [[9 * H + 30, 11 * H + 30], 2],
      [[13 * H, 15 * H], 1],
    ]);
    return { start: hhmm(s), end: hhmm(e) };
  }
  if (priority === 2) {
    const len = rng.pick([2, 3, 3, 4]) * H;
    const latestStart = 18 * H - len;
    const slots = (latestStart - 8 * H) / 30;
    const s = 8 * H + rng.int(0, slots) * 30;
    return { start: hhmm(s), end: hhmm(s + len) };
  }
  const [s, e] = rng.weighted<readonly [number, number]>([
    [[12 * H, 18 * H], 4],
    [[8 * H, 18 * H], 3],
    [[10 * H, 18 * H], 2],
    [[14 * H, 18 * H], 1],
  ]);
  return { start: hhmm(s), end: hhmm(e) };
}

function personName(rng: Rng): string {
  const sn = rng.pick(SURNAMES);
  if (rng.chance(0.5)) return `${rng.pick(MALE_FIRST)} ${sn[0]}`;
  return `${rng.pick(FEMALE_FIRST)} ${rng.chance(0.6) ? sn[1] : sn[2]}`;
}

interface Profile {
  count: number;
  /** Weight = 0.5 + 29.5 * u^skew; higher skew → lighter packages. */
  weightSkew: number;
}

function makePackages(rng: Rng, profile: Profile): Package[] {
  if (profile.count > ADDRESSES.length) throw new Error("Per mažai adresų unikaliems paketams");
  const addrs = rng.shuffle(ADDRESSES).slice(0, profile.count);
  return addrs.map(([street, lat, lng], i) => {
    const priority = rng.weighted<Priority>([[1, 20], [2, 45], [3, 35]]);
    const isCompany = rng.chance(0.35);
    const recipient = isCompany ? rng.pick(COMPANIES) : personName(rng);
    const address = !isCompany && rng.chance(0.45) ? `${street}-${rng.int(1, 80)}, Vilnius` : `${street}, Vilnius`;
    const weightKg = Math.max(0.5, round(0.5 + 29.5 * rng.float() ** profile.weightSkew, 1));
    const serviceMinutes = rng.weighted<number>([[3, 3], [4, 4], [5, 5], [6, 3], [7, 2], [8, 1], [10, 1]]);
    const pkg: Package = {
      id: `PKG-${String(i + 1).padStart(3, "0")}`,
      recipient,
      ...(rng.chance(0.85) ? { phone: phone(rng) } : {}),
      address,
      location: jitter(rng, lat, lng, 40),
      priority,
      window: makeWindow(rng, priority),
      weightKg,
      serviceMinutes,
    };
    if (rng.chance(0.15)) pkg.note = rng.pick(isCompany ? NOTES_COMPANY : NOTES_PERSON);
    return pkg;
  });
}

function makeDataset(seed: number, label: string, profile: Profile): Dataset {
  const couriers = makeCouriers(new Rng(subSeed(seed, "couriers")));
  const packages = makePackages(new Rng(subSeed(seed, label)), profile);
  return { depot: DEPOT, couriers, packages };
}

function checkBounds(ds: Dataset, label: string) {
  for (const p of ds.packages) {
    const { lat, lng } = p.location;
    if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat || lng < BOUNDS.minLng || lng > BOUNDS.maxLng) {
      throw new Error(`${label}: ${p.id} (${p.address}) už miesto ribų: ${lat},${lng}`);
    }
  }
}

function summary(ds: Dataset): string {
  const byP = [1, 2, 3].map((p) => ds.packages.filter((x) => x.priority === p).length);
  const kg = round(ds.packages.reduce((s, p) => s + p.weightKg, 0), 1);
  const cap = ds.couriers.reduce((s, c) => s + c.capacityKg, 0);
  return `${ds.packages.length} paketų (p1=${byP[0]}, p2=${byP[1]}, p3=${byP[2]}), ${kg} kg / talpa ${cap} kg`;
}

// ---------------------------------------------------------------- Main

function parseSeed(argv: string[]): number {
  let raw: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--seed") raw = argv[++i];
    else if (a.startsWith("--seed=")) raw = a.slice("--seed=".length);
  }
  if (raw === undefined) return 42;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`--seed turi būti sveikasis skaičius, gauta: ${raw}`);
  return n;
}

function main() {
  const seed = parseSeed(process.argv.slice(2));
  const outDir = join(findRepoRoot(), "data");
  mkdirSync(outDir, { recursive: true });

  const variants: [string, Profile][] = [
    ["normal", { count: 70, weightSkew: 3 }],
    ["overload", { count: 140, weightSkew: 1.6 }],
  ];
  for (const [label, profile] of variants) {
    const ds = makeDataset(seed, label, profile);
    checkBounds(ds, label);
    parseDataset(ds, label); // throws with readable zod issues if invalid
    const file = join(outDir, `${label}.json`);
    writeFileSync(file, JSON.stringify(ds, null, 2) + "\n", "utf8");
    console.log(`${file}: ${summary(ds)} (seed ${seed})`);
  }
}

main();
