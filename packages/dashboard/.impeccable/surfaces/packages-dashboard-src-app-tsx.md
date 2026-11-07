---
version: 1
slug: "packages-dashboard-src-app-tsx"
primary_target: "packages/dashboard/src/App.tsx"
related_targets: ["packages/dashboard"]
---

# Surface: dashboard scenario editor + plan viewer

Scope: packages/dashboard (single page). Visitor mode: Operate.
Audience/job: dispatch planner (live, client meeting, projector) builds a one-city scenario, runs Google Route Optimization, checks the plan, hands out PDF route sheets.
Constraints: Lithuanian copy; 1280–1920 px desktop; priority colours fixed by PRODUCT.md; never colour-only encoding.
Decision process: sub-agent run, no live user; the roll's assigned direction was taken unattended (decision page not served). Challengers weighed in-thread: orienteering map = competitive (product clarity), the rest declined; raises below.

## Direction contract

THESIS: The map is a survey sheet a delivery day is drawn onto. Refuses the category default of a grey sidebar plus floating white cards over a full-bleed colourful map.

OWN-WORLD: Topographic sheet: paper-white margin ground (faint grey-green), black ink, hydro blue for action and selection only, contour brown for coordinates and the stale state, vegetation green for saved/OK. Map desaturated under a neatline with a graduated black/white border and coordinate ticks. Barlow / Barlow Semi Condensed, tabular numerals. Sidebar reads as the sheet's legend: symbol + label rows.

STORY: Planner sees city, depot and packages by priority; adds/edits packages and couriers; presses "Sudaryti maršrutus"; reads each courier's route as a course of numbered controls; opens or downloads PDFs.

FIRST VIEWPORT: Title-block bar on top: "Maršrutai", city switch (Vilnius/Kaunas), save state, mode select + primary "Sudaryti maršrutus" at right. Left ~380 px panel with tabs Scenarijus / Maršrutai. Right: map inside the neatline with coordinate ticks on all four margins, live cursor lat/lng readout in the bottom margin, priority legend in the margin.

FORM: grounded candidate 4 of 7 (Lithuanian topographic survey sheet). seed:6299009eab2391a4

Raises:
- From orienteering map: each stop is a numbered circle on the map paired with a row in the courier's stop table.
- From datamatics: every figure set in tabular columns, aligned right.
- From bitmap specimen: the priority symbol is one form repeated identically at every size (map, legend, list, form, popup).
- From airport signage: blue is reserved for action and selection, nothing else.
- From botanical folio: every courier's day drawn on the same 08:00–18:00 time strip.
- From event catalog: package code and map position link both ways (row → fly to marker, marker → row).

Signature move: the graduated neatline with live coordinates; a clicked point becomes a surveyed package ("54.6872, 25.2797").

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
