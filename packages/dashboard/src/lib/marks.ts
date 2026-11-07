import { PRIORITY_COLORS, type Priority } from "@marsrutai/shared";
import { inkOn } from "./palette";

/**
 * Prioriteto ženklas – viena forma visur (žemėlapis, legenda, sąrašas, forma, popup):
 * 1 – rombas, 2 – kvadratas, 3 – apskritimas, visada su skaitmeniu viduje (ne vien spalva).
 */
const SHAPES: Record<Priority, string> = {
  1: '<path d="M12 1.2 22.8 12 12 22.8 1.2 12Z"/>',
  2: '<rect x="2.6" y="2.6" width="18.8" height="18.8" rx="2.4"/>',
  3: '<circle cx="12" cy="12" r="10"/>',
};

export function priorityMarkSvg(p: Priority, size: number, outline: string | null = null): string {
  const fill = PRIORITY_COLORS[p];
  const stroke = outline ? ` stroke="${outline}" stroke-width="2" paint-order="stroke"` : "";
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">` +
    `<g fill="${fill}"${stroke}>${SHAPES[p]}</g>` +
    `<text x="12" y="16.2" text-anchor="middle" font-size="12.5" font-weight="700" ` +
    `font-family="'Barlow Semi Condensed', Barlow, sans-serif" fill="${inkOn(fill)}">${p}</text></svg>`
  );
}

/** Autoserviso ženkliukas: mažas veržliaraktis rašalo apskritime (antrinis, nekonkuruoja su prioritetu). */
export const WRENCH_PATH = "M12.6 3.2a3.6 3.6 0 0 0-3.4 4.8l-5.6 5.6a1.5 1.5 0 0 0 2.1 2.1l5.6-5.6a3.6 3.6 0 0 0 4.8-3.4l-2.1 2.1-2.3-.6-.6-2.3z";
export function wrenchBadgeSvg(size: number): string {
  return (
    `<svg viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true" focusable="false">` +
    `<circle cx="10" cy="10" r="9.2" fill="#1c211e" stroke="#ffffff" stroke-width="1.6"/>` +
    `<g transform="translate(2.2 2.2) scale(0.78)"><path d="${WRENCH_PATH}" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`
  );
}
