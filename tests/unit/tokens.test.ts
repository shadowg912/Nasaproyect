import { describe, expect, it } from "vitest";
import { COLORS, contrastRatio, FIRE_AGE_RAMP } from "@/lib/tokens";

describe("tokens de diseño", () => {
  it("la paleta de marca cumple contraste AA con texto blanco", () => {
    expect(contrastRatio("#ffffff", "#014683")).toBeGreaterThan(9);
    expect(contrastRatio("#ffffff", "#08569a")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(COLORS.text, COLORS.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(COLORS.inkMuted, COLORS.brand900)).toBeGreaterThanOrEqual(4.5);
  });

  it("la rampa por antigüedad tiene 6 tramos y el último es abierto", () => {
    expect(FIRE_AGE_RAMP).toHaveLength(6);
    expect(FIRE_AGE_RAMP[0]).toEqual({ maxHours: 1, color: "#8b0000" });
    expect(FIRE_AGE_RAMP.at(-1)!.maxHours).toBe(Infinity);
  });
});
