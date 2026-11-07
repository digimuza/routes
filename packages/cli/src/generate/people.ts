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

/** 10 visually distinct, map-friendly colours (tab10-like, no grey which is reserved for p3). */
export const COURIER_COLORS = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#17becf", "#808000", "#000075",
] as const;

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
export const COMPANIES = [
  "UAB „Baltijos sprendimai“", "UAB „Šiaurės vėjas“", "UAB „Gintarinė prekyba“", "UAB „Vilniaus logistika“",
  "UAB „Žalias kodas“", "UAB „Neries technologijos“", "UAB „Medžio dirbtuvės“", "UAB „Kavos namai“",
  "UAB „Ąžuolo baldai“", "UAB „Senamiesčio vaistinė“", "UAB „Saulės energija“", "UAB „Rūtos gėlės“",
  "UAB „Tikslus apskaitos centras“", "UAB „Debesų sistemos“", "UAB „Švarūs langai“", "UAB „Knygų kampas“",
  "UAB „Pilies spaustuvė“", "UAB „Žirmūnų odontologija“", "UAB „Dviračių centras“", "UAB „Lino namai“",
  "MB „Užupio keramika“", "MB „Šviežia duona“", "VšĮ „Jaunimo erdvė“", "UAB „Elektros taškas“",
];
export const NOTES_PERSON = ["Skambinti prieš atvykstant", "Palikti prie durų", "Durų kodas 1234#", "Neveikia skambutis, skambinti telefonu", "Laiptinė iš kiemo pusės", "Trapus siuntinys"];
export const NOTES_COMPANY = ["Palikti pas administratorių", "Pristatyti į registratūrą", "Įvažiavimas iš kiemo pusės", "Skambinti prieš atvykstant", "Trapus siuntinys", "Krovimo rampa nr. 2"];

/** Papildomos spalvos kurjeriams virš 10 (be pilkos ir prioritetų raudonos/geltonos). */
export const EXTRA_COURIER_COLORS = [
  "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#42d4f4",
  "#f032e6", "#469990", "#9a6324", "#800000", "#aaffc3",
] as const;

export const KAUNAS_COMPANIES = [
  "UAB „Nemuno logistika“", "UAB „Laisvės alėjos knygynas“", "UAB „Žaliakalnio statyba“", "UAB „Kauno duona“",
  "UAB „Santakos sprendimai“", "UAB „Šilainių vaistinė“", "UAB „Aleksoto technika“", "UAB „Dainavos baldai“",
  "UAB „Baltų spauda“", "UAB „Ąžuolyno sportas“", "UAB „Gintarinė prekyba“", "UAB „Debesų sistemos“",
  "UAB „Tikslus apskaitos centras“", "UAB „Švarūs langai“", "UAB „Elektros taškas“", "UAB „Kavos namai“",
  "MB „Senamiesčio keramika“", "MB „Šviežia duona“", "VšĮ „Jaunimo erdvė“", "UAB „Pažaislio gėlės“",
  "UAB „Petrašiūnų metalas“", "UAB „Vilijampolės odontologija“", "UAB „Dviračių centras“", "UAB „Lino namai“",
] as const;
