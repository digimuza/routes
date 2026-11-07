// Paprastas lentelių piešėjas pdfkit'ui: daugiaeilutės ląstelės, spalvoti taškai,
// žymimieji langeliai, automatinis puslapiavimas su pakartojama antrašte.

import { COLORS, FONT } from "./theme.js";

type Doc = PDFKit.PDFDocument;

export interface Segment {
  text: string;
  color?: string;
  bold?: boolean;
  /** Šrifto dydis; numatyta – lentelės `fontSize`. */
  size?: number;
}

export interface Cell {
  lines?: Segment[];
  /** Spalvotas taškas prieš pirmą eilutę (pvz. prioritetas). */
  dot?: string;
  /** Tuščias žymimasis langelis (pakrovimo sąrašui). */
  checkbox?: boolean;
}

export type CellInput = string | Cell;

export interface Column {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
}

export interface TableOptions {
  columns: Column[];
  rows: CellInput[][];
  x: number;
  fontSize?: number;
  headerFontSize?: number;
  /** Akcentinė spalva (antraštės apatinė linija). */
  accent?: string;
  /** Apatinė riba, iki kurios galima piešti (y koordinatė). */
  bottom: () => number;
  /** Viršutinė riba naujame puslapyje. */
  top: () => number;
}

const PAD_X = 4;
const PAD_Y = 4;
const DOT_R = 3.2;
const DOT_SPACE = DOT_R * 2 + 4;
const CHECKBOX = 10;

function toCell(c: CellInput): Cell {
  return typeof c === "string" ? { lines: [{ text: c }] } : c;
}

function textWidth(col: Column, cell: Cell): number {
  return col.width - PAD_X * 2 - (cell.dot ? DOT_SPACE : 0);
}

function segHeight(doc: Doc, seg: Segment, width: number, fontSize: number): number {
  doc.font(seg.bold ? FONT.bold : FONT.regular).fontSize(seg.size ?? fontSize);
  return doc.heightOfString(seg.text || " ", { width, lineGap: 0 });
}

function cellHeight(doc: Doc, col: Column, cell: Cell, fontSize: number): number {
  let h = 0;
  for (const seg of cell.lines ?? []) h += segHeight(doc, seg, textWidth(col, cell), fontSize);
  if (cell.checkbox) h = Math.max(h, CHECKBOX);
  return h;
}

function rowHeight(doc: Doc, columns: Column[], cells: Cell[], fontSize: number): number {
  let h = fontSize * 1.2;
  cells.forEach((cell, i) => (h = Math.max(h, cellHeight(doc, columns[i]!, cell, fontSize))));
  return h + PAD_Y * 2;
}

function drawCell(doc: Doc, col: Column, cell: Cell, x: number, y: number, fontSize: number): void {
  const w = textWidth(col, cell);
  let tx = x + PAD_X;
  if (cell.dot) {
    const first = cell.lines?.[0];
    const lineH = (first?.size ?? fontSize) * 1.36;
    doc.save().circle(tx + DOT_R, y + PAD_Y + lineH / 2, DOT_R).fill(cell.dot).restore();
    tx += DOT_SPACE;
  }
  if (cell.checkbox) {
    const cx = x + (col.width - CHECKBOX) / 2;
    const lineH = fontSize * 1.36;
    doc.save().lineWidth(0.9).roundedRect(cx, y + PAD_Y + (lineH - CHECKBOX) / 2, CHECKBOX, CHECKBOX, 1.5).stroke(COLORS.muted).restore();
  }
  let ty = y + PAD_Y;
  for (const seg of cell.lines ?? []) {
    const size = seg.size ?? fontSize;
    doc
      .font(seg.bold ? FONT.bold : FONT.regular)
      .fontSize(size)
      .fillColor(seg.color ?? COLORS.text)
      .text(seg.text, tx, ty, { width: w, align: col.align ?? "left", lineGap: 0 });
    ty += segHeight(doc, seg, w, fontSize);
  }
}

function drawHeader(doc: Doc, opts: TableOptions, y: number): number {
  const size = opts.headerFontSize ?? (opts.fontSize ?? 9) - 0.5;
  const totalW = opts.columns.reduce((s, c) => s + c.width, 0);
  const h = size * 1.3 + PAD_Y * 2 + 1;
  doc.save().rect(opts.x, y, totalW, h).fill(COLORS.headerBg).restore();
  doc
    .save()
    .moveTo(opts.x, y + h)
    .lineTo(opts.x + totalW, y + h)
    .lineWidth(1.2)
    .stroke(opts.accent ?? COLORS.muted)
    .restore();
  let x = opts.x;
  for (const col of opts.columns) {
    doc.font(FONT.bold).fontSize(size).fillColor(COLORS.muted);
    const tw = doc.widthOfString(col.header);
    const inner = col.width - PAD_X * 2;
    const offset = col.align === "right" ? inner - tw : col.align === "center" ? (inner - tw) / 2 : 0;
    doc.text(col.header, x + PAD_X + Math.max(0, offset), y + PAD_Y + 0.5, { lineBreak: false });
    x += col.width;
  }
  return y + h;
}

/** Aukštis, kurio reikia antraštei + pirmai eilutei (kad antraštė nebūtų „našlaitė"). */
export function minTableStartHeight(doc: Doc, opts: TableOptions): number {
  const fontSize = opts.fontSize ?? 9;
  const headerH = (opts.headerFontSize ?? fontSize - 0.5) * 1.3 + PAD_Y * 2 + 1;
  const first = opts.rows[0];
  return headerH + (first ? rowHeight(doc, opts.columns, first.map(toCell), fontSize) : 0);
}

/** Piešia lentelę nuo `doc.y`; grąžina y po paskutinės eilutės. */
export function drawTable(doc: Doc, opts: TableOptions): number {
  const fontSize = opts.fontSize ?? 9;
  const totalW = opts.columns.reduce((s, c) => s + c.width, 0);
  let y = doc.y;
  if (y + minTableStartHeight(doc, opts) > opts.bottom()) {
    doc.addPage();
    y = opts.top();
  }
  y = drawHeader(doc, opts, y);

  opts.rows.forEach((raw, rowIndex) => {
    const cells = raw.map(toCell);
    const h = rowHeight(doc, opts.columns, cells, fontSize);
    if (y + h > opts.bottom()) {
      doc.addPage();
      y = drawHeader(doc, opts, opts.top());
    }
    if (rowIndex % 2 === 1) doc.save().rect(opts.x, y, totalW, h).fill(COLORS.zebra).restore();
    let x = opts.x;
    cells.forEach((cell, i) => {
      const col = opts.columns[i]!;
      drawCell(doc, col, cell, x, y, fontSize);
      x += col.width;
    });
    y += h;
    doc
      .save()
      .moveTo(opts.x, y)
      .lineTo(opts.x + totalW, y)
      .lineWidth(0.5)
      .stroke(COLORS.border)
      .restore();
  });

  doc.x = opts.x;
  doc.y = y;
  return y;
}
