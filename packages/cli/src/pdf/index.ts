// Plan → PDF maršruto lapas kiekvienam kurjeriui (lietuviškai, A4).

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import {
  courierNavLinks,
  displayColors,
  walkMinutesOf,
  type NavLink,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  type Courier,
  type Package,
  type Plan,
  type Route,
  type Stop,
} from "@marsrutai/shared";
import { courierPdfFileName, formatDateTime, formatDuration, formatNumber, formatTime } from "./format.js";
import { drawRouteSketch } from "./map.js";
import { drawTable, type CellInput, type Column, type Segment } from "./table.js";
import { COLORS, FONT, FONT_FILES, PAGE } from "./theme.js";

export { courierPdfFileName, slugify } from "./format.js";

type Doc = PDFKit.PDFDocument;

const MODE_LABEL: Record<Plan["mode"], string> = { api: "Google Route Optimization", mock: "MOCK" };

interface Ctx {
  doc: Doc;
  plan: Plan;
  courier: Courier;
  route: Route | undefined;
  stops: { stop: Stop; pkg: Package | undefined }[];
  tz: string;
  left: number;
  width: number;
}

const bottom = (doc: Doc) => doc.page.height - PAGE.margin - PAGE.footerHeight;
const top = () => PAGE.margin;

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.doc.y + needed > bottom(ctx.doc)) {
    ctx.doc.addPage();
    ctx.doc.y = top();
  }
}

// ---------------------------------------------------------------- antraštė

function drawBadge(doc: Doc, text: string, color: string, rightX: number, y: number): void {
  doc.font(FONT.bold).fontSize(8);
  const w = doc.widthOfString(text) + 14;
  doc.save().roundedRect(rightX - w, y, w, 16, 8).fill(color).restore();
  doc.fillColor("#ffffff").text(text, rightX - w, y + 3.6, { width: w, align: "center", lineBreak: false });
}

function drawHeader(ctx: Ctx): void {
  const { doc, plan, courier, route, left, width, tz } = ctx;
  const depot = plan.dataset.depot;

  // Kurjerio spalvos juosta puslapio viršuje.
  doc.save().rect(0, 0, doc.page.width, 6).fill(courier.color).restore();

  let y = top();
  doc.font(FONT.bold).fontSize(20).fillColor(COLORS.text).text("Maršruto lapas", left, y, { lineBreak: false });
  drawBadge(
    doc,
    MODE_LABEL[plan.mode],
    plan.mode === "api" ? COLORS.apiBadge : COLORS.mockBadge,
    left + width,
    y + 5,
  );
  y += 30;

  // Kurjeris.
  doc.save().circle(left + 5, y + 8, 5).fill(courier.color).restore();
  doc.font(FONT.bold).fontSize(14).fillColor(COLORS.text).text(courier.name, left + 16, y, { lineBreak: false });
  const nameW = doc.widthOfString(courier.name);
  doc
    .font(FONT.regular)
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(`   ${courier.phone}  ·  ${courier.vehicle}`, left + 16 + nameW, y + 4, { lineBreak: false });
  y += 26;

  // Informacijos blokas.
  const stopsCount = ctx.stops.length;
  const weight = route?.totalWeightKg ?? 0;
  const util = courier.capacityKg > 0 ? Math.round((weight / courier.capacityKg) * 100) : 0;
  const cells: [string, string][] = [
    ["Data", depot.date],
    ["Išvykimas", route ? formatTime(route.start, tz) : "—"],
    ["Planuojamas grįžimas", route ? formatTime(route.end, tz) : "—"],
    ["Trukmė", route ? formatDuration(route.totalMinutes) : "—"],
    ["Bendras atstumas", `${formatNumber(route?.totalKm ?? 0)} km`],
    ["Stotelių", String(stopsCount)],
    ["Svoris / talpa", `${formatNumber(weight)} / ${formatNumber(courier.capacityKg)} kg (${util} %)`],
    ["Pamaina", `${courier.shiftStart}–${courier.shiftEnd}`],
  ];
  const cols = 4;
  const cellW = width / cols;
  const rowH = 30;
  const boxH = rowH * 2 + 34;
  doc.save().roundedRect(left, y, width, boxH, 5).fill(COLORS.headerBg).restore();
  cells.forEach(([label, value], i) => {
    const cx = left + 12 + (i % cols) * cellW;
    const cy = y + 9 + Math.floor(i / cols) * rowH;
    doc
      .font(FONT.regular)
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(label.toUpperCase(), cx, cy, { width: cellW - 16, lineBreak: false, characterSpacing: 0.3 });
    doc.font(FONT.bold).fontSize(10.5).fillColor(COLORS.text).text(value, cx, cy + 10, { width: cellW - 16, lineBreak: false, ellipsis: true });
  });
  // Sandėlis.
  const dy = y + 9 + rowH * 2;
  doc.save().moveTo(left + 12, dy - 4).lineTo(left + width - 12, dy - 4).lineWidth(0.5).stroke(COLORS.border).restore();
  doc.font(FONT.regular).fontSize(7.5).fillColor(COLORS.muted).text("SANDĖLIS", left + 12, dy + 3, { lineBreak: false, characterSpacing: 0.3 });
  doc
    .font(FONT.bold)
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(depot.name, left + 70, dy + 1, { continued: true, lineBreak: false })
    .font(FONT.regular)
    .fillColor(COLORS.muted)
    .text(`  ·  ${depot.address}  ·  darbo laikas ${depot.open}–${depot.close}`, { lineBreak: false });

  doc.x = left;
  doc.y = y + boxH + 16;
}

