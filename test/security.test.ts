import { describe, expect, it, vi } from "vitest";
import { isTrustedCodexAuthor } from "../.github/scripts/codex-author.mjs";
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
  it("accetta solo l'identità immutabile del bot Codex", () => {
    expect(
      isTrustedCodexAuthor({
        __typename: "Bot",
        databaseId: 199175422,
        login: "chatgpt-codex-connector"
      })
    ).toBe(true);
    expect(
      isTrustedCodexAuthor({
        __typename: "User",
        databaseId: 1,
        login: "my-codex-lookalike"
      })
    ).toBe(false);
  });

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
});
