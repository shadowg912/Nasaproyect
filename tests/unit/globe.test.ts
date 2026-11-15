import { describe, expect, it } from "vitest";
import { aggregateGlobeFires } from "@/server/globe";

const HEADER = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight";

describe("focos agregados para el globo de la portada", () => {
  it("agrupa los focos en celdas de 1°", () => {
    const csv = [HEADER, "18.2,-70.1,330,0.4,0.4,2026-11-14,0600,N20,n,2,290,3,N", "18.9,-70.8,330,0.4,0.4,2026-11-14,0600,N20,n,2,290,3,N", "18.5,-70.5,330,0.4,0.4,2026-11-14,0600,N21,h,2,290,3,D", "-5.5,20.5,330,0.4,0.4,2026-11-14,0600,N21,h,2,290,3,D"].join("\n");
    const cells = aggregateGlobeFires([csv]);
    expect(cells).toContainEqual({ lat: 18.5, lon: -70.5, count: 3 });
    expect(cells).toContainEqual({ lat: -5.5, lon: 20.5, count: 1 });
    expect(cells).toHaveLength(2);
  });

  it("un archivo solo con encabezado no aporta celdas", () => {
    expect(aggregateGlobeFires([HEADER])).toEqual([]);
  });
});
