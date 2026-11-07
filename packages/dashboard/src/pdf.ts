import type { Courier } from "@marsrutai/shared";
import { courierPdfFileName } from "@marsrutai/shared";

export { slugify } from "@marsrutai/shared";

/** PDF failo vardas – bendra taisyklė iš @marsrutai/shared. */
export function pdfFileName(courier: Pick<Courier, "name">, index: number): string {
  return courierPdfFileName(index, courier.name);
}
