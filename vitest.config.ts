import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/config.ts",
        "src/dashboard.ts",
        "src/fetch-resource.ts",
        "src/fs.ts",
        "src/outbound.ts",
        "src/report.ts",
        "src/storage.ts",
        "src/summary.ts",
        "src/text.ts",
        "src/time.ts",
        "src/url.ts"
      ],
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 75,
        branches: 65
      }
    }
  }
});
