import type { Plan } from "@marsrutai/shared";

/**
 * Tikra kelių geometrija mock planui per OSRM (OpenStreetMap maršrutizatorius).
 * Mock optimizatorius skaičiuoja laikus tiesėmis × 1.3, bet žemėlapyje ir PDF eskize
 * maršrutas turi eiti gatvėmis. Jei OSRM nepasiekiamas, paliekamos tiesės ir grąžinamas false.
 */
export const OSRM_URL = process.env.OSRM_URL ?? "https://router.project-osrm.org";
/** Kiek taškų vienoje OSRM užklausoje (viešas serveris riboja ~100). */
const CHUNK = 90;

type LatLng = [number, number];
type FetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function roadGeometryEnabled(): boolean {
  return (process.env.MARSRUTAI_ROAD_GEOMETRY ?? "on").toLowerCase() !== "off";
}

async function osrmLeg(points: LatLng[], fetchFn: FetchFn, timeoutMs: number): Promise<LatLng[]> {
  const coords = points.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
  const url = `${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const body = (await res.json()) as { code?: string; routes?: { geometry: { coordinates: [number, number][] } }[] };
    const line = body.routes?.[0]?.geometry.coordinates;
    if (body.code !== "Ok" || !line?.length) throw new Error(`OSRM atsakymas: ${body.code ?? "be maršruto"}`);
    return line.map(([lng, lat]) => [lat, lng]);
  } finally {
    clearTimeout(timer);
  }
}

/** Kelių geometrija taškų sekai; ilgos sekos skaidomos į dalis su persidengiančiu tašku. */
export async function roadPath(points: LatLng[], fetchFn: FetchFn = fetch as unknown as FetchFn, timeoutMs = 10_000): Promise<LatLng[]> {
  const out: LatLng[] = [];
  for (let i = 0; i < points.length - 1; i += CHUNK - 1) {
    const part = await osrmLeg(points.slice(i, i + CHUNK), fetchFn, timeoutMs);
    out.push(...(out.length ? part.slice(1) : part));
  }
  return out;
}

/** Pakeičia kiekvieno maršruto `path` kelių geometrija. Grąžina, ar pavyko visiems maršrutams. */
export async function withRoadGeometry(plan: Plan, fetchFn?: FetchFn): Promise<boolean> {
  let allOk = true;
  for (const route of plan.routes) {
    // Maršrutai eina vienas po kito, kad neapkrautume viešo OSRM serverio.
    if (!route.stops.length || !route.path || route.path.length < 2) continue;
    try {
      route.path = await roadPath(route.path as LatLng[], fetchFn);
    } catch (e) {
      allOk = false;
      console.warn(`Kelių geometrija ${route.courierId} nepasiekiama (${(e as Error).message}) – paliekamos tiesės.`);
    }
  }
  return allOk;
}
