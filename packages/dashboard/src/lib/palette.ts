import type { Courier } from "@marsrutai/shared";

/**
 * Kurjerių spalvos: 12 atspalvių be raudonos, geltonos ir pilkos (tos rezervuotos prioritetams,
 * PRIORITY_COLORS). Kaimyninės spalvos parinktos kuo labiau skirtingos.
 */
export const COURIER_PALETTE = [
  "#1f6fb2",
  "#2e7d32",
  "#7b3fa0",
  "#c2185b",
  "#00838f",
  "#3949ab",
  "#8d5524",
  "#689f38",
  "#0097c4",
  "#9c6ade",
  "#37474f",
  "#d4458f",
] as const;

/** Pirma dar nepanaudota paletės spalva (arba ciklas, jei kurjerių daugiau nei spalvų). */
export function nextCourierColor(couriers: Pick<Courier, "color">[]): string {
  const used = new Set(couriers.map((c) => c.color.toLowerCase()));
  return COURIER_PALETTE.find((c) => !used.has(c)) ?? COURIER_PALETTE[couriers.length % COURIER_PALETTE.length];
}

/** Santykinis skaistis (WCAG). */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Teksto spalva ant spalvoto fono: balta arba rašalo juoda, pagal didesnį kontrastą. */
export function inkOn(hex: string): string {
  const L = luminance(hex);
  const white = 1.05 / (L + 0.05);
  const ink = (L + 0.05) / (luminance("#1c211e") + 0.05);
  return white >= ink ? "#ffffff" : "#1c211e";
}
