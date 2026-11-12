#!/usr/bin/env node

const SKIP_PREVIEW_BRANCH_PREFIXES = ["dependabot/", "instinct/"];

export function shouldSkipPreview(env = process.env) {
  return (
    env.VERCEL_ENV === "preview" &&
    typeof env.VERCEL_GIT_COMMIT_REF === "string" &&
    SKIP_PREVIEW_BRANCH_PREFIXES.some((prefix) => env.VERCEL_GIT_COMMIT_REF.startsWith(prefix))
  );
}

if (import.meta.main) {
  if (shouldSkipPreview()) {
    console.log("Vercel preview skipped: bot branch is verified by GitHub checks.");
    process.exit(0);
  }

  // Vercel runs the build when the Ignored Build Step exits with status 1.
  // Keep production, owner previews and unknown environments unchanged.
  process.exit(1);
}
