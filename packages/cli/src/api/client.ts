// REST klientas: POST https://routeoptimization.googleapis.com/v1/projects/{project}:optimizeTours
import { getAccessToken } from "./auth.js";
import type { OptimizeToursRequest } from "./request.js";
import type { OptimizeToursResponse } from "./response.js";

export const DEFAULT_PROJECT = "marsrutai-digimuza";
export const DEFAULT_TIMEOUT_MS = 120_000;

export function getProject(): string {
  return process.env.GOOGLE_CLOUD_PROJECT?.trim() || DEFAULT_PROJECT;
}

export class RouteOptimizationError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "RouteOptimizationError";
  }
}

export interface CallOptions {
  project?: string;
  timeoutMs?: number;
  /** Testams / kitam tokenų šaltiniui. */
  token?: string;
}

export async function optimizeTours(
  request: OptimizeToursRequest,
  opts: CallOptions = {},
): Promise<OptimizeToursResponse> {
  const project = opts.project ?? getProject();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const token = opts.token ?? (await getAccessToken());
  const url = `https://routeoptimization.googleapis.com/v1/projects/${encodeURIComponent(project)}:optimizeTours`;

  // Serverio pusės terminas šiek tiek trumpesnis už kliento, kad gautume API klaidą, o ne nutrūkimą.
  const body = { timeout: `${Math.max(1, Math.floor(timeoutMs / 1000) - 5)}s`, ...request };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-goog-user-project": project,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new RouteOptimizationError(`Route Optimization API neatsakė per ${timeoutMs / 1000} s`);
    }
    throw new RouteOptimizationError(`Nepavyko pasiekti Route Optimization API: ${(e as Error).message}`);
  }

  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { error?: { status?: string; message?: string } };
      if (j.error?.message) detail = `${j.error.status ?? ""} ${j.error.message}`.trim() + `\n${text}`;
    } catch {
      /* ne JSON – rodome kaip yra */
    }
    const hint =
      res.status === 401
        ? " (tokenas negalioja – `gcloud auth login`)"
        : res.status === 403
          ? ` (patikrinkite, ar projekte ${project} įjungtas routeoptimization.googleapis.com ir billing)`
          : "";
    throw new RouteOptimizationError(
      `Route Optimization API klaida HTTP ${res.status}${hint}: ${detail}`,
      res.status,
      text,
    );
  }
  try {
    return JSON.parse(text) as OptimizeToursResponse;
  } catch {
    throw new RouteOptimizationError(`Route Optimization API grąžino ne JSON: ${text.slice(0, 500)}`, res.status, text);
  }
}
