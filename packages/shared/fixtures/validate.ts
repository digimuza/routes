import { readFileSync } from "node:fs";
import { PlanSchema } from "../src/index.js";
const file = process.argv[2] ?? new URL("./sample-plan.json", import.meta.url).pathname;
PlanSchema.parse(JSON.parse(readFileSync(file, "utf8")));
console.log("plan valid:", file);
