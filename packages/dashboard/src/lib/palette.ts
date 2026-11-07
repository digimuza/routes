import type { Courier } from "@marsrutai/shared";

/**
 * Kurjerių spalvos: 12 atspalvių be raudonos, geltonos ir šviesiai pilkos (rezervuotos prioritetams,
 * PRIORITY_COLORS) ir be mėlynos (rezervuota veiksmui ir pasirinkimui). Kaimyninės – kuo skirtingesnės;
 * kurjeris visada atpažįstamas ir pagal vardą bei stotelių numerius, ne vien spalvą.
 */
export const COURIER_PALETTE = [
  "#2e7d32",
  "#7b3fa0",
  "#00838f",
  "#8d5524",
  "#689f38",
  "#ad5cc7",
  "#37474f",
  "#5e35b1",
  "#00695c",
  "#7d6224",
  "#4e6b2e",
  "#6d4c41",
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

function hsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [h, s, l];
}

/**
 * Ar kurjerio spalva painiojasi su rezervuotomis: prioritetų raudona/rožinė, geltona, pilka
 * arba veiksmo mėlyna.
 */
export function clashesWithReserved(hex: string): boolean {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return true;
  const [h, s, l] = hsl(hex);
  if (s < 0.15) return l > 0.45 && l < 0.8; // pilka (tamsi „slate“ – leidžiama)
  // šilti atspalviai (raudona, rožinė, oranžinė, gintarinė, geltona); tamsiai rudi leidžiami
  if ((h < 62 || h >= 300) && s > 0.3 && l >= 0.38) return true;
  if (h >= 190 && h < 255 && s > 0.3) return true; // mėlyna, įskaitant tamsiai mėlyną
  return false;
}

/**
 * Rodymo spalvos: kurjerio spalva paliekama, jei ji nesipainioja su rezervuotomis ir nesikartoja;
 * kitu atveju parenkama nepanaudota paletės spalva (eilės tvarka). Duomenys nekeičiami.
 */
export function displayColors(couriers: { id: string; color: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  const pending: string[] = [];
  for (const c of couriers) {
    const col = c.color.toLowerCase();
    if (!clashesWithReserved(col) && !used.has(col)) {
      out.set(c.id, col);
      used.add(col);
    } else pending.push(c.id);
  }
  const rgb = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const dist = (a: string, b: string) => {
    const [r1, g1, b1] = rgb(a);
    const [r2, g2, b2] = rgb(b);
    return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
  };
  let i = 0;
  for (const id of pending) {
    // nepanaudota paletės spalva, labiausiai nutolusi nuo jau naudojamų
    const free = COURIER_PALETTE.filter((p) => !used.has(p));
    const col = free.length
      ? free.reduce((best, p) => {
          const d = Math.min(Infinity, ...[...used].map((u) => dist(p, u)));
          const bd = Math.min(Infinity, ...[...used].map((u) => dist(best, u)));
          return d > bd ? p : best;
        })
      : COURIER_PALETTE[i++ % COURIER_PALETTE.length];
    out.set(id, col);
    used.add(col);
  }
  return out;
}
