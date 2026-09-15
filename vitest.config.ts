import { defineConfig } from "vitest/config";

const isBuildSuite = process.env.VITEST_SUITE === "build";

export default defineConfig({
  test: {
    include: isBuildSuite
      ? ["tests/build/**/*.test.ts"]
      : ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**", "blueprints/**", "docs/**"],
    setupFiles: ["tests/setup.ts"],
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