function sectionTitle(ctx: Ctx, title: string, minFollowing = 60): void {
  const { doc, left, courier } = ctx;
  ensureSpace(ctx, 22 + minFollowing);
  const y = doc.y;
  doc.save().rect(left, y + 2, 3, 13).fill(courier.color).restore();
  doc.font(FONT.bold).fontSize(12.5).fillColor(COLORS.text).text(title, left + 9, y, { lineBreak: false });
  doc.x = left;
  doc.y = y + 21;
}

function note(ctx: Ctx, text: string): void {
  const { doc, left, width } = ctx;
  doc.font(FONT.regular).fontSize(8.5).fillColor(COLORS.muted).text(text, left, doc.y, { width });
  doc.x = left;
  doc.y += 5;
}

// ---------------------------------------------------------------- navigacija

/** QR kodai paruošiami iš anksto (QRCode.toBuffer asinchroninis), piešiama sinchroniškai. */
async function navQrs(links: NavLink[]): Promise<Buffer[]> {
  return Promise.all(
    links.map((l) => QRCode.toBuffer(l.url, { errorCorrectionLevel: "M", margin: 1, scale: 4, color: { dark: "#1f2933", light: "#ffffff" } })),
  );
}

function drawNavigation(ctx: Ctx, links: NavLink[], qrs: Buffer[]): void {
  if (!links.length) return;
  const { doc, left, width } = ctx;
  const QR = 74;
  const GAP = 10;
  const perRow = 3;
  const cardW = (width - GAP * (perRow - 1)) / perRow;
  const cardH = QR + 16;
  sectionTitle(ctx, "Navigacija Google Maps", cardH);
  note(
    ctx,
    links.length > 1
      ? `Nuskenuokite QR kodą telefonu arba paspauskite nuorodą. Google Maps vienoje nuorodoje leidžia iki 10 stotelių, todėl maršrutas padalintas į ${links.length} dalis – pabaigę vieną, atidarykite kitą.`
      : "Nuskenuokite QR kodą telefonu arba paspauskite nuorodą – Google Maps atidarys visą maršrutą su stotelėmis eilės tvarka.",
  );
  for (let i = 0; i < links.length; i += perRow) {
    ensureSpace(ctx, cardH + 6);
    const y = doc.y;
    links.slice(i, i + perRow).forEach((l, k) => {
      const x = left + k * (cardW + GAP);
      doc.save().roundedRect(x, y, cardW, cardH, 6).lineWidth(0.8).strokeColor(COLORS.border).stroke().restore();
      doc.image(qrs[i + k]!, x + 8, y + 8, { width: QR, height: QR });
      const tx = x + QR + 16;
      const tw = cardW - QR - 24;
      doc.font(FONT.bold).fontSize(9).fillColor(COLORS.text).text(`${l.part} dalis iš ${l.parts}`, tx, y + 12, { width: tw });
      doc.font(FONT.regular).fontSize(8.5).fillColor(COLORS.muted).text(l.label, tx, doc.y + 1, { width: tw });
      const ly = doc.y + 6;
      doc.font(FONT.bold).fontSize(8.5).fillColor(COLORS.apiBadge).text("Atidaryti Google Maps ›", tx, ly, { width: tw, link: l.url, underline: false });
      doc.link(x, y, cardW, cardH, l.url);
    });
    doc.x = left;
    doc.y = y + cardH + 8;
  }
  doc.y += 4;
}

