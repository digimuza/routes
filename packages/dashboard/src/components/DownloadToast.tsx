import { useEffect } from "react";
import { fmtNum } from "../format";
import type { DownloadProgress } from "../lib/downloads";
import { Icon } from "./Icon";

/** Atsisiuntimo eiga: kiek PDF jau atsisiųsta, patarimas dėl kelių failų ir ZIP alternatyva. */
export function DownloadToast({ progress, zipUrl, zipFileName, onClose }: {
  progress: DownloadProgress;
  zipUrl: string;
  zipFileName: string;
  onClose: () => void;
}) {
  const ok = progress.done - progress.failed.length;
  useEffect(() => {
    if (!progress.finished || progress.failed.length) return;
    const t = window.setTimeout(onClose, 7000);
    return () => window.clearTimeout(t);
  }, [progress.finished, progress.failed.length, onClose]);

  return (
    <div className="dltoast" role="status" aria-live="polite">
      <div className="dltoast__head">
        {progress.finished ? (
          <strong>
            <Icon name="check" size={16} /> Atsisiųsta {fmtNum(ok)} PDF {ok === 1 ? "failas" : ok >= 10 || ok === 0 ? "failų" : "failai"}
          </strong>
        ) : (
          <strong className="num">
            Atsisiunčiama {fmtNum(Math.min(progress.done + 1, progress.total))} iš {fmtNum(progress.total)}
          </strong>
        )}
        <button type="button" className="iconbtn" aria-label="Uždaryti" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="dltoast__bar" aria-hidden="true">
        <i style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }} />
      </div>
      {progress.failed.length > 0 && <p className="dltoast__fail">Nepavyko: {progress.failed.join(", ")}</p>}
      <p className="dltoast__hint">Naršyklė gali paklausti, ar leisti atsisiųsti kelis failus – spauskite „Leisti“.</p>
      <a className="dltoast__zip" href={zipUrl} download={zipFileName}>
        arba vienu ZIP
      </a>
    </div>
  );
}
