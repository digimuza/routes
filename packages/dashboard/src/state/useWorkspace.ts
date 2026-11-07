import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { City, CityId, Dataset, OptimizeResponse } from "@marsrutai/shared";
import { api, errorMessage, isServerDown } from "../api";
import { stableStringify } from "../lib/stable";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
export type OptimizeMode = "api" | "mock";

export interface OptimizeRun {
  mode: OptimizeMode;
  startedAt: number;
}

const CITY_KEY = "marsrutai:city";
const SAVE_DEBOUNCE_MS = 600;

/** Scenarijus, autosave, planas ir jo „pasenimas“ vienam pasirinktam miestui. */
export function useWorkspace() {
  const [cities, setCities] = useState<City[] | null>(null);
  const [cityId, setCityId] = useState<CityId | null>(null);
  const [scenario, setScenario] = useState<Dataset | null>(null);
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  /** Scenarijaus „antspaudas“, iš kurio sudarytas `result`. */
  const [baseline, setBaseline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<unknown>(null);
  const [save, setSave] = useState<{ status: SaveStatus; error?: string }>({ status: "idle" });
  const [run, setRun] = useState<OptimizeRun | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // ---------- autosave ----------
  const pending = useRef<{ city: CityId; dataset: Dataset } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback((): Promise<void> => {
    window.clearTimeout(timer.current);
    const job = pending.current;
    if (!job) return chain.current;
    pending.current = null;
    setSave({ status: "saving" });
    chain.current = chain.current.then(() =>
      api.saveScenario(job.city, job.dataset).then(
        () => {
          if (!pending.current) setSave({ status: "saved" });
        },
        (e) => {
          pending.current ??= job;
          setSave({ status: "error", error: errorMessage(e) });
          throw e;
        },
      ),
    ).catch(() => undefined);
    return chain.current;
  }, []);

  const update = useCallback(
    (fn: (d: Dataset) => Dataset) => {
      setScenario((prev) => {
        if (!prev || !cityId) return prev;
        const next = fn(prev);
        pending.current = { city: cityId, dataset: next };
        return next;
      });
      setSave({ status: "pending" });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [cityId, flush],
  );

  // išsaugoti prieš uždarant skirtuką
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [flush]);

  // ---------- miestai ----------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFatal(null);
    api
      .cities()
      .then((list) => {
        if (cancelled) return;
        setCities(list);
        const saved = localStorage.getItem(CITY_KEY);
        setCityId(list.find((c) => c.id === saved)?.id ?? list[0]?.id ?? null);
      })
      .catch((e) => {
        if (!cancelled) {
          setFatal(e);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  // ---------- scenarijus + paskutinis planas ----------
  useEffect(() => {
    if (!cityId) return;
    let cancelled = false;
    localStorage.setItem(CITY_KEY, cityId);
    setLoading(true);
    setOptimizeError(null);
    (async () => {
      await chain.current; // ankstesnio miesto išsaugojimas baigtas
      const [ds, plan] = await Promise.all([api.scenario(cityId), api.plan(cityId)]);
      if (cancelled) return;
      setScenario(ds);
      setResult(plan);
      setBaseline(plan ? stableStringify(plan.plan.dataset) : null);
      setSave({ status: "idle" });
      setFatal(null);
      setLoading(false);
    })().catch((e) => {
      if (!cancelled) {
        setFatal(e);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [cityId, nonce]);

  const switchCity = useCallback(
    async (id: CityId) => {
      if (id === cityId) return;
      await flush();
      setScenario(null);
      setResult(null);
      setCityId(id);
    },
    [cityId, flush],
  );

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  // ---------- optimizavimas ----------
  const optimize = useCallback(
    async (mode: OptimizeMode): Promise<OptimizeResponse | null> => {
      if (!cityId || !scenario) return null;
      setOptimizeError(null);
      setRun({ mode, startedAt: Date.now() });
      const stamp = stableStringify(scenario);
      try {
        await flush();
        if (pending.current) throw new Error(save.error ?? "Nepavyko išsaugoti scenarijaus.");
        const res = await api.optimize({ city: cityId, mode });
        setResult(res);
        setBaseline(stamp);
        return res;
      } catch (e) {
        setOptimizeError(errorMessage(e));
        if (isServerDown(e)) setFatal(e);
        return null;
      } finally {
        setRun(null);
      }
    },
    [cityId, scenario, flush, save.error],
  );

  const current = useMemo(() => (scenario ? stableStringify(scenario) : null), [scenario]);
  const stale = result != null && current != null && baseline !== current;
  const city = cities?.find((c) => c.id === cityId) ?? null;

  return {
    cities,
    city,
    cityId,
    scenario,
    result,
    stale,
    loading,
    fatal,
    save,
    run,
    optimizeError,
    dismissOptimizeError: () => setOptimizeError(null),
    update,
    flush,
    switchCity,
    optimize,
    retry,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
