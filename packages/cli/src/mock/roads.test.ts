import assert from "node:assert/strict";
import { test } from "node:test";
import { roadPath } from "./roads.js";

const fakeFetch = (calls: string[]) => async (url: string) => {
  calls.push(url);
  const coords = url.split("/driving/")[1]!.split("?")[0]!.split(";").map((p) => p.split(",").map(Number) as [number, number]);
  // Grąžina kiekvieną tašką + tarpinį tašką, kaip „kelią".
  const line: [number, number][] = [];
  coords.forEach((c, i) => {
    line.push(c);
    const n = coords[i + 1];
    if (n) line.push([(c[0] + n[0]) / 2, (c[1] + n[1]) / 2 + 0.001]);
  });
  return { ok: true, status: 200, json: async () => ({ code: "Ok", routes: [{ geometry: { coordinates: line } }] }) };
};

test("roadPath: [lat,lng] tvarka, OSRM gauna lng,lat", async () => {
  const calls: string[] = [];
  const path = await roadPath([[54.67, 25.24], [54.69, 25.28], [54.67, 25.24]], fakeFetch(calls));
  assert.equal(calls.length, 1);
  assert.match(calls[0]!, /driving\/25\.240000,54\.670000;25\.280000,54\.690000;/);
  assert.deepEqual(path[0], [54.67, 25.24]);
  assert.equal(path.length, 5);
});

test("roadPath: ilga seka skaidoma, sandūros taškas nedubliuojamas", async () => {
  const calls: string[] = [];
  const pts: [number, number][] = Array.from({ length: 200 }, (_, i) => [54.6 + i * 0.0005, 25.2]);
  const path = await roadPath(pts, fakeFetch(calls));
  assert.equal(calls.length, 3);
  assert.equal(path.length, 2 * pts.length - 1);
});

test("roadPath: klaida perduodama (kvietėjas palieka tieses)", async () => {
  const bad = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(roadPath([[54.6, 25.2], [54.7, 25.3]], bad), /429/);
});
