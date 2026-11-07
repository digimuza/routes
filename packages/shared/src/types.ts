import { z } from "zod";

/** "HH:MM" vietos laiku (Europe/Vilnius), demo dienai. */
export const HHMM = z.string().regex(/^\d{2}:\d{2}$/);

export const LatLngSchema = z.object({ lat: z.number(), lng: z.number() });
export type LatLng = z.infer<typeof LatLngSchema>;

export const DepotSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  location: LatLngSchema,
  /** Demo diena, ISO data, pvz. "2026-11-10". */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Laiko zona, numatyta Europe/Vilnius. */
  timezone: z.string().default("Europe/Vilnius"),
  open: HHMM,
  close: HHMM,
});
export type Depot = z.infer<typeof DepotSchema>;

export const Priority = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Priority = z.infer<typeof Priority>;

/** Gavėjo tipas: demo klientas daugiausia veža fiziniams asmenims ir autoservisams. */
export const RecipientType = z.enum(["person", "autoservice"]);
export type RecipientType = z.infer<typeof RecipientType>;
export const RECIPIENT_TYPE_LABELS: Record<RecipientType, string> = { person: "Fizinis asmuo", autoservice: "Autoservisas" };

export const PackageSchema = z.object({
  id: z.string(),
  recipient: z.string(),
  /** Neprivalomas: seni duomenys be jo laikomi „person". */
  recipientType: RecipientType.optional(),
  phone: z.string().optional(),
  address: z.string(),
  location: LatLngSchema,
  priority: Priority,
  window: z.object({ start: HHMM, end: HHMM }),
  weightKg: z.number().positive(),
  serviceMinutes: z.number().positive().default(5),
  note: z.string().optional(),
});
export type Package = z.infer<typeof PackageSchema>;

export const CourierSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  vehicle: z.string(),
  capacityKg: z.number().positive(),
  shiftStart: HHMM,
  shiftEnd: HHMM,
  costPerHour: z.number().nonnegative(),
  costPerKm: z.number().nonnegative(),
  /** Spalva dashboard'ui ir PDF'ui, "#rrggbb". */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type Courier = z.infer<typeof CourierSchema>;

export const DatasetSchema = z.object({
  depot: DepotSchema,
  couriers: z.array(CourierSchema),
  packages: z.array(PackageSchema),
});
export type Dataset = z.infer<typeof DatasetSchema>;

// ---------------- Plan: vienintelė sąsaja tarp CLI, PDF ir dashboard ----------------

export const StopSchema = z.object({
  seq: z.number().int().positive(),
  packageId: z.string(),
  /** ISO 8601 su laiko zona. */
  arrival: z.string(),
  departure: z.string(),
  /** Vėlavimas po lango pabaigos, minutėmis (0 jei laiku). */
  lateMinutes: z.number().nonnegative(),
  /** Laukimas iki lango pradžios, minutėmis. */
  waitMinutes: z.number().nonnegative(),
  distanceFromPrevKm: z.number().nonnegative(),
});
export type Stop = z.infer<typeof StopSchema>;

export const RouteSchema = z.object({
  courierId: z.string(),
  start: z.string(),
  end: z.string(),
  stops: z.array(StopSchema),
  totalKm: z.number().nonnegative(),
  totalMinutes: z.number().nonnegative(),
  totalWeightKg: z.number().nonnegative(),
  /** Kelių geometrija [lat,lng][]; jei nėra, piešiama tiesėmis tarp stotelių. */
  path: z.array(z.tuple([z.number(), z.number()])).optional(),
});
export type Route = z.infer<typeof RouteSchema>;

export const SkippedSchema = z.object({ packageId: z.string(), reason: z.string() });
export type Skipped = z.infer<typeof SkippedSchema>;

export const PlanSchema = z.object({
  generatedAt: z.string(),
  mode: z.enum(["api", "mock"]),
  dataset: DatasetSchema,
  routes: z.array(RouteSchema),
  skipped: z.array(SkippedSchema),
  metrics: z.object({
    totalKm: z.number(),
    totalHours: z.number(),
    deliveredCount: z.number().int(),
    skippedCount: z.number().int(),
    lateCount: z.number().int(),
    /** Visa kaina pagal API (arba mock įvertis). */
    totalCost: z.number().optional(),
  }),
});
export type Plan = z.infer<typeof PlanSchema>;

/** Optimizatoriaus sąsaja: tiek API, tiek mock ją realizuoja. */
export interface Optimizer {
  name: "api" | "mock";
  optimize(dataset: Dataset): Promise<Plan>;
}

/** Prioriteto spalvos (PDF ir dashboard). */
export const PRIORITY_COLORS: Record<Priority, string> = { 1: "#d32f2f", 2: "#f9a825", 3: "#9e9e9e" };
export const PRIORITY_LABELS: Record<Priority, string> = { 1: "Aukštas", 2: "Vidutinis", 3: "Žemas" };
