import { test } from "node:test";
import assert from "node:assert/strict";
import { localToRfc3339, parseDurationSec, toLocalIso, durationStr } from "./time.js";
import { decodePolyline } from "./polyline.js";

const TZ = "Europe/Vilnius";

test("vietinis laikas → UTC (lapkritis UTC+2, liepa UTC+3)", () => {
  assert.equal(localToRfc3339("2026-11-10", "08:00", TZ), "2026-11-10T06:00:00Z");
  assert.equal(localToRfc3339("2026-11-10", "18:00", TZ), "2026-11-10T16:00:00Z");
  assert.equal(localToRfc3339("2026-07-15", "08:00", TZ), "2026-07-15T05:00:00Z");
  assert.equal(localToRfc3339("2026-11-10", "01:30", TZ), "2026-11-09T23:30:00Z");
});

test("UTC → ISO su Vilniaus poslinkiu", () => {
  assert.equal(toLocalIso(Date.parse("2026-11-10T07:32:34Z"), TZ), "2026-11-10T09:32:34+02:00");
  assert.equal(toLocalIso(Date.parse("2026-07-15T05:00:00Z"), TZ), "2026-07-15T08:00:00+03:00");
  assert.equal(toLocalIso(Date.parse("2026-11-10T23:00:00Z"), TZ), "2026-11-11T01:00:00+02:00");
});

test("protobuf trukmės", () => {
  assert.equal(parseDurationSec("1380s"), 1380);
  assert.equal(parseDurationSec("0.5s"), 0.5);
  assert.equal(parseDurationSec(undefined), 0);
  assert.equal(durationStr(300), "300s");
  assert.throws(() => parseDurationSec("5m"));
});

test("polilinijos dekodavimas (Google pavyzdys)", () => {
  assert.deepEqual(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@"), [
    [38.5, -120.2],
    [40.7, -120.95],
    [43.252, -126.453],
  ]);
  assert.deepEqual(decodePolyline(""), []);
});
