import { useCallback, useEffect, useMemo, useState } from "react";
import { loadPlan, PlanLoadError, type LoadedPlan } from "./api";
import { indexPlan } from "./format";
import { Summary } from "./components/Summary";
import { CourierList } from "./components/CourierList";
import { SkippedList } from "./components/SkippedList";
import { RouteMap, type FocusRequest } from "./components/RouteMap";
import { ErrorPanel } from "./components/ErrorPanel";

export function App() {
  const [loaded, setLoaded] = useState<LoadedPlan | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadPlan();
      setLoaded(res);
      setError(null);
      setFocus(null);
      setReloadNonce((n) => n + 1);
      // paslėptus kurjerius, kurių nebėra naujame plane, išmetam
      const ids = new Set(res.plan.dataset.couriers.map((c) => c.id));
      setHidden((prev) => new Set([...prev].filter((id) => ids.has(id))));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const plan = loaded?.plan ?? null;
  const index = useMemo(() => (plan ? indexPlan(plan) : null), [plan]);

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const isolate = (id: string) => {
    if (!plan) return;
    setHidden(new Set(plan.dataset.couriers.map((c) => c.id).filter((c) => c !== id)));
    setFocus({ courierId: id, n: Date.now() });
  };
  const showAll = () => setHidden(new Set());
  const focusCourier = (id: string) => setFocus({ courierId: id, n: Date.now() });

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar__header">
          <div>
            <h1>Kurjerių maršrutai</h1>
            {plan && <div className="muted">{plan.dataset.depot.name}</div>}
          </div>
          <button className="btn" onClick={() => void reload()} disabled={loading} title="Iš naujo nuskaityti plan.json">
            {loading ? "Kraunama…" : "↻ Perkrauti"}
          </button>
        </header>

        {loaded?.source === "sample" && (
          <div className="banner banner--warn">
            <strong>Rodomi pavyzdiniai duomenys.</strong> Failas <code>out/plan.json</code> dar nesugeneruotas –
            paleiskite <code>npm run demo -- --mock</code> ir spauskite „Perkrauti“.
          </div>
        )}
        {error != null && plan && (
          <div className="banner banner--error">
            Nepavyko perkrauti: {error instanceof Error ? error.message : String(error)} Rodomas ankstesnis planas.
          </div>
        )}

        {plan && index && (
          <>
            <Summary plan={plan} />
            <CourierList
              plan={plan}
              index={index}
              hidden={hidden}
              hovered={hovered}
              onToggle={toggle}
              onIsolate={isolate}
              onShowAll={showAll}
              onHover={setHovered}
              onFocus={focusCourier}
            />
            <SkippedList plan={plan} index={index} />
          </>
        )}
        {!plan && loading && <div className="muted pad">Kraunamas planas…</div>}
        {!plan && !loading && error != null && <ErrorPanel error={error} />}
      </aside>

      <main className="map-wrap">
        {plan && index ? (
          <RouteMap
            key={loaded?.url}
            plan={plan}
            index={index}
            hidden={hidden}
            hovered={hovered}
            focus={focus}
            fitNonce={reloadNonce}
          />
        ) : (
          <div className="map-placeholder">
            {error instanceof PlanLoadError ? "Nėra plano rodymui" : loading ? "Kraunama…" : ""}
          </div>
        )}
      </main>
    </div>
  );
}
