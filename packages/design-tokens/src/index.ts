export const colors = {
  canvas: "#f4fbf7",
  surface: "#ffffff",
  surfaceMuted: "#e8f5ee",
  ink: "#13231b",
  inkMuted: "#51655a",
  primary: "#087f5b",
  primaryStrong: "#056146",
  accent: "#c9f2dd",
  border: "#c9ddd2",
  danger: "#b42318",
  focus: "#2563eb",
} as const;

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  xxl: "3rem",
} as const;

export const radius = {
  sm: "0.5rem",
  md: "0.875rem",
  lg: "1.25rem",
  pill: "999px",
} as const;

export const typography = {
  family: "Inter, ui-sans-serif, system-ui, sans-serif",
  sizeSm: "0.875rem",
  sizeMd: "1rem",
  sizeLg: "1.25rem",
} as const;

export const elevation = {
  card: "0 18px 45px rgb(19 35 27 / 8%)",
  floating: "0 24px 64px rgb(19 35 27 / 14%)",
} as const;

export const motion = {
  fast: "120ms",
  normal: "200ms",
} as const;
