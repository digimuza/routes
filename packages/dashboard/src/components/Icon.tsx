/** Autorinių ikonų rinkinys: 20×20, 1.6 linija, apvalūs galai. */
const PATHS = {
  plus: "M10 4.5v11M4.5 10h11",
  trash: "M4 6h12M8 6V4.5h4V6M5.5 6l.7 9.5h7.6l.7-9.5",
  shuffle: "M3.5 6h3.2c3.3 0 3.6 8 7 8h2.8M3.5 14h3.2c1.3 0 2.1-1.2 2.7-2.6M13.7 6h2.8M14.5 4l2 2-2 2M14.5 12l2 2-2 2",
  download: "M10 3.5v9M6.2 9 10 12.8 13.8 9M4 16.5h12",
  file: "M5.5 3h6l3 3v11h-9zM11.5 3v3h3",
  close: "M5.5 5.5l9 9M14.5 5.5l-9 9",
  check: "M4.5 10.5l3.5 3.5 7.5-8",
  alert: "M10 3.5 17 16H3zM10 8.5v3.5M10 14.2v.1",
  refresh: "M15.5 8A6 6 0 0 0 4.8 6.5M4.5 3.5v3h3M4.5 12a6 6 0 0 0 10.7 1.5M15.5 16.5v-3h-3",
  focus: "M3.5 7V3.5H7M13 3.5h3.5V7M16.5 13v3.5H13M7 16.5H3.5V13M10 8.5v3M8.5 10h3",
  route: "M5 15.5a1.5 1.5 0 1 0 0-.01M15 4.5a1.5 1.5 0 1 0 0-.01M5 14V9.5c0-2 1.5-3 3.5-3h3c2 0 3.5-1 3.5-2",
  pin: "M10 17s5-4.6 5-8.5a5 5 0 0 0-10 0C5 12.4 10 17 10 17zM10 10.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z",
  wrench: "M12.6 3.2a3.6 3.6 0 0 0-3.4 4.8l-5.6 5.6a1.5 1.5 0 0 0 2.1 2.1l5.6-5.6a3.6 3.6 0 0 0 4.8-3.4l-2.1 2.1-2.3-.6-.6-2.3z",
  person: "M10 9.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.5 16.5c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8",
  pencil: "M12.8 4.2l3 3L7.5 15.5H4.5v-3zM11 6l3 3",
  courier: "M2.5 6h9v7.5h-9zM11.5 9h3l2.5 2.5v2h-5.5M5.5 15.5a1.4 1.4 0 1 0 0-.01M14 15.5a1.4 1.4 0 1 0 0-.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
