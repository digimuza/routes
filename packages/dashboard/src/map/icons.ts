import L from "leaflet";
import type { Priority } from "@marsrutai/shared";
import { priorityMarkSvg } from "../lib/marks";
import { inkOn } from "../lib/palette";

const cache = new Map<string, L.DivIcon>();
function cached(key: string, make: () => L.DivIcon): L.DivIcon {
  let i = cache.get(key);
  if (!i) cache.set(key, (i = make()));
  return i;
}

export type MarkState = "normal" | "hover" | "selected";

export const packageIcon = (p: Priority, state: MarkState = "normal") =>
  cached(`pkg|${p}|${state}`, () => {
    const size = state === "normal" ? 22 : 28;
    return L.divIcon({
      className: `mk mk--pkg mk--${state}`,
      html: priorityMarkSvg(p, size, "#ffffff"),
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  });

export const stopIcon = (color: string, seq: number, emphasis: "normal" | "hover" | "dim" = "normal") =>
  cached(`stop|${color}|${seq}|${emphasis}`, () => {
    const size = emphasis === "hover" ? 28 : 24;
    return L.divIcon({
      className: `mk mk--stop mk--${emphasis}`,
      html: `<span class="stop-dot" style="background:${color};color:${inkOn(color)};width:${size}px;height:${size}px">${seq}</span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  });

export const skippedIcon = () =>
  cached("skipped", () =>
    L.divIcon({
      className: "mk mk--skipped",
      html:
        '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffffff" stroke="#1c211e" stroke-width="2"/>' +
        '<path d="M8 8l8 8M16 8l-8 8" stroke="#1c211e" stroke-width="2.2" stroke-linecap="round"/></svg>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -11],
    }),
  );

export const depotIcon = () =>
  cached("depot", () =>
    L.divIcon({
      className: "mk mk--depot",
      html:
        '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><rect x="1.5" y="1.5" width="29" height="29" rx="3" fill="#1c211e" stroke="#fff" stroke-width="2"/>' +
        '<path d="M8 15.5 16 9l8 6.5V23h-5.2v-5h-5.6v5H8z" fill="#fff"/></svg>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    }),
  );

/** Naujo paketo taškas: geodezinis kryželis. */
export const draftIcon = () =>
  cached("draft", () =>
    L.divIcon({
      className: "mk mk--draft",
      html:
        '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">' +
        '<circle cx="20" cy="20" r="9" fill="none" stroke="#fff" stroke-width="5"/>' +
        '<circle cx="20" cy="20" r="9" fill="none" stroke="#1d5d8f" stroke-width="2.4"/>' +
        '<path d="M20 2v10M20 28v10M2 20h10M28 20h10" stroke="#fff" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M20 2v10M20 28v10M2 20h10M28 20h10" stroke="#1d5d8f" stroke-width="2.4" stroke-linecap="round"/></svg>',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    }),
  );