// ---------------------------------------------------------------- lentelės

function priorityCell(p: Package | undefined): CellInput {
  if (!p) return "—";
  return { dot: PRIORITY_COLORS[p.priority], lines: [{ text: PRIORITY_LABELS[p.priority] }] };
}

function recipientCell(p: Package | undefined): CellInput {
  if (!p) return { lines: [{ text: "Nežinomas paketas", color: COLORS.late }] };
  const lines: Segment[] = [{ text: p.recipient }];
  if (p.recipientType === "autoservice") lines.push({ text: "AUTOSERVISAS", color: COLORS.muted, size: 6.5, bold: true });
  if (p.phone) lines.push({ text: p.phone, color: COLORS.muted, size: 7.5 });
  return { lines };
}

function drawLoadingList(ctx: Ctx): void {
  const { doc, left, width } = ctx;
  sectionTitle(ctx, "Pakrovimo sąrašas");
  note(
    ctx,
    "Kraukite iš viršaus į apačią: paskutinis pristatomas paketas kraunamas pirmas (giliausiai), " +
      "pirmasis pristatomas – paskutinis (arčiausiai durų). Pažymėkite langelį, kai paketas pakrautas.",
  );
  const columns: Column[] = [
    { header: "#", width: 28, align: "center" },
    { header: "Paketo ID", width: 75 },
    { header: "Gavėjas", width: 185 },
    { header: "Stotelė", width: 50, align: "center" },
    { header: "Svoris", width: 55, align: "right" },
    { header: "Prioritetas", width: 70 },
    { header: "Pakrauta", width: width - 463, align: "center" },
  ];
  const rows: CellInput[][] = [...ctx.stops].reverse().map(({ stop, pkg }, i) => [
    { lines: [{ text: String(i + 1), bold: true }] },
    { lines: [{ text: stop.packageId, bold: true }] },
    recipientCell(pkg),
    { lines: [{ text: String(stop.seq), color: COLORS.muted }] },
    pkg ? `${formatNumber(pkg.weightKg)} kg` : "—",
    priorityCell(pkg),
    { checkbox: true },
  ]);
  drawTable(doc, {
    columns,
    rows,
    x: left,
    fontSize: 9,
    accent: ctx.courier.color,
    bottom: () => bottom(doc),
    top,
  });
  const total = ctx.stops.reduce((s, x) => s + (x.pkg?.weightKg ?? 0), 0);
  doc
    .font(FONT.bold)
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(`Iš viso: ${ctx.stops.length} vnt., ${formatNumber(total)} kg`, left, doc.y + 4, { width, align: "right" });
  doc.x = left;
  doc.y += 14;
}

/** Pastabos langelis; eksportuojama testams. */
export function remarkCell(stop: Stop, pkg: Package | undefined): CellInput {
  const lines: Segment[] = [];
  // Rodome tik tai, kas apvalinant sudaro bent 1 min ("Laukti 0 min" klaidina).
  const late = Math.round(stop.lateMinutes);
  const wait = Math.round(stop.waitMinutes);
  if (late >= 1) lines.push({ text: `Vėluoja ${late} min`, color: COLORS.late, bold: true });
  if (wait >= 1) lines.push({ text: `Laukti ${wait} min`, color: COLORS.wait, bold: true });
  if (pkg?.note) lines.push({ text: pkg.note, color: COLORS.muted, size: 7.5 });
  return lines.length ? { lines } : "";
}

