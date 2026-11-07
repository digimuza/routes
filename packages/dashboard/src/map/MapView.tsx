import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, ScaleControl, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { City, Courier, Depot, LatLng, Package, Plan, Route } from "@marsrutai/shared";
import { makeTimeFormatter, type PlanIndex } from "../format";
import { depotIcon, draftIcon, packageIcon, skippedIcon, stopIcon } from "./icons";
import { CursorReadout, Neatline } from "./Neatline";
import { SkippedPopup, StopPopup } from "./StopPopup";

export type FocusRequest =
  | { kind: "courier"; id: string; n: number }
  | { kind: "package"; id: string; n: number }
  | { kind: "plan"; n: number }
  | { kind: "packages"; n: number };

type LL = [number, number];
const ll = (p: LatLng): LL => [p.lat, p.lng];

export interface MapViewProps {
  city: City;
  depot: Depot;
  view: "scenario" | "plan";
  packages: Package[];
  selectedPackageId: string | null;
  hoveredPackageId: string | null;
  draft: LatLng | null;
  onMapClick: (p: LatLng) => void;
  onPackageClick: (id: string) => void;
  onPackageMove: (id: string, p: LatLng) => void;
  onDraftMove: (p: LatLng) => void;
  onPackageHover: (id: string | null) => void;
  plan: Plan | null;
  index: PlanIndex | null;
  stale: boolean;
  hidden: Set<string>;
  hoveredCourier: string | null;
  focus: FocusRequest | null;
}

function routeLine(route: Route, depot: LatLng, index: PlanIndex): LL[] {
  if (route.path && route.path.length > 1) return route.path;
  const pts: LL[] = [ll(depot)];
  for (const s of route.stops) {
    const p = index.packages.get(s.packageId);
    if (p) pts.push(ll(p.location));
  }
  pts.push(ll(depot));
  return pts;
}

function Controller({ city, focus, lines, packages, plan, index }: {
  city: City;
  focus: FocusRequest | null;
  lines: Map<string, LL[]>;
  packages: Package[];
  plan: Plan | null;
  index: PlanIndex | null;
}) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    const b = L.latLngBounds(city.bounds);
    if (first.current) map.fitBounds(b, { animate: false });
    else map.flyToBounds(b, { duration: 0.9 });
    first.current = false;
  }, [map, city.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focus) return;
    const fit = (pts: LL[], pad = 60) => {
      if (pts.length > 1) map.flyToBounds(L.latLngBounds(pts), { padding: [pad, pad], duration: 0.6, maxZoom: 16 });
    };
    if (focus.kind === "courier") fit(lines.get(focus.id) ?? []);
    if (focus.kind === "plan") fit([...lines.values()].flat().concat(plan && index ? plan.skipped.flatMap((s) => {
      const p = index.packages.get(s.packageId);
      return p ? [ll(p.location)] : [];
    }) : []), 40);
    if (focus.kind === "packages") fit(packages.map((p) => ll(p.location)), 40);
    if (focus.kind === "package") {
      const p = packages.find((x) => x.id === focus.id);
      if (p) map.flyTo(ll(p.location), Math.max(map.getZoom(), 15), { duration: 0.5 });
    }
  }, [map, focus]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Redaguojamas taškas neturi likti po inspektoriumi (dešinėje). */
