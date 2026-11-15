import { describe, expect, it } from "vitest";
import { formatArea, formatDistance, parseCoordinates, searchPlaces } from "@/lib/map/tools";

describe("herramientas del mapa", () => {
  it("formatea distancia y área para lectura humana", () => {
    expect(formatDistance(0.85)).toBe("850 m");
    expect(formatDistance(12.4)).toBe("12,4 km");
    expect(formatArea(3.2)).toBe("3,2 km²");
    expect(formatArea(0.5)).toBe("50 ha");
  });

  it("interpreta coordenadas y rechaza valores fuera de rango", () => {
    expect(parseCoordinates("18.5, -70.2")).toEqual([-70.2, 18.5]);
    expect(parseCoordinates("18.5 -70.2")).toEqual([-70.2, 18.5]);
    expect(parseCoordinates("18,5; -70,2")).toEqual([-70.2, 18.5]);
    expect(parseCoordinates("hola")).toBeNull();
    expect(parseCoordinates("95, 10")).toBeNull();
  });

  it("prioriza coincidencias de prefijo sin acentos", () => {
    const places = [{ name: "Monte Santo" }, { name: "Santo Domingo" }, { name: "San José de Ocoa" }];
    expect(searchPlaces("santo", places).map((place) => place.name)).toEqual(["Santo Domingo", "Monte Santo"]);
  });
});
