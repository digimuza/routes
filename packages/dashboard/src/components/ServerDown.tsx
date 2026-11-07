import { ApiError } from "../api";
import { Icon } from "./Icon";

export function ServerDown({ error, onRetry, retrying }: { error: unknown; onRetry: () => void; retrying: boolean }) {
  const down = error instanceof ApiError && error.kind === "network";
  const details = error instanceof ApiError ? error.details : undefined;
  return (
    <div className="serverdown" role="alert">
      <div className="serverdown__card">
        <Icon name="alert" size={24} />
        <h1>{down ? "Serveris nepasiekiamas" : "Nepavyko įkelti duomenų"}</h1>
        {down ? (
          <>
            <p>Dashboard'as negauna atsakymo iš lokalaus serverio (<code>localhost:8787</code>). Paleiskite jį repozitorijos šaknyje:</p>
            <pre className="cmd">npm run dev</pre>
            <p className="serverdown__muted">Komanda paleidžia serverį ir dashboard'ą kartu. Tada spauskite „Bandyti dar kartą“.</p>
            {import.meta.env.DEV && (
              <p className="serverdown__muted">
                Kūrimui be serverio: atidarykite <a href="?mockApi=1">?mockApi=1</a> (netikri duomenys naršyklėje).
              </p>
            )}
          </>
        ) : (
          <p>{error instanceof Error ? error.message : String(error)}</p>
        )}
        {details && <pre className="serverdown__details">{details}</pre>}
        <button type="button" className="btn btn--primary" onClick={onRetry} disabled={retrying}>
          <Icon name="refresh" size={16} />
          {retrying ? "Jungiamasi…" : "Bandyti dar kartą"}
        </button>
      </div>
    </div>
  );
}
