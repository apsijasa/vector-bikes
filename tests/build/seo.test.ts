import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Misma regla que `astro.config.mjs`. */
const site = process.env.PUBLIC_SITE_URL || "https://vectorbikes.cl";
const home = new URL("/", site).href;

function read(path: string): string {
  return readFileSync(`dist/client/${path}`, "utf8");
}

const index = read("index.html");

function jsonLdBlocks(html: string): string[] {
  const pattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  return [...html.matchAll(pattern)].map((match) => match[1] ?? "");
}

type LocalBusiness = {
  "@type": string;
  address: { streetAddress: string; addressLocality: string; addressCountry: string };
  openingHoursSpecification: unknown[];
  sameAs: string[];
};

describe("SEO del build", () => {
  it("la landing tiene un único JSON-LD LocalBusiness con dirección y horarios", () => {
    expect(index.split("application/ld+json").length - 1).toBe(1);
    const [block] = jsonLdBlocks(index);
    const data = JSON.parse(block ?? "{}") as LocalBusiness;

    expect(data["@type"]).toBe("LocalBusiness");
    expect(data.address.streetAddress).toBe("Avenida Kennedy 7666");
    expect(data.address.addressLocality).toBe("Vitacura");
    expect(data.address.addressCountry).toBe("CL");
    expect(data.openingHoursSpecification).toHaveLength(2);
    expect(data.sameAs).toContain("https://instagram.com/vector.bikes");
  });

  it("la landing declara canonical y Open Graph", () => {
    expect(index).toContain(`rel="canonical" href="${home}"`);
    expect(index).toContain('property="og:image"');
  });

  it("publica el aviso de privacidad sin JSON-LD", () => {
    const privacy = read("privacidad/index.html");

    expect(privacy).toContain("Aviso de privacidad");
    expect(privacy).toContain("Ley 21.719");
    expect(privacy).not.toContain("application/ld+json");
  });

  it("la 404 no se indexa", () => {
    const notFound = read("404.html");

    expect(notFound).toContain("Página no encontrada");
    expect(notFound).toContain('<meta name="robots" content="noindex"');
  });

  it("el sitemap lista la landing y la privacidad, y no las rutas privadas", () => {
    const sitemap = read("sitemap-0.xml");

    expect(sitemap).toContain(home);
    expect(sitemap).toContain("/privacidad");
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/reservas");
  });

  it("robots.txt bloquea el panel y la cancelación", () => {
    const robots = read("robots.txt");

    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /reservas/cancelar");
  });
});
