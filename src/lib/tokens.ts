/**
 * Tokens de diseño de Fuego RD (spec de rediseño §4). Son la misma fuente para el CSS (`globals.css`), el estilo de
 * MapLibre y el globo three.js de la portada. Sin dependencias de Node: lo importa el cliente.
 */
export const COLORS = {
  brand900: "#014683",
  brand700: "#08569a",
  brand500: "#1a90d0",
  brand50: "#e8f3fb",
  ink: "#ffffff",
  inkMuted: "#c9dcef",
  surface: "#ffffff",
  text: "#0b2440",
  warn: "#f5b700",
} as const;

/** Rampa por antigüedad del foco respecto al final del periodo elegido (como FIRMS: < 1 h → > 24 h). */
export const FIRE_AGE_RAMP: { maxHours: number; color: string }[] = [
  { maxHours: 1, color: "#8b0000" },
  { maxHours: 3, color: "#e01b1b" },
  { maxHours: 6, color: "#f2711c" },
  { maxHours: 12, color: "#f5b700" },
  { maxHours: 24, color: "#fde68a" },
  { maxHours: Infinity, color: "#d9d2b5" },
];

/** Colores por confianza del foco. */
export const FIRE_CONFIDENCE: Record<"high" | "nominal" | "low", string> = { high: "#e01b1b", nominal: "#f2711c", low: "#f5b700" };
/** Color único del modo «Simple». */
export const FIRE_SIMPLE = "#ff3b1f";

const channel = (hex: string, i: number) => {
  const c = parseInt(hex.replace("#", "").slice(i * 2, i * 2 + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);

/** Relación de contraste WCAG entre dos colores `#rrggbb`. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
