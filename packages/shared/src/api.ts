import { z } from "zod";
import { DatasetSchema, LatLngSchema, PackageSchema, PlanSchema } from "./types.js";

// ---------------- Lokalaus serverio (packages/server) HTTP kontraktas, SPEC 5b ----------------

export const CityId = z.enum(["vilnius", "kaunas"]);
export type CityId = z.infer<typeof CityId>;

export const CitySchema = z.object({
  id: CityId,
  name: z.string(),
  /** Žemėlapio centras ir pradinis mastelis. */
  center: LatLngSchema,
  zoom: z.number(),
  /** Ribos [[pietų lat, vakarų lng], [šiaurės lat, rytų lng]] – generavimui ir žemėlapiui. */
  bounds: z.tuple([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])]),
  /** Numatytasis sandėlis naujam scenarijui. */
  depot: z.object({ name: z.string(), address: z.string(), location: LatLngSchema }),
});
export type City = z.infer<typeof CitySchema>;

/** GET /api/cities */
export const CitiesResponseSchema = z.object({ cities: z.array(CitySchema) });
export type CitiesResponse = z.infer<typeof CitiesResponseSchema>;

/** GET /api/scenario?city=… → Dataset; PUT /api/scenario?city=… body: Dataset → Dataset */
export const ScenarioSchema = DatasetSchema;

/** POST /api/generate */
export const GenerateRequestSchema = z.object({
  city: CityId,
  count: z.number().int().min(1).max(300),
  /** Prioritetų dalys procentais, suma 100. */
  mix: z.object({ p1: z.number().min(0), p2: z.number().min(0), p3: z.number().min(0) }),
  seed: z.number().int().optional(),
  /** Kad sugeneruoti ID nesikirstų su jau esamais scenarijuje. */
  existingIds: z.array(z.string()).optional(),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export const GenerateResponseSchema = z.object({ packages: z.array(PackageSchema) });
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

/** POST /api/optimize — serveris naudoja išsaugotą scenarijų (PUT prieš tai). */
export const OptimizeRequestSchema = z.object({ city: CityId, mode: z.enum(["api", "mock"]) });
export type OptimizeRequest = z.infer<typeof OptimizeRequestSchema>;
export const OptimizeResponseSchema = z.object({
  plan: PlanSchema,
  /** URL keliai, pvz. "/out/vilnius/courier-01-jonas-petraitis.pdf", kurjerių tvarka. */
  pdfs: z.array(z.object({ courierId: z.string(), url: z.string() })),
  planUrl: z.string(),
  zipUrl: z.string(),
  durationMs: z.number(),
});
export type OptimizeResponse = z.infer<typeof OptimizeResponseSchema>;

/** GET /api/plan?city=… → paskutinis to miesto OptimizeResponse arba 404. */

/** Klaidos atsakymas visiems endpoint'ams (HTTP 4xx/5xx). */
export const ApiErrorSchema = z.object({ error: z.string(), details: z.unknown().optional() });
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Rezultatų katalogas pagal miestą: <repo>/out/<city>/ (plan.json, summary.md, PDF, pdfs.zip). */
export const outDirForCity = (city: CityId) => `out/${city}`;
