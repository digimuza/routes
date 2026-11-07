import { PlanSchema, type Plan } from "@marsrutai/shared";

export const DEFAULT_PLAN_URL = "/out/plan.json";

export type PlanSource = "file" | "sample";

export interface LoadedPlan {
  plan: Plan;
  url: string;
  source: PlanSource;
}

export class PlanLoadError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly kind: "missing" | "invalid" | "network",
    public readonly details?: string,
  ) {
    super(message);
  }
}

/** Plano URL: `?plan=/out/plan.mock.json` arba numatytas `/out/plan.json`. */
export function planUrlFromLocation(): { url: string; explicit: boolean } {
  const q = new URLSearchParams(window.location.search).get("plan");
  return q ? { url: q, explicit: true } : { url: DEFAULT_PLAN_URL, explicit: false };
}

function parsePlan(raw: unknown, url: string): Plan {
  const res = PlanSchema.safeParse(raw);
  if (!res.success) {
    const details = res.error.issues
      .slice(0, 8)
      .map((i) => `${i.path.join(".") || "(šaknis)"}: ${i.message}`)
      .join("\n");
    throw new PlanLoadError("Planas neatitinka schemos (PlanSchema).", url, "invalid", details);
  }
  return res.data;
}

async function fetchPlan(url: string): Promise<Plan> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    throw new PlanLoadError("Nepavyko pasiekti serverio.", url, "network", String(e));
  }
  if (res.status === 404) throw new PlanLoadError("Plano failas nerastas.", url, "missing");
  if (!res.ok) throw new PlanLoadError(`Serveris grąžino ${res.status}.`, url, "network");
  const text = await res.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // Vite SPA fallback gali grąžinti index.html vietoje trūkstamo failo
    if (/^\s*</.test(text)) throw new PlanLoadError("Plano failas nerastas.", url, "missing");
    throw new PlanLoadError("Plano failas nėra galiojantis JSON.", url, "invalid");
  }
  return parsePlan(raw, url);
}

/**
 * Nuskaito planą. Dev režime, jei numatytas `/out/plan.json` dar nesugeneruotas,
 * naudojamas pavyzdinis planas iš `@marsrutai/shared` fixtures.
 */
export async function loadPlan(): Promise<LoadedPlan> {
  const { url, explicit } = planUrlFromLocation();
  try {
    return { plan: await fetchPlan(url), url, source: "file" };
  } catch (e) {
    if (import.meta.env.DEV && !explicit && e instanceof PlanLoadError && e.kind === "missing") {
      const mod = await import("../../shared/fixtures/sample-plan.json");
      return { plan: parsePlan(mod.default, "sample-plan.json"), url: "sample-plan.json", source: "sample" };
    }
    throw e;
  }
}
