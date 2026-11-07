import { useCallback, useEffect, useMemo, useState } from "react";
import { walkMinutesOf, type Courier, type LatLng, type Package } from "@marsrutai/shared";
import { api, errorMessage } from "./api";
import { fmtNum, indexPlan } from "./format";
import { useWorkspace, type OptimizeMode } from "./state/useWorkspace";
import { fmtLatLng, freshCourierName, nextCourierId, nextPackageId, randomPhone, randomRecipient } from "./lib/names";
import { displayColors, nextCourierColor } from "./lib/palette";
import { TopBar } from "./components/TopBar";
import { PackagesPanel, type GenerateOptions } from "./components/PackagesPanel";
import { CouriersPanel } from "./components/CouriersPanel";
import { PlanPanel } from "./components/PlanPanel";
import { CourierInspector, PackageInspector } from "./components/Inspector";
import { ServerDown } from "./components/ServerDown";
import { Icon } from "./components/Icon";
import { DownloadToast } from "./components/DownloadToast";
import { downloadPdfsSeparately, type DownloadProgress } from "./lib/downloads";
import { MapView, type FocusRequest } from "./map/MapView";

type Tab = "packages" | "couriers" | "plan";
type Selection =
  | { kind: "package"; id: string }
  | { kind: "draft"; pkg: Package }
  | { kind: "courier"; id: string }
  | { kind: "newCourier"; courier: Courier }
  | null;

const MODE_KEY = "marsrutai:mode";

