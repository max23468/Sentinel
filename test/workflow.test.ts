import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

describe("workflow Sentinel", () => {
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