function KeepVisible({ point }: { point: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    map.panInside([point.lat, point.lng], { paddingTopLeft: [60, 60], paddingBottomRight: [460, 60] });
  }, [map, point?.lat, point?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickLayer({ enabled, onClick }: { enabled: boolean; onClick: (p: LatLng) => void }) {
  const map = useMapEvents({
    click: (e) => {
      if (enabled) onClick({ lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) });
    },
  });
  useEffect(() => {
    map.getContainer().classList.toggle("map--placing", enabled);
  }, [map, enabled]);
  return null;
}

function RoutePolyline({ positions, color, highlighted, dimmed, stale }: {
  positions: LL[];
  color: string;
  highlighted: boolean;
  dimmed: boolean;
  stale: boolean;
}) {
  const ref = useRef<L.Polyline>(null);
  useEffect(() => {
    if (highlighted) ref.current?.bringToFront();
  }, [highlighted]);
  return (
    <>
      {/* balta „užlieja“ po linija – kad ji skaitytųsi ant bet kokio pagrindo */}
      {!stale && (
        <Polyline
          positions={positions}
          interactive={false}
          pathOptions={{ color: "#ffffff", weight: highlighted ? 10 : 7, opacity: dimmed ? 0.2 : 0.85, lineJoin: "round", lineCap: "round" }}
        />
      )}
      <Polyline
        ref={ref}
        positions={positions}
        interactive={false}
        pathOptions={{
          color,
          weight: stale ? 3 : highlighted ? 6 : 4,
          opacity: stale ? 0.4 : dimmed ? 0.2 : 1,
          dashArray: stale ? "6 8" : undefined,
          lineJoin: "round",
          lineCap: "round",
        }}
      />
    </>
  );
}

export function MapView(props: MapViewProps) {
  const { city, depot, view, packages, plan, index, stale, hidden, hoveredCourier, focus } = props;
  const [neatHost, setNeatHost] = useState<HTMLDivElement | null>(null);
  const [readoutHost, setReadoutHost] = useState<HTMLDivElement | null>(null);
  const fmtTime = useMemo(() => makeTimeFormatter(depot.timezone), [depot.timezone]);

  const lines = useMemo(() => {
    const m = new Map<string, LL[]>();
    if (plan && index)
      for (const r of plan.routes) if (r.stops.length > 0) m.set(r.courierId, routeLine(r, plan.dataset.depot.location, index));
    return m;
  }, [plan, index]);

  const visible: { courier: Courier; route: Route }[] = [];
  if (view === "plan" && plan && index)
    for (const c of plan.dataset.couriers) {
      const r = index.routes.get(c.id);
      if (r && r.stops.length > 0 && !hidden.has(c.id)) visible.push({ courier: c, route: r });
    }
  const hoverActive = hoveredCourier != null && !hidden.has(hoveredCourier);
  const placing = view === "scenario";

  return (
    <div className="mapframe">
      <div className="mapframe__inner">
        <MapContainer center={ll(city.center)} zoom={city.zoom} className="map" zoomControl={false} attributionControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> bendraautoriai'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <ScaleControl position="bottomright" imperial={false} />
          <ZoomButtons />
          <Controller city={city} focus={focus} lines={lines} packages={packages} plan={plan} index={index} />
          <ClickLayer enabled={placing} onClick={props.onMapClick} />
          <KeepVisible
            point={view === "scenario" ? props.draft ?? packages.find((p) => p.id === props.selectedPackageId)?.location ?? null : null}
          />
          <Neatline host={neatHost} />
          <CursorReadout host={readoutHost} hint={placing ? (props.draft ? "Spustelėkite, kad perkeltumėte tašką" : "Spustelėkite žemėlapį – naujas paketas") : null} />

          {view === "scenario" &&
            packages.map((p) => {
              const selected = p.id === props.selectedPackageId;
              const hovered = p.id === props.hoveredPackageId;
              return (
                <Marker
                  key={p.id}
                  position={ll(p.location)}
                  icon={packageIcon(p.priority, selected ? "selected" : hovered ? "hover" : "normal")}
                  zIndexOffset={selected ? 1500 : hovered ? 1200 : (3 - p.priority) * 100}
                  draggable={selected}
                  keyboard
                  title={`${p.id}, ${p.recipient}`}
                  eventHandlers={{
                    click: () => props.onPackageClick(p.id),
                    mouseover: () => props.onPackageHover(p.id),
                    mouseout: () => props.onPackageHover(null),
                    dragend: (e) => {
                      const m = (e.target as L.Marker).getLatLng();
                      props.onPackageMove(p.id, { lat: +m.lat.toFixed(5), lng: +m.lng.toFixed(5) });
                    },
                  }}
                >
                  {!selected && (
                    <Tooltip direction="top" offset={[0, -12]} className="tip">
                      <strong>{p.id}</strong> {p.recipient} · {p.window.start}–{p.window.end}
                    </Tooltip>
                  )}
                </Marker>
              );
            })}

          {view === "scenario" && props.draft && (
            <Marker
              position={ll(props.draft)}
              icon={draftIcon()}
              draggable
              zIndexOffset={2500}
              eventHandlers={{
                dragend: (e) => {
                  const m = (e.target as L.Marker).getLatLng();
                  props.onDraftMove({ lat: +m.lat.toFixed(5), lng: +m.lng.toFixed(5) });
                },
              }}
            />
          )}

          {visible.map(({ courier }) => (
            <RoutePolyline
              key={courier.id}
              positions={lines.get(courier.id)!}
              color={courier.color}
              highlighted={hoveredCourier === courier.id}
              dimmed={hoverActive && hoveredCourier !== courier.id}
              stale={stale}
            />
          ))}

          {index &&
            visible.map(({ courier, route }) => {
              const dim = stale || (hoverActive && hoveredCourier !== courier.id);
              return route.stops.map((s) => {
                const p = index.packages.get(s.packageId);
                if (!p) return null;
                return (
                  <Marker
                    key={`${courier.id}-${s.packageId}`}
                    position={ll(p.location)}
                    icon={stopIcon(courier.color, s.seq, hoveredCourier === courier.id ? "hover" : "normal")}
                    opacity={dim ? (stale ? 0.45 : 0.3) : 1}
                    zIndexOffset={hoveredCourier === courier.id ? 1000 : 0}
                  >
                    <Popup maxWidth={320}>
                      <StopPopup stop={s} pkg={p} courier={courier} fmtTime={fmtTime} stale={stale} />
                    </Popup>
                  </Marker>
                );
              });
            })}

          {view === "plan" &&
            plan &&
            index &&
            plan.skipped.map((s) => {
              const p = index.packages.get(s.packageId);
              if (!p) return null;
              return (
                <Marker key={`skip-${s.packageId}`} position={ll(p.location)} icon={skippedIcon()} opacity={stale || hoverActive ? 0.45 : 1}>
                  <Popup maxWidth={320}>
                    <SkippedPopup pkg={p} reason={s.reason} />
                  </Popup>
                </Marker>
              );
            })}

          <Marker position={ll(depot.location)} icon={depotIcon()} zIndexOffset={3000}>
            <Popup>
              <div className="popup">
                <div className="popup__head">
                  <span className="popup__id">{depot.name}</span>
                </div>
                <div className="popup__addr">{depot.address}</div>
                <div className="popup__muted">
                  Darbo laikas {depot.open}–{depot.close} · {depot.date}
                </div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
        <div className="readout-host" ref={setReadoutHost} />
      </div>
      <div className="neat-host" ref={setNeatHost} />
    </div>
  );
}

function ZoomButtons() {
  const map = useMap();
  const ref = (el: HTMLDivElement | null) => {
    if (el) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);
    }
  };
  return (
    <div className="zoom" ref={ref}>
      <button type="button" className="zoom__btn" aria-label="Priartinti" onClick={() => map.zoomIn()}>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
      <button type="button" className="zoom__btn" aria-label="Nutolinti" onClick={() => map.zoomOut()}>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