function drawRouteTable(ctx: Ctx): void {
  const { doc, left, tz } = ctx;
  sectionTitle(ctx, "Maršrutas");
  const walk = walkMinutesOf(ctx.plan.dataset);
  if (walk > 0) {
    note(
      ctx,
      `Atvykimas – kada pastatote automobilį prie adreso. Kiekvienai stotelei įskaičiuota ${walk} min nueiti iki kliento ir pareiti atgal, plius perdavimo laikas.`,
    );
  }
  const columns: Column[] = [
    { header: "Eil. nr.", width: 32, align: "center" },
    { header: "Atvykimas", width: 52, align: "center" },
    { header: "Paketo ID", width: 50 },
    { header: "Gavėjas", width: 88 },
    { header: "Adresas", width: 104 },
    { header: "Langas", width: 58, align: "center" },
    { header: "Prioritetas", width: 60 },
    { header: "Pastaba", width: ctx.width - 444 },
  ];
  const rows: CellInput[][] = ctx.stops.map(({ stop, pkg }) => [
    { lines: [{ text: String(stop.seq), bold: true }] },
    { lines: [{ text: formatTime(stop.arrival, tz), bold: true, color: Math.round(stop.lateMinutes) >= 1 ? COLORS.late : COLORS.text }] },
    stop.packageId,
    recipientCell(pkg),
    {
      lines: [
        { text: pkg?.address ?? "—" },
        { text: `+${formatNumber(stop.distanceFromPrevKm)} km`, color: COLORS.faint, size: 7 },
      ],
    },
    pkg ? `${pkg.window.start}–${pkg.window.end}` : "—",
    priorityCell(pkg),
    remarkCell(stop, pkg),
  ]);
  drawTable(doc, { columns, rows, x: left, fontSize: 8.5, accent: ctx.courier.color, bottom: () => bottom(doc), top });
  if (ctx.route) {
    doc
      .font(FONT.regular)
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(
        `Grįžimas į sandėlį ~${formatTime(ctx.route.end, tz)}. Iš viso ${formatNumber(ctx.route.totalKm)} km, ${formatDuration(ctx.route.totalMinutes)}.`,
        left,
        doc.y + 4,
        { width: ctx.width },
      );
  }
  doc.x = left;
  doc.y += 14;
}

function drawSketch(ctx: Ctx): void {
  const { doc, left, width, plan, courier } = ctx;
  // Jei likusioje puslapio dalyje telpa bent 190 pt aukščio eskizas – piešiame čia, kitaip naujame puslapyje.
  const legendH = 20;
  const MIN_H = 190;
  const MAX_H = 330;
  sectionTitle(ctx, "Maršruto eskizas", MIN_H + legendH);
  const y = doc.y;
  const mapH = Math.max(MIN_H, Math.min(MAX_H, bottom(doc) - y - legendH));
  drawRouteSketch(
    doc,
    {
      depot: plan.dataset.depot.location,
      stops: ctx.stops
        .filter((s) => s.pkg)
        .map(({ stop, pkg }) => ({ seq: stop.seq, location: pkg!.location, ringColor: PRIORITY_COLORS[pkg!.priority] })),
      path: ctx.route?.path,
      color: courier.color,
    },
    { x: left, y, w: width, h: mapH },
  );
  // Legenda.
  const ly = y + mapH + 6;
  doc.font(FONT.regular).fontSize(7.5).fillColor(COLORS.muted);
  let lx = left;
  doc.save().rect(lx, ly + 1.5, 7, 7).fill(COLORS.text).restore();
  doc.fillColor(COLORS.muted).text("Sandėlis", lx + 10, ly, { lineBreak: false });
  lx += 60;
  doc.save().circle(lx + 4, ly + 5, 4).fill(courier.color).restore();
  doc.fillColor(COLORS.muted).text("Stotelė (numeris = eilė), kontūro spalva = prioritetas:", lx + 11, ly, { lineBreak: false });
  lx += 11 + doc.widthOfString("Stotelė (numeris = eilė), kontūro spalva = prioritetas:") + 8;
  for (const p of [1, 2, 3] as const) {
    doc.save().circle(lx + 3, ly + 5, 3).fill(PRIORITY_COLORS[p]).restore();
    doc.fillColor(COLORS.muted).text(PRIORITY_LABELS[p], lx + 9, ly, { lineBreak: false });
    lx += 9 + doc.widthOfString(PRIORITY_LABELS[p]) + 10;
  }
  doc
    .fillColor(COLORS.faint)
    .text(ctx.route?.path ? "Linija – kelių geometrija." : "Linija – tiesės tarp stotelių.", left, ly, {
      width,
      align: "right",
      lineBreak: false,
    });
  doc.x = left;
  doc.y = ly + 16;
}

function drawEmpty(ctx: Ctx): void {
  const { doc, left, width } = ctx;
  const y = doc.y;
  doc.save().roundedRect(left, y, width, 60, 5).lineWidth(1).dash(4, { space: 3 }).stroke(COLORS.border).restore();
  doc
    .font(FONT.bold)
    .fontSize(14)
    .fillColor(COLORS.muted)
    .text("Šiandien pristatymų nėra", left, y + 16, { width, align: "center" });
  doc
    .font(FONT.regular)
    .fontSize(9)
    .fillColor(COLORS.faint)
    .text("Šiam kurjeriui optimizatorius nepriskyrė jokių paketų.", left, y + 36, { width, align: "center" });
  doc.x = left;
  doc.y = y + 76;
}

