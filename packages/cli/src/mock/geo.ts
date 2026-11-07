import type { LatLng } from "@marsrutai/shared";

/** Kelio vingiuotumo koeficientas: tiesė × 1.3 ≈ realus atstumas mieste. */
export const ROAD_FACTOR = 1.3;
/** Vidutinis greitis mieste, km/h. */
export const CITY_SPEED_KMH = 25;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Didžiojo apskritimo atstumas km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Apytikslis kelio atstumas km. */
export function roadKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * ROAD_FACTOR;
}

/** Važiavimo laikas sveikomis minutėmis (apvalinama į viršų, kad grafikas būtų "švarus"). */
export function travelMinutes(km: number): number {
  return Math.ceil((km / CITY_SPEED_KMH) * 60);
}
