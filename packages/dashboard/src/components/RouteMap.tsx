import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { Courier, LatLng, Plan, Route } from "@marsrutai/shared";
import { makeTimeFormatter, type PlanIndex } from "../format";
import { SkippedPopup, StopPopup } from "./StopPopup";

export interface FocusRequest {
  courierId: string;
  /** Unikalus skaitiklis, kad tas pats kurjeris galėtų būti fokusuojamas pakartotinai. */
  n: number;
}

interface Props {
  plan: Plan;
  index: PlanIndex;
  hidden: Set<string>;
  hovered: string | null;
  focus: FocusRequest | null;
  /** Pasikeitus (po perkrovimo) – iš naujo fitBounds į viską. */
  fitNonce: number;
}

type LL = [number, number];
const ll = (p: LatLng): LL => [p.lat, p.lng];

// ---------- ikonos ----------
const iconCache = new Map<string, L.DivIcon>();
function cached(key: string, make: () => L.DivIcon): L.DivIcon {
  let i = iconCache.get(key);
  if (!i) iconCache.set(key, (i = make()));
  return i;
}

const stopIcon = (color: string, seq: number) =>
  cached(`s|${color}|${seq}`, () =>
    L.divIcon({
      className: "",
      html: `<div class="stop-icon" style="background:${color}">${seq}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    }),
  );

const skippedIcon = () =>
  cached("skipped", () =>
    L.divIcon({
      className: "",
      html: `<div class="skipped-icon">×</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -11],
    }),
  );

const depotIcon = () =>
  cached("depot", () =>
    L.divIcon({
      className: "",
      html: `<div class="depot-icon"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 3 2 12h3v8h5v-6h4v6h5v-8h3z"/></svg></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -17],
    }),
  );

// ---------- geometrija ----------
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

function FitController({ plan, index, focus, fitNonce, lines }: {
  plan: Plan;
  index: PlanIndex;
  focus: FocusRequest | null;
  fitNonce: number;
  lines: Map<string, LL[]>;
}) {
  const map = useMap();

  // visko apimtis: sandėlis, maršrutai, nepristatyti paketai
  useEffect(() => {
    const pts: LL[] = [ll(plan.dataset.depot.location)];
    for (const line of lines.values()) pts.push(...line);
    for (const s of plan.skipped) {
      const p = index.packages.get(s.packageId);
      if (p) pts.push(ll(p.location));
    }
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], animate: false });
    // tik pirmą kartą ir po perkrovimo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitNonce]);

  useEffect(() => {
    if (!focus) return;
    const line = lines.get(focus.courierId);
    if (line && line.length > 1) map.flyToBounds(L.latLngBounds(line), { padding: [60, 60], duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focus]);

  return null;
}

function RoutePolyline({ positions, color, highlighted, dimmed }: {
  positions: LL[];
  color: string;
  highlighted: boolean;
  dimmed: boolean;
}) {
  const ref = useRef<L.Polyline>(null);
  useEffect(() => {
    if (highlighted) ref.current?.bringToFront();
  }, [highlighted]);
  return (
    <Polyline
      ref={ref}
      positions={positions}
      pathOptions={{
        color,
        weight: highlighted ? 7 : 4,
        opacity: dimmed ? 0.25 : highlighted ? 1 : 0.8,
        lineJoin: "round",
        lineCap: "round",
      }}
    />
  );
}

export function RouteMap({ plan, index, hidden, hovered, focus, fitNonce }: Props) {
  const depot = plan.dataset.depot;
  const fmtTime = useMemo(() => makeTimeFormatter(depot.timezone), [depot.timezone]);

  const lines = useMemo(() => {
    const m = new Map<string, LL[]>();
    for (const r of plan.routes) if (r.stops.length > 0) m.set(r.courierId, routeLine(r, depot.location, index));
    return m;
  }, [plan, index, depot.location]);

  const visible: { courier: Courier; route: Route }[] = [];
  for (const c of plan.dataset.couriers) {
    const r = index.routes.get(c.id);
    if (r && r.stops.length > 0 && !hidden.has(c.id)) visible.push({ courier: c, route: r });
  }
  const hoverActive = hovered != null && !hidden.has(hovered);

  return (
    <MapContainer center={ll(depot.location)} zoom={12} className="map" preferCanvas={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> bendraautoriai'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitController plan={plan} index={index} focus={focus} fitNonce={fitNonce} lines={lines} />

      {visible.map(({ courier }) => (
        <RoutePolyline
          key={courier.id}
          positions={lines.get(courier.id)!}
          color={courier.color}
          highlighted={hovered === courier.id}
          dimmed={hoverActive && hovered !== courier.id}
        />
      ))}

      {visible.map(({ courier, route }) => {
        const dim = hoverActive && hovered !== courier.id;
        return route.stops.map((s) => {
          const p = index.packages.get(s.packageId);
          if (!p) return null;
          return (
            <Marker
              key={`${courier.id}-${s.packageId}`}
              position={ll(p.location)}
              icon={stopIcon(courier.color, s.seq)}
              opacity={dim ? 0.3 : 1}
              zIndexOffset={hovered === courier.id ? 1000 : 0}
            >
              <Popup>
                <StopPopup stop={s} pkg={p} courier={courier} fmtTime={fmtTime} />
              </Popup>
            </Marker>
          );
        });
      })}

      {plan.skipped.map((s) => {
        const p = index.packages.get(s.packageId);
        if (!p) return null;
        return (
          <Marker key={`skip-${s.packageId}`} position={ll(p.location)} icon={skippedIcon()} opacity={hoverActive ? 0.4 : 1}>
            <Popup>
              <SkippedPopup pkg={p} reason={s.reason} />
            </Popup>
          </Marker>
        );
      })}

      <Marker position={ll(depot.location)} icon={depotIcon()} zIndexOffset={2000}>
        <Popup>
          <div className="popup">
            <div className="popup__title">{depot.name}</div>
            <div>{depot.address}</div>
            <div className="muted">
              Darbo laikas {depot.open}–{depot.close}
            </div>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