// ---------------------------------------------------------------- poraštė

function drawPageChrome(ctx: Ctx): void {
  const { doc, plan, courier, left, width, tz } = ctx;
  const range = doc.bufferedPageRange();
  const generated = `Sugeneruota ${formatDateTime(plan.generatedAt, tz)} · ${MODE_LABEL[plan.mode]}`;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    const savedTop = doc.page.margins.top;
    doc.page.margins.bottom = 0;
    doc.page.margins.top = 0;
    const fy = doc.page.height - PAGE.margin + 4;
    doc.save().moveTo(left, fy - 6).lineTo(left + width, fy - 6).lineWidth(0.5).stroke(COLORS.border).restore();
    doc.font(FONT.regular).fontSize(7.5).fillColor(COLORS.muted).text(generated, left, fy, { lineBreak: false });
    const pageLabel = `Puslapis ${i - range.start + 1} iš ${range.count}`;
    doc.text(pageLabel, left + width - doc.widthOfString(pageLabel), fy, { lineBreak: false });
    if (i > range.start) {
      doc.save().rect(0, 0, doc.page.width, 4).fill(courier.color).restore();
      doc
        .font(FONT.regular)
        .fontSize(7.5)
        .fillColor(COLORS.faint)
        .text(`Maršruto lapas · ${courier.name} · ${plan.dataset.depot.date} (tęsinys)`, left, 18, { lineBreak: false });
    }
    doc.page.margins.bottom = savedBottom;
    doc.page.margins.top = savedTop;
  }
}

// ---------------------------------------------------------------- viešas API

export async function renderCourierPdf(plan: Plan, courierId: string, outFile: string): Promise<void> {
  const found = plan.dataset.couriers.find((c) => c.id === courierId);
  if (!found) throw new Error(`Kurjeris ${courierId} nerastas plane`);
  // Ta pati rodymo spalva kaip dashboard'e (be prioritetų ir veiksmo spalvų).
  const courier = { ...found, color: displayColors(plan.dataset.couriers).get(courierId) ?? found.color };
  const route = plan.routes.find((r) => r.courierId === courierId);
  const pkgById = new Map(plan.dataset.packages.map((p) => [p.id, p]));
  const stops = [...(route?.stops ?? [])]
    .sort((a, b) => a.seq - b.seq)
    .map((stop) => ({ stop, pkg: pkgById.get(stop.packageId) }));

  const navLinks = courierNavLinks(plan, courierId);
  const navQrCodes = await navQrs(navLinks);

  const doc = new PDFDocument({
    size: PAGE.size,
    margin: PAGE.margin,
    bufferPages: true,
    info: {
      Title: `Maršruto lapas – ${courier.name} – ${plan.dataset.depot.date}`,
      Author: "Maršrutai demo",
      Subject: `Maršrutas (${MODE_LABEL[plan.mode]})`,
    },
  });
  doc.registerFont(FONT.regular, FONT_FILES.regular);
  doc.registerFont(FONT.bold, FONT_FILES.bold);
  doc.font(FONT.regular);

  const done = new Promise<void>((resolve, reject) => {
    const out = createWriteStream(outFile);
    out.on("finish", resolve);
    out.on("error", reject);
    doc.on("error", reject);
    doc.pipe(out);
  });

  const ctx: Ctx = {
    doc,
    plan,
    courier,
    route,
    stops,
    tz: plan.dataset.depot.timezone || "Europe/Vilnius",
    left: PAGE.margin,
    width: doc.page.width - PAGE.margin * 2,
  };

  drawHeader(ctx);
  if (stops.length === 0) {
    drawEmpty(ctx);
  } else {
    drawNavigation(ctx, navLinks, navQrCodes);
    drawLoadingList(ctx);
    drawRouteTable(ctx);
    drawSketch(ctx);
  }
  drawPageChrome(ctx);
  doc.end();
  await done;
}

/** Sugeneruoja PDF kiekvienam kurjeriui (ir be stotelių); grąžina failų kelius. */
export async function renderAllPdfs(plan: Plan, outDir: string): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const files: string[] = [];
  for (const [i, courier] of plan.dataset.couriers.entries()) {
    const file = join(outDir, courierPdfFileName(i, courier.name));
    await renderCourierPdf(plan, courier.id, file);
    files.push(file);
  }
  return files;
}