export function App() {
  const ws = useWorkspace();
  const { scenario, city, result, stale } = ws;
  const [tab, setTab] = useState<Tab>("packages");
  const [mode, setMode] = useState<OptimizeMode>(() => (localStorage.getItem(MODE_KEY) === "mock" ? "mock" : "api"));
  const [sel, setSel] = useState<Selection>(null);
  const [hoverPkg, setHoverPkg] = useState<string | null>(null);
  const [hoverCourier, setHoverCourier] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  /** Pasirinktas kurjeris plane (tik jo maršrutas paryškintas). */
  const [routeSel, setRouteSel] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [dl, setDl] = useState<DownloadProgress | null>(null);
  const closeDl = useCallback(() => setDl((d) => (d && !d.finished ? d : null)), []);
  const downloadAll = async () => {
    if (!result || (dl && !dl.finished)) return;
    await downloadPdfsSeparately(result, setDl);
  };

  useEffect(() => localStorage.setItem(MODE_KEY, mode), [mode]);

  // naujas miestas – švari būsena
  useEffect(() => {
    setSel(null);
    setHidden(new Set());
    setRouteSel(null);
    setHoverPkg(null);
    setHoverCourier(null);
    setGenerateError(null);
  }, [ws.cityId]);

  // Rodymo spalvos: serverio priskirtos spalvos, kurios painiojasi su prioritetų ar veiksmo spalvomis,
  // žemėlapyje ir sąrašuose pakeičiamos paletės spalvomis (duomenys nekeičiami).
  const colorMap = useMemo(() => {
    const list = [...(scenario?.couriers ?? [])];
    for (const c of result?.plan.dataset.couriers ?? []) if (!list.some((x) => x.id === c.id)) list.push(c);
    return displayColors(list);
  }, [scenario?.couriers, result]);
  const recolor = useCallback(<T extends { id: string; color: string }>(c: T): T => {
    const col = colorMap.get(c.id);
    return col && col !== c.color ? { ...c, color: col } : c;
  }, [colorMap]);
  const plan = useMemo(() => {
    const p = result?.plan;
    if (!p) return null;
    return { ...p, dataset: { ...p.dataset, couriers: p.dataset.couriers.map(recolor) } };
  }, [result, recolor]);
  const displayResult = useMemo(() => (result && plan ? { ...result, plan } : null), [result, plan]);
  const index = useMemo(() => (plan ? indexPlan(plan) : null), [plan]);
  // Kurjerių skirtuke, kai planas yra, žemėlapis rodo maršrutus (kurjerį galima pasirinkti)
  const view = tab === "plan" || (tab === "couriers" && plan) ? "plan" : "scenario";

  const packages = scenario?.packages ?? [];
  const couriers = useMemo(() => (scenario?.couriers ?? []).map(recolor), [scenario?.couriers, recolor]);

  const assigned = useMemo(() => {
    if (!index || stale) return null;
    const m = new Map<string, { color: string; seq: number; name: string }>();
    for (const [pid, s] of index.stopOf) {
      const c = index.couriers.get(s.courierId)?.courier;
      if (c) m.set(pid, { color: c.color, seq: s.seq, name: c.name });
    }
    return m;
  }, [index, stale]);

  const disabledReason = !scenario
    ? "Kraunamas scenarijus"
    : packages.length === 0
      ? "Scenarijuje nėra paketų"
      : couriers.length === 0
        ? "Scenarijuje nėra kurjerių"
        : null;

  // ---------- paketai ----------
  const onMapClick = useCallback(
    (p: LatLng) => {
      if (!scenario) return;
      setSel((cur) => {
        if (cur?.kind === "draft") return { kind: "draft", pkg: { ...cur.pkg, location: p } };
        return {
          kind: "draft",
          pkg: {
            id: nextPackageId(scenario.packages),
            recipient: randomRecipient(),
            recipientType: "person",
            address: fmtLatLng(p.lat, p.lng),
            location: p,
            priority: 2,
            window: { start: "09:00", end: "13:00" },
            weightKg: 5,
            serviceMinutes: 5,
          },
        };
      });
    },
    [scenario],
  );

  const savePackage = (pkg: Package, isNew: boolean) => {
    ws.update((d) => ({
      ...d,
      packages: isNew ? [...d.packages, pkg] : d.packages.map((x) => (x.id === pkg.id ? pkg : x)),
    }));
    setSel(null);
  };

  const deletePackage = (id: string) => {
    ws.update((d) => ({ ...d, packages: d.packages.filter((x) => x.id !== id) }));
    setSel(null);
  };

  const movePackage = (id: string, loc: LatLng) =>
    ws.update((d) => ({
      ...d,
      packages: d.packages.map((x) =>
        x.id === id
          ? { ...x, location: loc, address: x.address === fmtLatLng(x.location.lat, x.location.lng) ? fmtLatLng(loc.lat, loc.lng) : x.address }
          : x,
      ),
    }));

  const generate = async (o: GenerateOptions) => {
    if (!ws.cityId || !scenario) return false;
    setGenerating(true);
    setGenerateError(null);
    try {
      const fresh = await api.generate({
        city: ws.cityId,
        count: o.count,
        mix: o.mix,
        autoservicePct: o.autoservicePct,
        existingIds: o.replace ? [] : scenario.packages.map((p) => p.id),
      });
      ws.update((d) => ({ ...d, packages: o.replace ? fresh : [...d.packages, ...fresh] }));
      setSel(null);
      setFocus({ kind: "packages", n: Date.now() });
      return true;
    } catch (e) {
      setGenerateError(errorMessage(e));
      return false;
    } finally {
      setGenerating(false);
    }
  };

  // ---------- kurjeriai ----------
  const addCourier = () => {
    if (!scenario) return;
    setTab("couriers");
    setSel({
      kind: "newCourier",
      courier: {
        id: nextCourierId(scenario.couriers),
        name: freshCourierName(scenario.couriers),
        phone: randomPhone(),
        vehicle: "Furgonas",
        capacityKg: 120,
        shiftStart: scenario.depot.open,
        shiftEnd: scenario.depot.close,
        costPerHour: 12,
        costPerKm: 0.3,
        color: nextCourierColor(couriers),
      },
    });
  };
  const saveCourier = (c: Courier, isNew: boolean) => {
    ws.update((d) => ({ ...d, couriers: isNew ? [...d.couriers, c] : d.couriers.map((x) => (x.id === c.id ? c : x)) }));
    setSel(null);
  };
  const deleteCourier = (id: string) => {
    ws.update((d) => ({ ...d, couriers: d.couriers.filter((x) => x.id !== id) }));
    setSel(null);
  };

  // ---------- planas ----------
  const optimize = async () => {
    setSel(null);
    const res = await ws.optimize(mode);
    if (res) {
      setHidden(new Set());
      setRouteSel(null);
      setTab("plan");
      setFocus({ kind: "plan", n: Date.now() });
    }
  };
  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectRoute = (id: string) => {
    if (routeSel === id) {
      setRouteSel(null);
      setFocus({ kind: "plan", n: Date.now() });
      return;
    }
    setRouteSel(id);
    setHidden((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setFocus({ kind: "courier", id, n: Date.now() });
  };
  const showAllRoutes = () => {
    setRouteSel(null);
    setHidden(new Set());
    setFocus({ kind: "plan", n: Date.now() });
  };
  const stopCounts = useMemo(() => new Map((plan?.routes ?? []).map((r) => [r.courierId, r.stops.length])), [plan]);

  const switchTab = (t: Tab) => {
    setTab(t);
    if (t === "plan") setSel(null);
    if ((t === "plan" || t === "couriers") && plan && !routeSel) setFocus({ kind: "plan", n: Date.now() });
  };

  if (ws.fatal && !scenario) {
    return <ServerDown error={ws.fatal} onRetry={ws.retry} retrying={ws.loading} />;
  }

  const selectedPackage = sel?.kind === "package" ? packages.find((p) => p.id === sel.id) ?? null : null;
  const selectedCourier = sel?.kind === "courier" ? couriers.find((c) => c.id === sel.id) ?? null : null;
  const draft = sel?.kind === "draft" ? sel.pkg : null;

  return (
    <div className="app">
      <TopBar
        cities={ws.cities ?? []}
        cityId={ws.cityId}
        onCity={(id) => void ws.switchCity(id)}
        save={ws.save}
        onRetrySave={() => void ws.flush()}
        mode={mode}
        onMode={setMode}
        run={ws.run}
        canOptimize={disabledReason == null && !ws.loading}
        disabledReason={disabledReason}
        onOptimize={() => void optimize()}
        depotDate={scenario?.depot.date ?? null}
        pdfs={result ? { stale, progress: dl, onDownload: () => void downloadAll() } : null}
      />

      <div className="work">
        <aside className="side" aria-label="Scenarijus ir maršrutai">
          <div className="tabs" role="tablist" aria-label="Rodinys">
            <TabButton id="packages" tab={tab} onSelect={switchTab} label="Paketai" count={packages.length} />
            <TabButton id="couriers" tab={tab} onSelect={switchTab} label="Kurjeriai" count={couriers.length} />
            <span className="tabs__gap" aria-hidden="true" />
            <TabButton
              id="plan"
              tab={tab}
              onSelect={switchTab}
              label="Maršrutai"
              badge={result ? (stale ? <span className="tabbadge tabbadge--stale">pasenęs</span> : <span className="tabbadge">{fmtNum(result.plan.metrics.deliveredCount)}</span>) : null}
            />
          </div>

          {ws.optimizeError && (
            <div className="alert" role="alert">
              <Icon name="alert" size={18} />
              <div>
                <strong>Maršrutų sudaryti nepavyko.</strong> {ws.optimizeError}
              </div>
              <button type="button" className="iconbtn" aria-label="Uždaryti pranešimą" onClick={ws.dismissOptimizeError}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}

          <div className="side__body" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {!scenario ? (
              <SidebarSkeleton />
            ) : tab === "packages" ? (
              <PackagesPanel
                key={ws.cityId}
                packages={packages}
                cityName={city?.name ?? ""}
                generating={generating}
                generateError={generateError}
                onGenerate={generate}
                onClear={() => {
                  ws.update((d) => ({ ...d, packages: [] }));
                  setSel(null);
                }}
                selectedId={sel?.kind === "package" ? sel.id : null}
                hoveredId={hoverPkg}
                onSelect={(id) => {
                  setSel({ kind: "package", id });
                  setFocus({ kind: "package", id, n: Date.now() });
                }}
                onHover={setHoverPkg}
                assigned={assigned}
                walkMinutes={walkMinutesOf(scenario)}
                onWalkMinutes={(m) => ws.update((d) => ({ ...d, settings: { ...d.settings, walkMinutes: m } }))}
              />
            ) : tab === "couriers" ? (
              <CouriersPanel
                couriers={couriers}
                packages={packages}
                selectedId={sel?.kind === "courier" ? sel.id : null}
                onEdit={(id) => setSel({ kind: "courier", id })}
                onAdd={addCourier}
                plan={plan ? { selected: routeSel, onSelect: selectRoute, stops: stopCounts } : null}
              />
            ) : (
              <PlanPanel
                result={displayResult}
                index={index}
                stale={stale}
                hidden={hidden}
                hovered={hoverCourier}
                busy={ws.run != null}
                canOptimize={disabledReason == null}
                selected={routeSel}
                onSelect={selectRoute}
                onToggle={toggle}
                onShowAll={showAllRoutes}
                onHover={setHoverCourier}
                onOptimize={() => void optimize()}
                onFocusPlan={() => setFocus({ kind: "plan", n: Date.now() })}
              />
            )}
          </div>
        </aside>

        <main className="stage">
          {city && scenario ? (
            <MapView
              city={city}
              depot={scenario.depot}
              view={view}
              packages={packages}
              selectedPackageId={sel?.kind === "package" ? sel.id : null}
              hoveredPackageId={hoverPkg}
              draft={draft?.location ?? null}
              onMapClick={(p) => {
                if (tab === "couriers") setTab("packages");
                onMapClick(p);
              }}
              onPackageClick={(id) => {
                setTab("packages");
                setSel({ kind: "package", id });
              }}
              onPackageMove={movePackage}
              onDraftMove={(p) => setSel((cur) => (cur?.kind === "draft" ? { kind: "draft", pkg: { ...cur.pkg, location: p } } : cur))}
              onPackageHover={setHoverPkg}
              plan={plan}
              index={index}
              stale={stale}
              hidden={hidden}
              hoveredCourier={hoverCourier}
              selectedCourier={routeSel}
              onCourierClick={(id) => {
                if (tab !== "plan" && tab !== "couriers") setTab("plan");
                selectRoute(id);
              }}
              onClearCourier={() => {
                if (routeSel) showAllRoutes();
              }}
              focus={focus}
            />
          ) : (
            <div className="stage__loading">
              <span className="spinner" aria-hidden="true" /> Kraunamas žemėlapis…
            </div>
          )}

          {ws.run && (
            <div className="progress" role="status" aria-live="polite">
              <div className="progress__bar" />
              <div className="progress__label">
                {ws.run.mode === "api" ? "Google Route Optimization skaičiuoja maršrutus…" : "Mock optimizatorius skaičiuoja maršrutus…"}
              </div>
            </div>
          )}

          {view === "plan" && stale && (
            <div className="stagebanner" role="status">
              Planas pasenęs: rodomas paskutinis sudarytas planas
            </div>
          )}

          {dl && result && (
            <DownloadToast
              progress={dl}
              zipUrl={result.zipUrl}
              zipFileName={`marsrutai-${ws.cityId}-${result.plan.dataset.depot.date}.zip`}
              onClose={closeDl}
            />
          )}

          {draft && <PackageInspector pkg={draft} isNew onSave={(p) => savePackage(p, true)} onDelete={() => setSel(null)} onClose={() => setSel(null)} />}
          {selectedPackage && (
            <PackageInspector
              pkg={selectedPackage}
              isNew={false}
              onSave={(p) => savePackage(p, false)}
              onDelete={() => deletePackage(selectedPackage.id)}
              onClose={() => setSel(null)}
            />
          )}
          {sel?.kind === "newCourier" && (
            <CourierInspector courier={sel.courier} isNew onSave={(c) => saveCourier(c, true)} onDelete={() => setSel(null)} onClose={() => setSel(null)} />
          )}
          {selectedCourier && (
            <CourierInspector
              courier={selectedCourier}
              isNew={false}
              onSave={(c) => saveCourier(c, false)}
              onDelete={() => deleteCourier(selectedCourier.id)}
              onClose={() => setSel(null)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function TabButton({ id, tab, onSelect, label, count, badge }: {
  id: Tab;
  tab: Tab;
  onSelect: (t: Tab) => void;
  label: string;
  count?: number;
  badge?: React.ReactNode;
}) {
  const on = id === tab;
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={on}
      aria-controls={`panel-${id}`}
      tabIndex={on ? 0 : -1}
      className={`tab${on ? " is-on" : ""}`}
      onClick={() => onSelect(id)}
      onKeyDown={(e) => {
        const order: Tab[] = ["packages", "couriers", "plan"];
        const i = order.indexOf(id);
        const next = e.key === "ArrowRight" ? order[(i + 1) % 3] : e.key === "ArrowLeft" ? order[(i + 2) % 3] : null;
        if (next) {
          onSelect(next);
          document.getElementById(`tab-${next}`)?.focus();
        }
      }}
    >
      {label}
      {count != null && <span className="tabcount num">{fmtNum(count)}</span>}
      {badge}
    </button>
  );
}

function SidebarSkeleton() {
  return (
    <div className="panel" aria-busy="true" aria-label="Kraunama">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skel" style={{ width: `${88 - i * 7}%` }} />
      ))}
    </div>
  );
}
