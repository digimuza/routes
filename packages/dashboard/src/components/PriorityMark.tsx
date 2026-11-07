import { PRIORITY_LABELS, type Priority } from "@marsrutai/shared";
import { priorityMarkSvg } from "../lib/marks";

export function PriorityMark({ p, size = 18, label = false }: { p: Priority; size?: number; label?: boolean }) {
  return (
    <span className="pmark" title={`${p} prioritetas – ${PRIORITY_LABELS[p].toLowerCase()}`}>
      <span className="pmark__svg" dangerouslySetInnerHTML={{ __html: priorityMarkSvg(p, size) }} />
      {label && <span className="pmark__label">{PRIORITY_LABELS[p]}</span>}
      {!label && <span className="sr-only">{`${p} prioritetas`}</span>}
    </span>
  );
}
