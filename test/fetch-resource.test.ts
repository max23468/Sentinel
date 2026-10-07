import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchResource } from "../src/fetch-resource.js";
import type { SiteConfig } from "../src/types.js";
import { testOutboundClient } from "./outbound-fixture.js";

const site: SiteConfig = {
  id: "test",
  name: "Test",
  enabled: true,
  sitemapUrls: ["https://example.com/sitemap.xml"],
  roots: ["https://example.com/"],
  crawl: {
    maxDepth: 3,
    maxUrls: 500,
    timeoutMs: 30000,
    userAgent: "Sentinel test"
  },
  includeFileExtensions: ["pdf"],
  trackingParams: []
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchResource", () => {
  it("tratta content-type non HTML come file anche senza estensione", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "application/pdf" },
        status: 200
      }))
    );

    const resource = await fetchResource(
      "https://example.com/download",
      site,
      0,
      testOutboundClient(site, fetch)
    );

    expect(resource.kind).toBe("file");
    expect(resource.normalizedText).toBeUndefined();
    expect(resource.hash).toHaveLength(64);
  });

  it("estrae testo e URL scoperti da una pagina HTML nello stesso dominio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(
        `
          <html>
            <head><title> Test </title></head>
            <body>
              <a href="/catalogo?utm_source=newsletter">Catalogo</a>
              <a href="https://outside.example.com/">Fuori dominio</a>
              <img src="/media/hero.jpg" />
            </body>
          </html>
        `,
        {
          headers: { "content-type": "text/html; charset=utf-8" },
          status: 200
        }
      ))
    );

    const resource = await fetchResource(
      "https://example.com/prodotti",
      site,
      1,
      testOutboundClient(site, fetch),
      "https://example.com/"
    );

    expect(resource.kind).toBe("html");
    expect(resource.title).toBe("Test");
    expect(resource.normalizedText).toContain("Catalogo");
    expect(resource.discoveredUrls).toEqual([
      "https://example.com/catalogo",
      "https://example.com/media/hero.jpg"
    ]);
  });

  it("restituisce una risorsa non OK senza hash quando l'URL resta HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", {
        headers: { "content-type": "text/html" },
        status: 404
      }))
    );

    const resource = await fetchResource(
      "https://example.com/mancante",
      site,
      0,
      testOutboundClient(site, fetch)
    );

    expect(resource.kind).toBe("html");
    expect(resource.status).toBe(404);
    expect(resource.hash).toBe("");
    expect(resource.discoveredUrls).toEqual([]);
  });

  it("fallisce quando un redirect porta fuori dominio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(null, {
          headers: { location: "https://evil.example.net/landing" },
          status: 302
        })
      )
    );

    await expect(
      fetchResource("https://example.com/login", site, 0, testOutboundClient(site, fetch))
    ).rejects.toThrow(
      "Destinazione non autorizzata: https://evil.example.net/landing"
    );
  });
  it.each([
    ["verification body", {}, '<html><title>One moment, please...</title><body>Please wait while your request is being verified...</body></html>'],
    ["provider header", { "cf-mitigated": "challenge" }, "ordinary looking body"],
    ["challenge markup", {}, '<form id="challenge-form">Check</form>']
  ])("rifiuta la challenge 200 prima di hash e discovery: %s", async (_name, headers, body) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, {
      headers: { "content-type": "text/html", ...headers }, status: 200
    })));
    const result = await fetchResource("https://example.com/", site, 0, testOutboundClient(site, fetch));
    expect(result.challenge).toBe(true);
    expect(result.hash).toBe("");
    expect(result.discoveredUrls).toEqual([]);
    expect(result.normalizedText).toBeUndefined();
  });

  it("non blocca un articolo che parla di verifiche anti-bot", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      '<title>Guida anti-bot</title><body>Please wait while your request is being verified...</body>',
      { headers: { "content-type": "text/html" } }
    )));
    const result = await fetchResource("https://example.com/", site, 0, testOutboundClient(site, fetch));
    expect(result.challenge).toBeUndefined();
    expect(result.hash).toHaveLength(64);
  });

  it("riconosce il segnale provider anche su challenge HTTP 403", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", {
      status: 403, headers: { "cf-mitigated": "challenge" }
    })));
    const result = await fetchResource("https://example.com/", site, 0, testOutboundClient(site, fetch));
    expect(result.challenge).toBe(true);
    expect(result.hash).toBe("");
  });

});
