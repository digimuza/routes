import { fileURLToPath } from "node:url";

/** Šriftai su pilnu lietuviškų raidžių palaikymu (Noto Sans, SIL OFL 1.1). */
export const FONT_FILES = {
  regular: fileURLToPath(new URL("../../assets/fonts/NotoSans-Regular.ttf", import.meta.url)),
  bold: fileURLToPath(new URL("../../assets/fonts/NotoSans-Bold.ttf", import.meta.url)),
} as const;

export const FONT = { regular: "Body", bold: "BodyBold" } as const;

export const COLORS = {
  text: "#1f2933",
  muted: "#616e7c",
  faint: "#9aa5b1",
  border: "#d9dee4",
  headerBg: "#eef1f5",
  zebra: "#f8f9fb",
  late: "#c62828",
  wait: "#b26a00",
  apiBadge: "#1a73e8",
  mockBadge: "#e65100",
  mapBg: "#f6f8fa",
  mapGrid: "#e3e8ee",
} as const;

/** A4 taškais: 595.28 × 841.89. */
export const PAGE = {
  size: "A4" as const,
  margin: 40,
  /** Poraštei rezervuota vieta apačioje (virš apatinės paraštės). */
  footerHeight: 18,
};
