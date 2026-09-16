import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("dist/client/index.html", "utf8");

describe("isla de reserva construida", () => {
  it("monta BookingIsland como isla de Astro", () => {
    expect(html).toContain("<astro-island");
    const island = /<astro-island[^>]*component-url="([^"]+)"/.exec(html);
    expect(island?.[1]).toContain("BookingIsland");
  });

  it("emite el formulario completo sin JavaScript", () => {
    for (const id of ["f-nombre", "f-tel", "f-mail", "f-bici", "f-desc", "f-comuna", "f-dir"]) {
      expect(html).toContain(`for="${id}"`);
    }
    expect(html).toContain('id="f-ok"');
  });

  it("muestra el ticket y el botón de envío", () => {
    expect(html).toContain("Orden de reserva");
    expect(html).toContain("Confirmar reserva");
  });
});
