import assert from "node:assert/strict";
import { test } from "node:test";
import { epochMinToZonedIso, toZonedIso, tzOffsetMinutes, zonedTimeToEpochMs } from "./time.js";

const TZ = "Europe/Vilnius";

test("Vilnius is +02:00 in November and +03:00 in July", () => {
  assert.equal(tzOffsetMinutes(Date.UTC(2026, 10, 10, 12), TZ), 120);
  assert.equal(tzOffsetMinutes(Date.UTC(2026, 6, 10, 12), TZ), 180);
});

test("local HH:MM -> epoch -> ISO round-trips with offset", () => {
  const ms = zonedTimeToEpochMs("2026-11-10", "09:30", TZ);
  assert.equal(new Date(ms).toISOString(), "2026-11-10T07:30:00.000Z");
  assert.equal(toZonedIso(ms, TZ), "2026-11-10T09:30:00+02:00");
  assert.equal(epochMinToZonedIso(ms / 60000 + 15, TZ), "2026-11-10T09:45:00+02:00");
  assert.equal(toZonedIso(zonedTimeToEpochMs("2026-07-01", "08:00", TZ), TZ), "2026-07-01T08:00:00+03:00");
});

test("DST transition day (2026-10-25) resolves times on both sides", () => {
  assert.equal(toZonedIso(zonedTimeToEpochMs("2026-10-25", "02:00", TZ), TZ), "2026-10-25T02:00:00+03:00");
  assert.equal(toZonedIso(zonedTimeToEpochMs("2026-10-25", "08:00", TZ), TZ), "2026-10-25T08:00:00+02:00");
});
