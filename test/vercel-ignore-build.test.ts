import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = new URL("../scripts/vercel-ignore-build.mjs", import.meta.url);

function exitStatus(environment: string | undefined, branch: string | undefined) {
  const env = { ...process.env };
  delete env.VERCEL_ENV;
  delete env.VERCEL_GIT_COMMIT_REF;
  if (environment !== undefined) env.VERCEL_ENV = environment;
  if (branch !== undefined) env.VERCEL_GIT_COMMIT_REF = branch;
  return spawnSync(process.execPath, [script.pathname], { env, encoding: "utf8" }).status;
}

describe("Vercel preview exclusion", () => {
  it.each(["dependabot/npm_and_yarn/example", "instinct/security-fix"])(
    "skips reserved preview branch %s",
    (branch) => expect(exitStatus("preview", branch)).toBe(0),
  );

  it.each(["main", "feature/owner-work", "instinctive", "dependabot-lookalike"])(
    "preserves owner preview branch %s",
    (branch) => expect(exitStatus("preview", branch)).toBe(1),
  );

  it.each(["production", "development", undefined])(
    "never skips environment %s",
    (environment) => expect(exitStatus(environment, "instinct/security-fix")).toBe(1),
  );

  it("builds when branch metadata is missing", () => {
    expect(exitStatus("preview", undefined)).toBe(1);
  });
});
