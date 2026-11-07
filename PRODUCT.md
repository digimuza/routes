# Product

<!-- impeccable:product-schema 1 -->

> Source: written by the dashboard agent from the team lead's brief and SPEC.md (v0.4). No live
> interview was possible (sub-agent run); every fact below comes from that brief or the spec, and
> open decisions are marked as such.

## Platform

web

## Users

Dispatch planners at a Lithuanian company that delivers products to customers. In the demo they
build a day's scenario (packages, couriers) for one city, run the optimizer and hand each courier a
printed route sheet. The first real audience is the client's planning team, watching the tool live
in a meeting, often on a projector.

## Product Purpose

"Maršrutai" is a demo that proves Google Route Optimization API can assign packages to couriers and
order the stops while respecting package priority (1 high, 2 medium, 3 low) and delivery time
windows, then produce one printable PDF route sheet per courier. Success: the client sees a
scenario they recognise, presses one button, and trusts the resulting plan and the PDFs.

## Positioning

Not a generic map toy: the plan comes from Google's optimizer with the client's own business rules
(priority as penalty cost, soft window ends, vehicle capacity, shift times) and ends in the paper
artifact couriers actually carry.

## Operating Context

- Desktop browser, 1280–1920 px wide; shown live in a client meeting, often on a projector.
- Two cities, Vilnius and Kaunas, each with its own depot; a scenario belongs to one city.
- Flow: build scenario (generate random packages or click the map, edit couriers) → "Sudaryti
  maršrutus" (Google API or Mock) → inspect routes, stops, skipped packages → open / download PDFs.
- A local Node server (`packages/server`, port 8787) stores scenarios, runs the optimizer and
  writes `out/<city>/plan.json` plus PDFs; the dashboard talks to it over `/api` and `/out`.

## Capabilities and Constraints

- All UI copy is Lithuanian. Times are local Europe/Vilnius, HH:MM.
- Arrival means the courier arrives at the door; service starts at arrival + waiting time. Late /
  wait are shown only when ≥ 1 min.
- Priority colours are shared with the PDF: 1 red `#d32f2f`, 2 yellow `#f9a825`, 3 grey `#9e9e9e`
  (`PRIORITY_COLORS` in `@marsrutai/shared`). Courier colours must stay distinct from them.
- No auth, no database, no geocoding (addresses default to "lat, lng"), single day, single depot per
  city.
- Undecided: real client branding (none supplied); final hosting (local only for the demo).

## Brand Commitments

None supplied by the client. Product name in UI: "Maršrutai". Voice: plain, precise Lithuanian
logistics vocabulary (paketas, kurjeris, sandėlis, langas, maršrutas, stotelė).

## Evidence on Hand

- `data/normal.json`, `data/overload.json`: synthetic Vilnius datasets.
- `packages/shared/fixtures/sample-plan.json`: sample plan.
- All recipient names, addresses and packages are synthetic; no real customers, metrics or claims
  may be invented.

## Product Principles

1. The plan must be checkable: every number on screen can be traced to a stop, a window or a
   courier.
2. State is never ambiguous: editing vs. viewing a plan, fresh vs. stale plan, saved vs. saving.
3. Calm under a projector: legible at distance, no noise competing with the routes.
4. The paper route sheet is the end product; the screen leads to it.

## Accessibility & Inclusion

Priority and courier identity must never rely on colour alone (shape / number / label as well);
projector-legible contrast and sizes.
