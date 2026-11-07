// Maršruto eskizas vektorine grafika (be išorinio žemėlapių API).
// Paprasta ekvirektangulinė projekcija: lng mastelis × cos(vidutinė platuma).

import type { LatLng } from "@marsrutai/shared";
import { COLORS, FONT } from "./theme.js";

type Doc = PDFKit.PDFDocument;

export interface SketchStop {
  seq: number;
  location: LatLng;
  /** Prioriteto spalva apskritimo kontūrui. */
  ringColor?: string;
}

export interface SketchInput {
  depot: LatLng;
  stops: SketchStop[];
  /** Kelių geometrija [lat,lng][]; jei nėra – tiesės depot → stotelės → depot. */
  path?: [number, number][];
  color: string;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const KM_PER_DEG_LAT = 111.32;
const INNER_PAD = 22;
const STOP_R = 7;

function niceKm(maxKm: number): number {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
  let best = steps[0]!;
  for (const s of steps) if (s <= maxKm) best = s;
  return best;
}

export function drawRouteSketch(doc: Doc, input: SketchInput, box: Box): void {
  const line: [number, number][] =
    input.path && input.path.length >= 2
      ? input.path
      : [
          [input.depot.lat, input.depot.lng],
          ...input.stops.map((s): [number, number] => [s.location.lat, s.location.lng]),
          [input.depot.lat, input.depot.lng],
        ];

  const all: [number, number][] = [
    ...line,
    [input.depot.lat, input.depot.lng],
    ...input.stops.map((s): [number, number] => [s.location.lat, s.location.lng]),
  ];
  const lats = all.map((p) => p[0]);
  const lngs = all.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  // Plotis/aukštis „platumos laipsniais" (t. y. vienodo mastelio vienetais).
  const spanX = Math.max((maxLng - minLng) * k, 1e-4);
  const spanY = Math.max(maxLat - minLat, 1e-4);
  const availW = box.w - INNER_PAD * 2;
  const availH = box.h - INNER_PAD * 2;
  const scale = Math.min(availW / spanX, availH / spanY); // pt per laipsnį
  const offX = box.x + INNER_PAD + (availW - spanX * scale) / 2;
  const offY = box.y + INNER_PAD + (availH - spanY * scale) / 2;
  const project = (lat: number, lng: number): [number, number] => [
    offX + (lng - minLng) * k * scale,
    offY + (maxLat - lat) * scale,
  ];

  // Fonas ir tinklelis.
  doc.save();
  doc.roundedRect(box.x, box.y, box.w, box.h, 4).fill(COLORS.mapBg);
  doc.roundedRect(box.x, box.y, box.w, box.h, 4).clip();
  doc.lineWidth(0.4).strokeColor(COLORS.mapGrid);
  for (let gx = box.x + 30; gx < box.x + box.w; gx += 30) doc.moveTo(gx, box.y).lineTo(gx, box.y + box.h).stroke();
  for (let gy = box.y + 30; gy < box.y + box.h; gy += 30) doc.moveTo(box.x, gy).lineTo(box.x + box.w, gy).stroke();

  // Maršruto linija.
  const pts = line.map(([lat, lng]) => project(lat, lng));
  doc.lineWidth(2.2).lineJoin("round").lineCap("round").strokeColor(input.color).strokeOpacity(0.85);
  doc.moveTo(pts[0]![0], pts[0]![1]);
  for (const p of pts.slice(1)) doc.lineTo(p[0], p[1]);
  doc.stroke();
  doc.strokeOpacity(1);

  // Sandėlis – kvadratas.
  const [dx, dy] = project(input.depot.lat, input.depot.lng);
  doc.rect(dx - 6, dy - 6, 12, 12).fillAndStroke(COLORS.text, "#ffffff");
  doc.font(FONT.bold).fontSize(6.5).fillColor("#ffffff").text("S", dx - 6, dy - 4.4, { width: 12, align: "center", lineBreak: false });

  // Stotelės – sunumeruoti apskritimai (vėlesnės piešiamos apačioje, pirmos – viršuje).
  for (const s of [...input.stops].reverse()) {
    const [sx, sy] = project(s.location.lat, s.location.lng);
    doc.lineWidth(1.6).circle(sx, sy, STOP_R).fillAndStroke(input.color, s.ringColor ?? "#ffffff");
    const label = String(s.seq);
    const size = label.length > 2 ? 5.2 : label.length > 1 ? 6.2 : 7;
    doc
      .font(FONT.bold)
      .fontSize(size)
      .fillColor("#ffffff")
      .text(label, sx - STOP_R, sy - size * 0.68, { width: STOP_R * 2, align: "center", lineBreak: false });
  }
  doc.restore();

  // Rėmelis.
  doc.save().lineWidth(0.7).roundedRect(box.x, box.y, box.w, box.h, 4).stroke(COLORS.border).restore();

  // Mastelio juosta (apačioje kairėje).
  const ptPerKm = scale / KM_PER_DEG_LAT;
  const km = niceKm((box.w * 0.25) / ptPerKm);
  const barW = km * ptPerKm;
  doc.font(FONT.regular).fontSize(7);
  const kmLabel = km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;
  const bx = box.x + box.w - 14 - barW - doc.widthOfString(kmLabel) - 4;
  const by = box.y + box.h - 12;
  doc
    .save()
    .lineWidth(1.2)
    .strokeColor(COLORS.muted)
    .moveTo(bx, by - 3)
    .lineTo(bx, by)
    .lineTo(bx + barW, by)
    .lineTo(bx + barW, by - 3)
    .stroke()
    .restore();
  doc
    .font(FONT.regular)
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text(kmLabel, bx + barW + 4, by - 6, { lineBreak: false });

  // Šiaurės rodyklė (viršuje dešinėje).
  const nx = box.x + box.w - 16;
  const ny = box.y + 10;
  doc.save().moveTo(nx, ny).lineTo(nx + 4, ny + 10).lineTo(nx - 4, ny + 10).closePath().fill(COLORS.muted).restore();
  doc.font(FONT.bold).fontSize(7).fillColor(COLORS.muted).text("Š", nx - 5, ny + 11, { width: 10, align: "center", lineBreak: false });
}
