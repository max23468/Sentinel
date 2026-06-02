import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readJsonFile, resolveFromCwd, writeJsonFile } from "../src/fs.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createTempDir(prefix: string): Promise<string> {
  const dir = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), prefix)));
  tempDirs.push(dir);
  return dir;
}

describe("fs helpers", () => {
  it("risolve i path relativi dalla working directory e lascia invariati quelli assoluti", () => {
    const absolutePath = "/tmp/sentinel.json";

    expect(resolveFromCwd("reports/latest.md")).toBe(path.resolve(process.cwd(), "reports/latest.md"));
    expect(resolveFromCwd(absolutePath)).toBe(absolutePath);
  });

  it("scrive JSON creando le directory mancanti e lo rilegge correttamente", async () => {
    const rootDir = await createTempDir("sentinel-fs-");
    const filePath = path.join(rootDir, "nested", "state.json");
    const payload = {
      version: 1,
      site: "ortix"
    };

    await writeJsonFile(filePath, payload);

    expect(await readFile(filePath, "utf8")).toBe('{\n  "version": 1,\n  "site": "ortix"\n}\n');
    await expect(readJsonFile(filePath, null)).resolves.toEqual(payload);
  });

  it("restituisce il fallback su file mancante e rilancia JSON non valido", async () => {
    const rootDir = await createTempDir("sentinel-fs-invalid-");
    const missingFilePath = path.join(rootDir, "missing.json");
    const invalidFilePath = path.join(rootDir, "broken.json");
    await writeFile(invalidFilePath, "{invalid}\n", "utf8");

    await expect(readJsonFile(missingFilePath, { empty: true })).resolves.toEqual({ empty: true });
    await expect(readJsonFile(invalidFilePath, null)).rejects.toThrow();
  });
});
