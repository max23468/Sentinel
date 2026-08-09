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

  it("esegue il gate Codex sul codice fidato del branch predefinito", async () => {
    const source = await readFile(
      ".github/workflows/codex-review-gate.yml",
      "utf8"
    );

    expect(source).toContain("pull_request_target:");
    expect(source).toContain(
      "types: [opened, synchronize, reopened, ready_for_review]"
    );
    expect(source).toContain("issue_comment:");
    expect(source).toContain("workflow_dispatch:");
    expect(source).toContain("contents: read");
    expect(source).toContain("issues: read");
    expect(source).toContain("pull-requests: read");
    expect(source).toContain("statuses: write");
    expect(source).toMatch(/actions\/checkout@[0-9a-f]{40}/);
    expect(source).toContain("github.event.repository.default_branch");
    expect(source).toContain("github.event_name == 'workflow_dispatch'");
    expect(source).toContain("timeout-minutes: 310");
    expect(source).toContain("cancel-in-progress: true");
    expect(source).toContain("node scripts/codex-review-gate.mjs");
  });

  it("blocca React Doctor sui warning nel workflow dedicato e nel gate generale", async () => {
    const [doctorSource, ciSource, governanceSource, sentinelSource, manifestSource, configSource] =
      await Promise.all([
        readFile(".github/workflows/react-doctor.yml", "utf8"),
        readFile(".github/workflows/ci.yml", "utf8"),
        readFile(".github/workflows/governance.yml", "utf8"),
        readFile(".github/workflows/sentinel.yml", "utf8"),
        readFile("package.json", "utf8"),
        readFile("doctor.config.json", "utf8")
      ]);
    const workflow = YAML.parse(doctorSource) as {
      on: {
        pull_request: { types: string[] };
        push: { branches: string[] };
      };
      permissions: Record<string, string>;
      concurrency: { "cancel-in-progress": boolean };
      jobs: {
        "react-doctor": {
          "timeout-minutes": number;
          steps: Array<{ uses?: string; with?: Record<string, string | number | boolean> }>;
        };
      };
    };
    const manifest = JSON.parse(manifestSource) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const config = JSON.parse(configSource) as {
      blocking: string;
      scope: string;
      ignore: { files: string[]; overrides: Array<{ files: string[]; rules: string[] }> };
    };
    const steps = workflow.jobs["react-doctor"].steps;
    const checkout = steps.find(({ uses }) => uses?.startsWith("actions/checkout@"));
    const doctor = steps.find(({ uses }) => uses?.startsWith("millionco/react-doctor@"));

    expect(workflow.on.pull_request.types).toEqual([
      "opened",
      "synchronize",
      "reopened",
      "ready_for_review"
    ]);
    expect(workflow.on.push.branches).toEqual(["main"]);
    expect(workflow.permissions).toEqual({ contents: "read", "pull-requests": "write" });
    expect(workflow.concurrency["cancel-in-progress"]).toBe(true);
    expect(workflow.jobs["react-doctor"]["timeout-minutes"]).toBe(10);
    expect(checkout?.uses).toMatch(/actions\/checkout@[0-9a-f]{40}$/);
    expect(checkout?.with).toMatchObject({ "fetch-depth": 0, "persist-credentials": false });
    expect(doctor?.uses).toMatch(/millionco\/react-doctor@[0-9a-f]{40}$/);
    expect(doctor?.with).toMatchObject({
      version: "latest",
      scope: "${{ github.event_name == 'pull_request' && 'changed' || 'full' }}",
      blocking: "warning",
      comment: "false",
      "review-comments": "true",
      "commit-status": "false"
    });
    expect(manifest.devDependencies["react-doctor"]).toBe("0.9.11");
    expect(Object.keys(manifest.scripts).filter((name) => name.includes("doctor"))).toEqual([
      "doctor"
    ]);
    expect(manifest.scripts.doctor).toBe("react-doctor --scope full --blocking warning .");
    expect(manifest.scripts.check).toContain("npm run doctor");
    expect(config).toEqual({
      blocking: "warning",
      scope: "full",
      ignore: {
        files: ["dist-web/**", "reports/**", ".worktrees/**"],
        overrides: [
          {
            files: ["src/scan.ts"],
            rules: ["react-doctor/js-set-map-lookups"]
          }
        ]
      }
    });
    expect(ciSource).toContain("name: verify");
    expect(ciSource).toContain("run: npm run check");
    expect(sentinelSource).toContain("run: npm run check");
    expect(sentinelSource).toContain('output_branch="sentinel-outputs"');
    expect(sentinelSource).toContain('output_remote_ref="refs/heads/$output_branch"');
    expect(sentinelSource).toContain("git restore --source=\"$output_ref\"");
    expect(sentinelSource).toContain('GIT_INDEX_FILE="$output_index" git read-tree --empty');
    expect(sentinelSource).toContain('git push origin "${output_commit}:refs/heads/${output_branch}"');
    expect(sentinelSource).not.toContain("statuses: write");
    expect(sentinelSource).not.toContain("sentinel-output-check");
    expect(sentinelSource).not.toContain("git push origin HEAD:main");
    expect(governanceSource).not.toContain("GH_TOKEN:");
    expect(governanceSource).toContain("curl --fail --silent --show-error");
    expect(governanceSource).toContain("strict_required_status_checks_policy");
    expect(governanceSource).toContain(
      "codex-review:15368,react-doctor:15368,verify:15368"
    );
    expect(governanceSource).toContain("codex-review-gate.yml");
  });
});
