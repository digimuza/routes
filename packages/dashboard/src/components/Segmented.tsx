import { useId } from "react";

export interface SegOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  title?: string;
}

/** Standartinė radio grupė, atrodanti kaip segmentuotas perjungiklis (klaviatūra: rodyklės). */
export function Segmented<T extends string | number>({ label, options, value, onChange, size = "md", disabled }: {
  label: string;
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className={`seg seg--${size}`} disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label key={String(o.value)} className={`seg__opt${o.value === value ? " is-on" : ""}`} title={o.title}>
          <input type="radio" name={name} checked={o.value === value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
