import { courierPdfFileName, type OptimizeResponse } from "@marsrutai/shared";

export interface DownloadProgress {
  done: number;
  total: number;
  failed: string[];
  finished: boolean;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Failo vardas: iš URL (serverio taisyklė), jei jo nėra – bendra taisyklė iš @marsrutai/shared. */
function fileNameFor(url: string, index: number, name: string): string {
  const last = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "");
  return /\.pdf$/i.test(last) ? last : courierPdfFileName(index, name);
}

/**
 * Kiekvieno kurjerio PDF atsisiunčiamas atskiru failu: paeiliui, ~250 ms tarpais
 * (naršyklė gali paklausti, ar leisti kelis atsisiuntimus). Kurjeris be stotelių praleidžiamas,
 * jei jo PDF nėra; kitos klaidos surenkamos į `failed`.
 */
export async function downloadPdfsSeparately(result: OptimizeResponse, onProgress: (p: DownloadProgress) => void) {
  const { plan, pdfs } = result;
  const stops = new Map(plan.routes.map((r) => [r.courierId, r.stops.length]));
  const items = plan.dataset.couriers
    .map((c, i) => ({ courier: c, index: i, url: pdfs.find((p) => p.courierId === c.id)?.url }))
    .filter((x): x is typeof x & { url: string } => !!x.url);
  const progress: DownloadProgress = { done: 0, total: items.length, failed: [], finished: false };
  onProgress({ ...progress });
  for (const it of items) {
    try {
      const res = await fetch(it.url, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 404 && !stops.get(it.courier.id)) {
          progress.total--;
          onProgress({ ...progress });
          continue;
        }
        throw new Error(String(res.status));
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = fileNameFor(it.url, it.index, it.courier.name);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 30000);
    } catch {
      progress.failed.push(it.courier.name);
    }
    progress.done++;
    onProgress({ ...progress });
    await pause(250);
  }
  progress.finished = true;
  onProgress({ ...progress });
  return progress;
}

/** Kopijuoja tekstą į iškarpinę (su atsarginiu būdu senesnėms naršyklėms). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
