import { PlanLoadError } from "../api";

export function ErrorPanel({ error }: { error: unknown }) {
  const e = error instanceof PlanLoadError ? error : null;
  return (
    <div className="error-panel">
      <h2>Nepavyko įkelti plano</h2>
      <p>{e ? e.message : String(error)}</p>
      {e && (
        <p className="muted">
          Failas: <code>{e.url}</code>
        </p>
      )}
      {e?.details && <pre className="error-details">{e.details}</pre>}
      <p>Sugeneruokite planą komandų eilutėje (repo šaknyje):</p>
      <pre className="cmd">npm run demo -- --mock</pre>
      <p className="muted">Tada spauskite „Perkrauti“.</p>
    </div>
  );
}
