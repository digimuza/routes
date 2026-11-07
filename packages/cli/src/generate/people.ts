// Vardai, įmonės, pastabos, kurjerių sąrašas.

export const COURIER_PEOPLE: readonly (readonly [name: string, vehicle: string, capacityKg: number])[] = [
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


/** Couriers (0-based index) whose shift starts at 09:00. */
export const LATE_START = new Set([4, 8]);

export const MALE_FIRST = ["Jonas", "Petras", "Andrius", "Paulius", "Vytautas", "Žygimantas", "Arūnas", "Kęstutis", "Rimantas", "Šarūnas", "Donatas", "Algirdas", "Gintaras", "Marius", "Vilius"];
export const FEMALE_FIRST = ["Aistė", "Ieva", "Gabija", "Neringa", "Rasa", "Jūratė", "Laura", "Simona", "Dalia", "Živilė", "Inga", "Goda", "Austėja", "Vaida", "Lina"];
/** [male, married female, unmarried female] surname forms. */
export const SURNAMES: readonly (readonly [string, string, string])[] = [
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
export const NOTES_PERSON = ["Skambinti prieš atvykstant", "Palikti prie durų", "Durų kodas 1234#", "Neveikia skambutis, skambinti telefonu", "Laiptinė iš kiemo pusės", "Trapus siuntinys"];

/** Papildomos spalvos kurjeriams virš 10 (be pilkos ir prioritetų raudonos/geltonos). */


// ---- Autoservisai (išgalvoti pavadinimai) ----
export const AUTOSERVICES = [
  "Autoservisas „Ratų centras“", "UAB „Stabdžių meistrai“", "MB „Variklio klinika“", "Padangų centras „Protektorius“",
  "UAB „Kėbulų remontas“", "Autoservisas „Greitas ratas“", "UAB „Pavarų dėžės servisas“", "MB „Tepalų taškas“",
  "UAB „Auto diagnostika“", "Autoservisas „Važiuoklė“", "UAB „Dyzelio ekspertai“", "MB „Garažas 24“",
  "UAB „Elektros auto servisas“", "Autoservisas „Kampas“", "UAB „Amortizatorių centras“", "MB „Meistro dirbtuvės“",
  "UAB „Kondicionierių servisas“", "Autoservisas „Šviesos ir stiklai“", "UAB „Sankabų servisas“", "MB „Ratlankių remontas“",
] as const;
export const KAUNAS_AUTOSERVICES = [
  "Autoservisas „Nemuno ratai“", "UAB „Santakos autoservisas“", "MB „Šilainių garažas“", "Padangų centras „Dainava“",
  "UAB „Aleksoto kėbulai“", "Autoservisas „Petrašiūnų meistrai“", "UAB „Kauno stabdžiai“", "MB „Variklių klinika“",
  "UAB „Auto diagnostika Kaune“", "Autoservisas „Vilijampolės ratas“", "UAB „Pavarų centras“", "MB „Tepalų stotelė“",
  "UAB „Važiuoklės ekspertai“", "Autoservisas „Žaliakalnio garažas“", "UAB „Eiguliai servisas“", "MB „Kalniečių dirbtuvės“",
] as const;
export const NOTES_AUTOSERVICE = [
  "Automobilis ant keltuvo – skubu", "Pristatyti į dirbtuves, priima meistras", "Įvažiavimas pro vartus",
  "Padangų komplektas (4 vnt.)", "Stabdžių diskai ir kaladėlės", "Skambinti prieš atvykstant", "Priima iki 16:30",
] as const;
