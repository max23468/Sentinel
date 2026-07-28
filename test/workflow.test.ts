import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

describe("workflow Sentinel", () => {
  it("avvia npm 12 prima dell'installazione delle dipendenze", async () => {
    for (const path of [
      ".github/workflows/ci.yml",
      ".github/workflows/sentinel.yml"
    ]) {
      const source = await readFile(path, "utf8");

      expect(source.indexOf("npm install --global npm@12.0.1")).toBeGreaterThan(
        source.indexOf("actions/setup-node@")
      );
      expect(source.indexOf("npm ci")).toBeGreaterThan(
        source.indexOf("npm install --global npm@12.0.1")
      );
    }

    const vercel = JSON.parse(await readFile("vercel.json", "utf8")) as {
      installCommand: string;
    };
    expect(vercel.installCommand).toBe("npx --yes npm@12.0.1 install");
  });

  it("espone al guard i due cron distinti per l'ora italiana", async () => {
    const source = await readFile(".github/workflows/sentinel.yml", "utf8");
    const workflow = YAML.parse(source) as {
      on: { schedule: Array<{ cron: string }> };
    };

    expect(workflow.on.schedule.map(({ cron }) => cron)).toEqual([
      "0 7 * * 6",
      "0 8 * * 6"
    ]);
    expect(source).toContain('[ "$sched" = "0 7 * * 6" ]');
    expect(source).toContain('[ "$sched" = "0 8 * * 6" ]');
  });
});
