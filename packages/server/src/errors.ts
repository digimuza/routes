import type { ApiError } from "@marsrutai/shared";
import type { ZodIssue } from "zod";

/** Klaida, kurią serveris grąžina kaip ApiErrorSchema JSON su nurodytu HTTP statusu. */
export class HttpError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 413 | 500 | 502,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }

  toJSON(): ApiError {
    return this.details === undefined ? { error: this.message } : { error: this.message, details: this.details };
  }
}

/** Zod klaidos → aiškus sąrašas: kelias ir pranešimas. */
export function zodDetails(issues: ZodIssue[]) {
  return {
    issues: issues.map((i) => ({ path: i.path.join(".") || "(šaknis)", message: i.message, code: i.code })),
  };
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const notFound = (message: string) => new HttpError(404, message);
