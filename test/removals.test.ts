import { describe, expect, it } from "vitest";
import { collectRemovals, isScanBlackout } from "../src/scan.js";
import type { FetchedResource, ScanIssue, SiteState, UrlState } from "../src/types.js";

function urlState(url: string): UrlState {
  return {
    url,
    kind: "html",
    firstSeenAt: "2026-07-01T00:00:00.000Z",
    lastSeenAt: "2026-07-01T00:00:00.000Z",
    lastStatus: 200,
    hash: "a".repeat(64)
  };
}

function stateWith(urls: string[]): SiteState {
  return {
    id: "test",
    name: "Test",
    urls: Object.fromEntries(urls.map((url) => [url, urlState(url)]))
  };
}

const resource = { url: "https://example.com/a" } as FetchedResource;

describe("isScanBlackout", () => {
  it("riconosce un monitor con baseline che non raccoglie più nulla", () => {
    expect(isScanBlackout(stateWith(["https://example.com/a"]), [])).toBe(true);
  });

  it("non è blackout se qualcosa è stato raccolto", () => {
    expect(isScanBlackout(stateWith(["https://example.com/a"]), [resource])).toBe(false);
  });

  it("non è blackout se lo stato precedente era vuoto", () => {
    expect(isScanBlackout(stateWith([]), [])).toBe(false);
  });
});

describe("collectRemovals", () => {
  it("segnala come rimossa una pagina non più raggiunta", () => {
    const removals = collectRemovals(
      stateWith(["https://example.com/a", "https://example.com/vecchia"]),
      new Set(["https://example.com/a"]),
      [],
      [resource]
    );

    expect(removals.map((change) => change.url)).toEqual(["https://example.com/vecchia"]);
  });

  it("non deduce rimozioni quando la scansione non ha visto nulla", () => {
    const issues: ScanIssue[] = [
      { url: "https://example.com/", message: "415", fatal: false }
    ];

    const removals = collectRemovals(
      stateWith(["https://example.com/a", "https://example.com/b"]),
      new Set(),
      issues,
      []
    );

    expect(removals).toEqual([]);
  });

  it("non segnala come rimossa una pagina che ha dato errore in questo scan", () => {
    const issues: ScanIssue[] = [
      { url: "https://example.com/instabile", message: "503", fatal: false }
    ];

    const removals = collectRemovals(
      stateWith(["https://example.com/a", "https://example.com/instabile"]),
      new Set(["https://example.com/a"]),
      issues,
      [resource]
    );

    expect(removals).toEqual([]);
  });
});
