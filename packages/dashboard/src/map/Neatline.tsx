import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMap, useMapEvents } from "react-leaflet";

/**
 * Topografinio lapo rėmelis: graduota juodai-balta juosta aplink žemėlapį su koordinačių
 * žymomis paraštėse. Atsinaujina judinant ir keičiant mastelį.
 */
const STEPS = [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];

interface Tick {
  v: number;
  px: number;
  dark: boolean;
}

function ticks(min: number, max: number, target: number, toPx: (v: number) => number) {
  const step = STEPS.find((s) => (max - min) / s <= target) ?? 1;
  const out: Tick[] = [];
  const first = Math.floor(min / step);
  for (let k = first; k * step <= max + step; k++) {
    out.push({ v: k * step, px: toPx(k * step), dark: k % 2 === 0 });
  }
  return { step, ticks: out };
}

const decimals = (step: number) => Math.max(2, Math.ceil(-Math.log10(step)));

export function Neatline({ host }: { host: HTMLElement | null }) {
  const map = useMap();
  const [, setTick] = useState(0);
  useMapEvents({ move: () => setTick((n) => n + 1), zoom: () => setTick((n) => n + 1), resize: () => setTick((n) => n + 1) });
  useEffect(() => {
    // pirmas piešimas, kai konteineris jau turi dydį
    const t = window.setTimeout(() => setTick((n) => n + 1), 0);
    return () => window.clearTimeout(t);
  }, []);
  if (!host) return null;

  const size = map.getSize();
  if (size.x === 0 || size.y === 0) return null;
  const b = map.getBounds();
  const toX = (v: number) => map.latLngToContainerPoint([b.getCenter().lat, v]).x;
  const toY = (v: number) => map.latLngToContainerPoint([v, b.getCenter().lng]).y;
  // žymos (su skaičiais) retesnės, graduotos juostos segmentai – smulkesni
  const lng = ticks(b.getWest(), b.getEast(), Math.max(4, size.x / 130), toX);
  const lat = ticks(b.getSouth(), b.getNorth(), Math.max(3, size.y / 120), toY);
  const lngBand = ticks(b.getWest(), b.getEast(), Math.max(12, size.x / 38), toX);
  const latBand = ticks(b.getSouth(), b.getNorth(), Math.max(10, size.y / 38), toY);

  const segs = (list: Tick[], max: number) =>
    list.slice(0, -1).map((t, i) => {
      const a = Math.max(0, Math.min(t.px, list[i + 1].px));
      const z = Math.min(max, Math.max(t.px, list[i + 1].px));
      return z > a ? { a, len: z - a, dark: t.dark } : null;
    });

  const lngSegs = segs(lngBand.ticks, size.x);
  const latSegs = segs(latBand.ticks, size.y);
  const dLng = decimals(lng.step);
  const dLat = decimals(lat.step);
  const inX = (t: Tick) => t.px > 24 && t.px < size.x - 24;
  const inY = (t: Tick) => t.px > 24 && t.px < size.y - 24;

  return createPortal(
    <div className="neat" aria-hidden="true" style={{ width: size.x, height: size.y }}>
      {(["top", "bottom"] as const).map((side) => (
        <div key={side} className={`neat__band neat__band--${side}`}>
          {lngSegs.map((s, i) => s && s.dark && <i key={i} style={{ left: s.a, width: s.len }} />)}
        </div>
      ))}
      {(["left", "right"] as const).map((side) => (
        <div key={side} className={`neat__band neat__band--${side}`}>
          {latSegs.map((s, i) => s && s.dark && <i key={i} style={{ top: s.a, height: s.len }} />)}
        </div>
      ))}
      {lng.ticks.filter(inX).map((t) => (
        <span key={`t${t.v}`} className="neat__label neat__label--top" style={{ left: t.px }}>
          {t.v.toFixed(dLng)}°
        </span>
      ))}
      {lng.ticks.filter(inX).map((t) => (
        <span key={`b${t.v}`} className="neat__label neat__label--bottom" style={{ left: t.px }}>
          {t.v.toFixed(dLng)}°
        </span>
      ))}
      {lat.ticks.filter(inY).map((t) => (
        <span key={`l${t.v}`} className="neat__label neat__label--left" style={{ top: t.px }}>
          {t.v.toFixed(dLat)}°
        </span>
      ))}
      {lat.ticks.filter(inY).map((t) => (
        <span key={`r${t.v}`} className="neat__label neat__label--right" style={{ top: t.px }}>
          {t.v.toFixed(dLat)}°
        </span>
      ))}
    </div>,
    host,
  );
}

/** Žymeklio koordinatės (apatinė paraštė): tai, kas taps naujo paketo adresu. */
export function CursorReadout({ host, hint }: { host: HTMLElement | null; hint: string | null }) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  useMapEvents({
    mousemove: (e) => setPos(e.latlng),
    mouseout: () => setPos(null),
  });
  if (!host || (!pos && !hint)) return null;
  return createPortal(
    <div className="readout" aria-live="off">
      {pos ? (
        <>
          <span className="readout__coord">
            {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
          </span>
          {hint && <span className="readout__hint">{hint}</span>}
        </>
      ) : (
        <span className="readout__hint">{hint ?? " "}</span>
      )}
    </div>,
    host,
  );
}
