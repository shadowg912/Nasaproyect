import { describe, expect, it } from "vitest";
import { classifyPoint, loadTerritory } from "@/server/geo";
import { getConfig } from "@/lib/config";

const t = loadTerritory(getConfig().geoDir);
const name = (list: typeof t.provinces, id: number | null) => list.find((f) => f.properties.id === id)?.properties.name;

describe("classifyPoint", () => {
  it("ubica Santo Domingo en RD", () => {
    const c = classifyPoint(t, 18.4861, -69.9312);
    expect(c.inCountry).toBe(true);
    expect(name(t.provinces, c.provinceId)).toMatch(/Distrito Nacional|Santo Domingo/);
  });
  it("ubica Santiago de los Caballeros en Santiago", () => {
    const c = classifyPoint(t, 19.4517, -70.697);
    expect(name(t.provinces, c.provinceId)).toBe("Santiago");
    expect(c.municipalityId).not.toBeNull();
  });
  it("excluye Haití (Belladère) aunque esté dentro del bbox", () => {
    expect(classifyPoint(t, 18.857, -71.778).inCountry).toBe(false);
  });
  it("excluye puntos en el mar", () => {
    expect(classifyPoint(t, 17.9, -69.5).inCountry).toBe(false);
  });
});
