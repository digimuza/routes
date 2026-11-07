// Miestai (SPEC 5b): sandėlis, žemėlapio centras, ribos ir kuruoti adresai.
import type { City, CityId, LatLng } from "@marsrutai/shared";
import { KAUNAS_ADDRESSES } from "./kaunas.js";
import { COMPANIES, KAUNAS_COMPANIES } from "./people.js";
import type { Addr } from "./types.js";
import { VILNIUS_ADDRESSES } from "./vilnius.js";

export interface CityDef {
  city: City;
  /** Depot.id naujame scenarijuje. */
  depotId: string;
  addresses: readonly Addr[];
  companies: readonly string[];
}

export const CITY_DEFS: Record<CityId, CityDef> = {
  vilnius: {
    city: {
      id: "vilnius",
      name: "Vilnius",
      center: { lat: 54.6872, lng: 25.2797 },
      zoom: 12,
      bounds: [
        [54.63, 25.15],
        [54.76, 25.45],
      ],
      depot: { name: "Sandėlis Kirtimai", address: "Savanorių pr. 178, Vilnius", location: { lat: 54.6665, lng: 25.235 } },
    },
    depotId: "D1",
    addresses: VILNIUS_ADDRESSES,
    companies: COMPANIES,
  },
  kaunas: {
    city: {
      id: "kaunas",
      name: "Kaunas",
      center: { lat: 54.9015, lng: 23.9295 },
      zoom: 12,
      bounds: [
        [54.835, 23.82],
        [54.965, 24.08],
      ],
      // Pramoninis Naujasodžio rajonas prie Pramonės pr. (OSM: building=industrial).
      depot: { name: "Sandėlis Naujasodis", address: "Draugystės g. 19, Kaunas", location: { lat: 54.90743, lng: 24.00459 } },
    },
    depotId: "D2",
    addresses: KAUNAS_ADDRESSES,
    companies: KAUNAS_COMPANIES,
  },
};

/** GET /api/cities tvarka: Vilnius, Kaunas. */
export const CITIES: City[] = [CITY_DEFS.vilnius.city, CITY_DEFS.kaunas.city];

export function cityById(id: CityId): City {
  return CITY_DEFS[id].city;
}

/** Ar taškas miesto ribose (City.bounds). */
export function inCityBounds(id: CityId, p: LatLng): boolean {
  const [[south, west], [north, east]] = CITY_DEFS[id].city.bounds;
  return p.lat >= south && p.lat <= north && p.lng >= west && p.lng <= east;
}
