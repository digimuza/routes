import type { Courier } from "@marsrutai/shared";

const LT_MAP: Record<string, string> = {
  ą: "a", č: "c", ę: "e", ė: "e", į: "i", š: "s", ų: "u", ū: "u", ž: "z",
};

/** Vardo "slug": mažosios raidės, LT diakritika → lotyniškos, ne raidės/skaitmenys → "-". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[ąčęėįšųūž]/g, (ch) => LT_MAP[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * PDF failo vardas pagal konvenciją `courier-NN-<slug>.pdf`, kur NN – 1-based kurjerio
 * indeksas `dataset.couriers` masyve (2 skaitmenys). Turi sutapti su CLI pdf.ts.
 */
export function pdfFileName(courier: Pick<Courier, "name">, index: number): string {
  return `courier-${String(index + 1).padStart(2, "0")}-${slugify(courier.name)}.pdf`;
}
