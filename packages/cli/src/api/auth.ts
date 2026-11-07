// Prieigos tokenas Route Optimization API: pirmiausia ADC (google-auth-library),
// jei nepavyksta, fallback į `gcloud auth print-access-token`. Tokenas kešuojamas jo galiojimo laikui.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
/** Kiek anksčiau už galiojimo pabaigą tokeną laikome pasenusiu. */
const EXPIRY_MARGIN_MS = 60_000;
/** `gcloud` tokenai galioja ~60 min; tikslaus laiko nežinome, todėl laikome 50 min. */
const GCLOUD_TOKEN_TTL_MS = 50 * 60_000;

interface CachedToken {
  token: string;
  expiresAt: number;
  source: "adc" | "gcloud";
}

let cached: CachedToken | undefined;

async function fromAdc(): Promise<CachedToken> {
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({ scopes: [SCOPE] });
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  if (!res.token) throw new Error("ADC negrąžino tokeno");
  const expiry = (client as { credentials?: { expiry_date?: number | null } }).credentials?.expiry_date;
  return { token: res.token, expiresAt: expiry ?? Date.now() + GCLOUD_TOKEN_TTL_MS, source: "adc" };
}

async function fromGcloud(): Promise<CachedToken> {
  const { stdout } = await execFileAsync("gcloud", ["auth", "print-access-token"], { timeout: 30_000 });
  const token = stdout.trim();
  if (!token) throw new Error("`gcloud auth print-access-token` grąžino tuščią rezultatą");
  return { token, expiresAt: Date.now() + GCLOUD_TOKEN_TTL_MS, source: "gcloud" };
}

/** Grąžina galiojantį Bearer tokeną (kešuotą, jei dar galioja). */
export async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return cached.token;
  let adcError: unknown;
  try {
    cached = await fromAdc();
    return cached.token;
  } catch (e) {
    adcError = e;
  }
  try {
    cached = await fromGcloud();
    return cached.token;
  } catch (gcloudError) {
    throw new Error(
      "Nepavyko gauti Google prieigos tokeno.\n" +
        `  ADC: ${errMsg(adcError)}\n` +
        `  gcloud: ${errMsg(gcloudError)}\n` +
        "Paleiskite `gcloud auth application-default login` arba `gcloud auth login`.",
    );
  }
}

/** Testams: išvalo kešą. */
export function clearTokenCache(): void {
  cached = undefined;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message.split("\n")[0]! : String(e);
}
