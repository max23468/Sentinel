import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

let previousCwd = process.cwd();

afterEach(() => {
  process.chdir(previousCwd);
});

describe("config", () => {
  it("carica default e profili SMTP", async () => {
    previousCwd = process.cwd();
    const dir = await mkdtemp(path.join(os.tmpdir(), "sentinel-config-"));
    process.chdir(dir);
    await writeFile(
      "sentinel.config.yml",
      `
version: 1
sites:
  - id: test
    name: Test
    sitemapUrls:
      - https://example.com/sitemap.xml
    roots:
      - https://example.com/
`,
      "utf8"
    );

    const config = await loadConfig();

    expect(config.storage.dataDir).toBe("data");
    expect(config.email.profiles.gmail.host).toBe("smtp.gmail.com");
    expect(config.sites[0].crawl.maxDepth).toBe(3);
    expect(config.sites[0].includeFileExtensions).toContain("pdf");
  });
});
