// Realus optimizatorius per Google Route Optimization API (REST).
import { DatasetSchema, type Optimizer } from "@marsrutai/shared";
import { optimizeTours } from "./client.js";
import { buildRequest } from "./request.js";
import { buildPlan } from "./response.js";

export const apiOptimizer: Optimizer = {
  name: "api",
  async optimize(dataset) {
    const ds = DatasetSchema.parse(dataset);
    const request = buildRequest(ds);
    const response = await optimizeTours(request);
    return buildPlan(ds, response);
  },
};

export { buildRequest, COST_TUNING } from "./request.js";
export { buildPlan, SKIP_REASONS_LT } from "./response.js";
export { optimizeTours, getProject, RouteOptimizationError } from "./client.js";
export { getAccessToken } from "./auth.js";
export { decodePolyline } from "./polyline.js";
export type { OptimizeToursRequest } from "./request.js";
export type { OptimizeToursResponse } from "./response.js";
