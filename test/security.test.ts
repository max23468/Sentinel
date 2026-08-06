import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { isPublicAddress, OutboundClient, pinnedLookup } from "../src/outbound.js";
import type { SiteConfig } from "../src/types.js";

const site: SiteConfig = {
  id: "test",
  name: "Test",
  enabled: true,
  sitemapUrls: ["https://example.com/sitemap.xml"],
  roots: ["https://example.com/"],
  crawl: { maxDepth: 3, maxUrls: 10, timeoutMs: 1000, userAgent: "Sentinel test" },
  includeFileExtensions: [],
  trackingParams: [],
  ignoredIssues: []
};

describe("hardening input remoti", () => {
  it("blocca reti private e redirect fuori origine prima della seconda richiesta", async () => {
    expect(isPublicAddress("8.8.8.8", 4)).toBe(true);
    expect(isPublicAddress("127.0.0.1", 4)).toBe(false);
    expect(isPublicAddress("169.254.169.254", 4)).toBe(false);
    expect(isPublicAddress("::1", 6)).toBe(false);
    const lookup = pinnedLookup([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 }
    ]);
    lookup("example.com", { all: true }, (_error, addresses) => {
      expect(addresses).toHaveLength(2);
    });

    const fetchImpl = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } })
    );
    const client = new OutboundClient(site, {
      fetch: fetchImpl,
      resolve: async () => [{ address: "93.184.216.34", family: 4 }]
    });

    await expect(client.get("https://example.com/", { maxBytes: 10 })).rejects.toThrow(
      "Destinazione non autorizzata"
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("interrompe lo streaming oltre il limite dichiarato", async () => {
    const client = new OutboundClient(site, {
      fetch: async () => new Response("troppo grande"),
      resolve: async () => [{ address: "93.184.216.34", family: 4 }]
    });

    await expect(client.get("https://example.com/", { maxBytes: 3 })).rejects.toThrow(
      "Risposta oltre il limite"
    );
  });

  it("risolve gli host IPv6 letterali senza parentesi", async () => {
    const ipv6Site = {
      ...site,
      roots: ["https://[2606:4700:4700::1111]/"]
    };
    const resolve = vi.fn(async () => [
      { address: "2606:4700:4700::1111", family: 6 as const }
    ]);
    const client = new OutboundClient(ipv6Site, {
      fetch: async () => new Response("ok"),
      resolve
    });

    await client.get(ipv6Site.roots[0], { maxBytes: 10 });

    expect(resolve).toHaveBeenCalledWith("2606:4700:4700::1111");
  });

  it("blocca i prefissi IPv6 non globali e di transizione", () => {
    expect(isPublicAddress("2606:4700:4700::1111", 6)).toBe(true);
    expect(isPublicAddress("2001::1", 6)).toBe(false);
    expect(isPublicAddress("2002:7f00:1::1", 6)).toBe(false);
    expect(isPublicAddress("64:ff9b::a9fe:a9fe", 6)).toBe(false);
    expect(isPublicAddress("3fff::1", 6)).toBe(false);
    expect(isPublicAddress("192.88.99.1", 4)).toBe(false);
  });

  it("riusa lo stesso pool per gli indirizzi già fissati", async () => {
    const resolve = vi.fn(async () => [{ address: "93.184.216.34", family: 4 as const }]);
    const dispatchers = new Set<unknown>();
    const client = new OutboundClient(site, {
      fetch: async (_url, init) => {
        dispatchers.add((init as { dispatcher?: unknown }).dispatcher);
        return new Response("ok");
      },
      resolve
    });

    await client.get("https://example.com/a", { maxBytes: 10 });
    await client.get("https://example.com/b", { maxBytes: 10 });
    await client.close();

    expect(dispatchers.size).toBe(1);
    expect(resolve).toHaveBeenCalledOnce();
  });

  it("usa un fetch compatibile con il dispatcher installato", async () => {
    const server = createServer((_request, response) => response.end("ok"));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fixture HTTP non disponibile.");

    const localSite = {
      ...site,
      roots: [`http://example.test:${address.port}/`]
    };
    const client = new OutboundClient(localSite);
    Object.defineProperty(client, "resolvePinnedAddresses", {
      value: async () => [{ address: "127.0.0.1", family: 4 }]
    });

    try {
      const response = await client.get(localSite.roots[0], { maxBytes: 10 });
      expect(new TextDecoder().decode(response.body)).toBe("ok");
    } finally {
      await client.close();
      server.close();
      await once(server, "close");
    }
  });
});
