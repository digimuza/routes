/** "Rūta Žemaitė" → "ruta-zemaite" (diakritikai transliteruojami). */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Kurjerio PDF failo vardas: `courier-NN-<slug>.pdf`, NN – 1-based indeksas `dataset.couriers`
 * masyve. Vienintelė taisyklė, kurią naudoja ir CLI (PDF generavimas), ir dashboard (nuorodos).
 */
export function courierPdfFileName(index: number, name: string): string {
  const slug = slugify(name) || "kurjeris";
  return `courier-${String(index + 1).padStart(2, "0")}-${slug}.pdf`;
}
