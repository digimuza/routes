import {
  ApiErrorSchema,
  CitiesResponseSchema,
  GenerateResponseSchema,
  OptimizeResponseSchema,
  ScenarioSchema,
  type City,
  type CityId,
  type Dataset,
  type GenerateRequest,
  type OptimizeRequest,
  type OptimizeResponse,
  type Package,
} from "@marsrutai/shared";
import type { ZodType, ZodTypeDef } from "zod";

/**
 * - `network`: serveris nepasiekiamas (nėra ryšio arba Vite proxy negali prisijungti);
 * - `http`: serveris atsakė klaida (ApiError žinutė perduodama vartotojui);
 * - `invalid`: atsakymas neatitinka kontrakto (@marsrutai/shared zod schemų).
 */
export type ApiErrorKind = "network" | "http" | "invalid";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status?: number,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const isServerDown = (e: unknown) => e instanceof ApiError && e.kind === "network";

function describeIssues(issues: { path: (string | number)[]; message: string }[]): string {
  return issues
    .slice(0, 6)
    .map((i) => `${i.path.join(".") || "(šaknis)"}: ${i.message}`)
    .join("\n");
}

async function request<T>(
  method: "GET" | "PUT" | "POST",
  path: string,
  schema: ZodType<T, ZodTypeDef, unknown>,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new ApiError("Serveris nepasiekiamas.", "network", undefined, String(e));
  }

  const text = await res.text();
  let raw: unknown = undefined;
  let isJson = false;
  if (text) {
    try {
      raw = JSON.parse(text);
      isJson = true;
    } catch {
      /* ne JSON */
    }
  }

  if (!res.ok) {
    const parsed = isJson ? ApiErrorSchema.safeParse(raw) : null;
    if (parsed?.success) {
      const d = parsed.data.details;
      throw new ApiError(
        parsed.data.error,
        "http",
        res.status,
        d == null ? undefined : typeof d === "string" ? d : JSON.stringify(d, null, 2),
      );
    }
    // Vite proxy be veikiančio serverio grąžina 5xx be JSON kūno
    if (res.status >= 500 && !isJson) {
      throw new ApiError("Serveris nepasiekiamas.", "network", res.status);
    }
    throw new ApiError(`Serveris grąžino klaidą ${res.status}.`, "http", res.status);
  }

  if (!isJson) {
    // SPA fallback (index.html) reiškia, kad /api nėra proxy'inamas į serverį
    throw new ApiError("Serveris nepasiekiamas.", "network", res.status);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(
      `Serverio atsakymas (${method} ${path.split("?")[0]}) neatitinka kontrakto.`,
      "invalid",
      res.status,
      describeIssues(parsed.error.issues),
    );
  }
  return parsed.data;
}

const q = (city: CityId) => `city=${encodeURIComponent(city)}`;

export const api = {
  async cities(): Promise<City[]> {
    return (await request("GET", "/api/cities", CitiesResponseSchema)).cities;
  },
  scenario(city: CityId): Promise<Dataset> {
    return request("GET", `/api/scenario?${q(city)}`, ScenarioSchema);
  },
  saveScenario(city: CityId, dataset: Dataset): Promise<Dataset> {
    return request("PUT", `/api/scenario?${q(city)}`, ScenarioSchema, dataset);
  },
  async generate(req: GenerateRequest): Promise<Package[]> {
    return (await request("POST", "/api/generate", GenerateResponseSchema, req)).packages;
  },
  optimize(req: OptimizeRequest): Promise<OptimizeResponse> {
    return request("POST", "/api/optimize", OptimizeResponseSchema, req);
  },
  /** Paskutinis to miesto planas arba `null` (404). */
  async plan(city: CityId): Promise<OptimizeResponse | null> {
    try {
      return await request("GET", `/api/plan?${q(city)}`, OptimizeResponseSchema);
    } catch (e) {
      if (e instanceof ApiError && e.kind === "http" && e.status === 404) return null;
      throw e;
    }
  },
  zipUrl(city: CityId): string {
    return `/api/pdfs.zip?${q(city)}`;
  },
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
