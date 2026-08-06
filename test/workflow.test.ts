import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

describe("workflow Sentinel", () => {
  it("approva solo gli install script necessari", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as {
      allowScripts: Record<string, boolean>;
    };

    expect(manifest.allowScripts).toEqual({
      "esbuild@0.28.1": true,
      fsevents: false
    });
  });

  it("avvia npm 12 prima dell'installazione delle dipendenze", async () => {
    for (const path of [
      ".github/workflows/ci.yml",
      ".github/workflows/sentinel.yml"
    ]) {
      const source = await readFile(path, "utf8");

      expect(source.indexOf("npm install --global npm@12.0.2")).toBeGreaterThan(
        source.indexOf("actions/setup-node@")
      );
      expect(source.indexOf("npm ci")).toBeGreaterThan(
        source.indexOf("npm install --global npm@12.0.2")
      );
    }

    const vercel = JSON.parse(await readFile("vercel.json", "utf8")) as {
      installCommand: string;
    };
    expect(vercel.installCommand).toBe("npx --yes npm@12.0.2 install");
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

  it("limita e coalesce gli eventi pubblici della inbox Codex", async () => {
    const source = await readFile(".github/workflows/codex-pr-comments.yml", "utf8");

    expect(source).toContain("cancel-in-progress: true");
    expect(source).toContain("github.event.issue.title == 'Codex feedback inbox'");
    expect(source).toContain("github.event.comment.author_association");
    expect(source).toContain("github.event.pull_request.author_association");
  });

  it("esegue il gate Codex sul codice fidato del branch predefinito", async () => {
    const source = await readFile(
      ".github/workflows/codex-review-gate.yml",
      "utf8"
    );

    expect(source).toContain("pull_request_target:");
    expect(source).toContain(
      "types: [opened, synchronize, reopened, ready_for_review]"
    );
    expect(source).toContain("workflow_dispatch:");
    expect(source).toContain("contents: read");
    expect(source).toContain("issues: read");
    expect(source).toContain("pull-requests: read");
    expect(source).toContain("statuses: write");
    expect(source).toMatch(/actions\/checkout@[0-9a-f]{40}/);
    expect(source).toContain(
      "ref: ${{ github.event.repository.default_branch }}"
    );
    expect(source).toContain("timeout-minutes: 310");
    expect(source).toContain("cancel-in-progress: true");
    expect(source).toContain("node scripts/codex-review-gate.mjs");
  });
});
