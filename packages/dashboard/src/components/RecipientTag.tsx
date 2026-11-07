import { RECIPIENT_TYPE_LABELS, type Package } from "@marsrutai/shared";
import { Icon } from "./Icon";

/** Gavėjo tipas: rodomas tik autoservisams (fizinis asmuo – numatytasis, be žymos). */
export function RecipientTag({ pkg, compact = false }: { pkg: Pick<Package, "recipientType">; compact?: boolean }) {
  if (pkg.recipientType !== "autoservice") return null;
  return (
    <span className={`rtag${compact ? " rtag--compact" : ""}`} title={RECIPIENT_TYPE_LABELS.autoservice}>
      <Icon name="wrench" size={compact ? 13 : 14} />
      {compact ? <span className="sr-only">{RECIPIENT_TYPE_LABELS.autoservice}</span> : RECIPIENT_TYPE_LABELS.autoservice}
    </span>
  );
}
